import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.6.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * Débit automatique du solde des Price Locks (mode "automatic").
 *
 * Appelée uniquement par pg_cron via pg_net (jamais depuis le navigateur) et
 * par les administrateurs pour les re-tentatives manuelles. Authentification :
 * header `x-cron-secret` égal au secret stocké en base
 * (price_lock_job_settings.cron_secret, généré côté serveur), OU un JWT
 * admin Supabase valide (réutilisation du mécanisme d'administration existant).
 *
 * Flux par lock arrivé à échéance :
 * 1. claim atomique SQL (claim_price_lock_auto_debit) — re-valide TOUT au
 *    moment de l'exécution (active, automatic, remaining > 0, échéance
 *    atteinte, pas annulé, pas déjà payé manuellement) et réserve le lock
 *    (status 'processing') : un seul paiement peut prendre la main ;
 * 2. PaymentIntent Stripe off-session, confirm: true, customer + payment_method
 *    sauvegardés à l'acompte, montant = remaining_amount LU EN BASE,
 *    idempotency key stable liée au lock ;
 * 3. le webhook Stripe existant finalise : record_price_lock_payment
 *    (total_paid = locked_price, remaining = 0, completed, participants
 *    confirmés) puis finalize_price_lock_auto_debit marque 'paid'.
 * En cas d'échec immédiat : finalize_price_lock_auto_debit(succeeded=false)
 * marque 'failed' avec la raison et libère la réservation — le paiement
 * manuel reste possible. Aucune donnée de carte n'est stockée.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-cron-secret",
};

interface DueLock {
  id: string;
  user_id: string;
  remaining_amount: number;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
}

async function isAuthorized(req: Request, supabase: any): Promise<boolean> {
  const providedSecret = req.headers.get("x-cron-secret");
  if (providedSecret) {
    // Secret partagé stocké en base (généré serveur), invisible du navigateur.
    const { data } = await supabase
      .from("price_lock_job_settings")
      .select("value")
      .eq("key", "cron_secret")
      .maybeSingle();
    if (data?.value && providedSecret === data.value) {
      return true;
    }
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length);
  // Le JWT de service / la clé anon ne sont pas des utilisateurs ; on exige un
  // utilisateur réel avec le rôle admin.
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return false;
    const role = data.user.app_metadata?.role ?? data.user.user_metadata?.role;
    return role === "admin";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) throw new Error("Stripe configuration missing");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!(await isAuthorized(req, supabase))) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // 1. Sélection des locks dus — les conditions sont re-validées
    //    atomiquement par le claim SQL (étape 2), ce SELECT sert de scan.
    const { data: dueLocks, error: selectError } = await supabase
      .from("price_locks")
      .select(
        "id, user_id, remaining_amount, stripe_customer_id, stripe_payment_method_id"
      )
      .eq("status", "active")
      .eq("balance_payment_mode", "automatic")
      .is("auto_balance_canceled_at", null)
      .is("auto_balance_payment_status", null)
      .gt("remaining_amount", 0)
      .lte("auto_balance_payment_at", new Date().toISOString())
      .limit(50);

    if (selectError) throw new Error(selectError.message);

    let charged = 0;
    let failed = 0;
    let skipped = 0;

    for (const lock of (dueLocks || []) as DueLock[]) {
      // 2. Claim atomique : un seul paiement (auto OU manuel) prend la main.
      const { data: claimedAmount, error: claimError } = await supabase.rpc(
        "claim_price_lock_auto_debit",
        { p_lock_id: lock.id }
      );
      if (claimError) {
        console.error(`Claim failed for lock ${lock.id}:`, claimError.message);
        skipped++;
        continue;
      }
      // NULL = conditions plus réunies (payé avant, annulé, expiré, déjà traité)
      if (claimedAmount === null || claimedAmount === undefined) {
        skipped++;
        continue;
      }

      // Montant réel re-lu depuis la base, pas depuis la sélection initiale.
      const amountCents = Math.round(Number(claimedAmount) * 100);
      if (!lock.stripe_customer_id || !lock.stripe_payment_method_id) {
        await supabase.rpc("finalize_price_lock_auto_debit", {
          p_lock_id: lock.id,
          p_pi_id: null,
          p_succeeded: false,
          p_failure_reason: "Client ou moyen de paiement Stripe manquant",
        });
        failed++;
        continue;
      }

      // 3. PaymentIntent off-session — clé d'idempotence stable par lock.
      const idempotencyKey = `price-lock-auto-balance-${lock.id}`;
      try {
        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: amountCents,
            currency: "eur",
            customer: lock.stripe_customer_id,
            payment_method: lock.stripe_payment_method_id,
            off_session: true,
            confirm: true,
            automatic_payment_methods: { enabled: true, allow_redirects: "never" },
            description: `Solde Price Lock ${lock.id} (débit automatique)`,
            metadata: {
              payment_type: "price_lock_balance",
              price_lock_id: lock.id,
              target_id: lock.id,
              user_id: lock.user_id,
              auto_debit: "true",
            },
          },
          { idempotencyKey }
        );

        // 4. Le webhook Stripe existant finalise le paiement
        //    (record_price_lock_payment + participants).
        //    Ici : 'processing' conservé jusqu'au webhook (succès) ou échec.
        if (paymentIntent.status === "succeeded") {
          // Le webhook va marquer 'paid' ; rien d'autre à faire.
          charged++;
          console.log(
            `Auto debit succeeded for lock ${lock.id}: PI ${paymentIntent.id} (${amountCents} cents)`
          );
        } else if (
          paymentIntent.status === "requires_payment_method" ||
          paymentIntent.status === "canceled"
        ) {
          await supabase.rpc("finalize_price_lock_auto_debit", {
            p_lock_id: lock.id,
            p_pi_id: paymentIntent.id,
            p_succeeded: false,
            p_failure_reason: `Statut Stripe : ${paymentIntent.status}`,
          });
          failed++;
        } else if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_confirmation") {
          // Authentification client requise (SCA) : PAS un succès. On marque
          // l'échec avec la raison — le client règle manuellement depuis Nexa.
          await supabase.rpc("finalize_price_lock_auto_debit", {
            p_lock_id: lock.id,
            p_pi_id: paymentIntent.id,
            p_succeeded: false,
            p_failure_reason: "Authentification du client requise (SCA) — paiement manuel nécessaire",
          });
          failed++;
          console.log(`Auto debit requires SCA for lock ${lock.id}: PI ${paymentIntent.id}`);
        } else {
          // processing / autres : laisser le webhook trancher.
          charged++;
        }
      } catch (stripeError: any) {
        // Paiement refusé (card_declined, authentication_required, etc.)
        await supabase.rpc("finalize_price_lock_auto_debit", {
          p_lock_id: lock.id,
          p_pi_id: stripeError?.payment_intent?.id ?? null,
          p_succeeded: false,
          p_failure_reason: stripeError?.message || "Erreur Stripe inconnue",
        });
        failed++;
        console.error(`Auto debit failed for lock ${lock.id}:`, stripeError?.message);
      }
    }

    return new Response(
      JSON.stringify({ due: dueLocks?.length ?? 0, charged, failed, skipped }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Auto debit job error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
