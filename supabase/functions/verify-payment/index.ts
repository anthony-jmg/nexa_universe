import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.6.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { applyBalancePayment, createPriceLockAfterPayment, refundPayment } from "../_shared/price-lock.ts";
import { fulfillPaidOrder } from "../_shared/order-fulfillment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Payment system not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.metadata?.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Session does not belong to this user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Seul un paiement réellement encaissé est livré (une session 'complete'
    // peut rester 'unpaid' pour un moyen de paiement différé).
    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ success: false, status: session.payment_status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentType = session.metadata?.payment_type;
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

    await supabase
      .from("stripe_checkout_sessions")
      .update({ status: "completed" })
      .eq("stripe_session_id", session_id);

    if (paymentType === "price_lock_deposit") {
      const ticketTypeId = session.metadata?.event_ticket_type_id || session.metadata?.target_id;
      if (ticketTypeId && paymentIntentId) {
        const result = await createPriceLockAfterPayment(
          supabase,
          user.id,
          ticketTypeId,
          paymentIntentId,
          (session.amount_total || 0) / 100
        );

        if (result.error) {
          // Lock refusé après paiement : remboursement intégral (clé partagée
          // avec le webhook, un seul remboursement).
          const refund = await refundPayment(stripe, paymentIntentId, `price-lock-refund-${paymentIntentId}`);
          if (refund.error) {
            console.error(`Refund failed for payment ${paymentIntentId}:`, refund.error);
          }
          return new Response(
            JSON.stringify({ success: false, error: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existingPayment } = await supabase
          .from("stripe_payments")
          .select("id")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();

        if (!existingPayment) {
          await supabase.from("stripe_payments").insert({
            user_id: user.id,
            stripe_payment_intent_id: paymentIntentId,
            stripe_customer_id: session.customer as string,
            amount: (session.amount_total || 0) / 100,
            currency: session.currency || "eur",
            status: "succeeded",
            payment_type: "price_lock_deposit",
            price_lock_id: result.lockId,
            metadata: session.metadata,
          });
        }

        // Achat hors panier : participant 'awaiting_balance' (idempotent).
        const { error: attendeeError } = await supabase.rpc("ensure_price_lock_attendee", { p_lock_id: result.lockId });
        if (attendeeError) {
          console.error(`Failed to create attendee for lock ${result.lockId}:`, attendeeError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            payment_type: "price_lock_deposit",
            price_lock_id: result.lockId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (paymentType === "price_lock_balance") {
      const lockId = session.metadata?.price_lock_id || session.metadata?.target_id;
      if (lockId && paymentIntentId) {
        // Idempotent (webhook + verify-payment) ; remboursé si le lock ne peut
        // plus être soldé par ce paiement.
        const result = await applyBalancePayment(supabase, stripe, {
          lockId,
          paymentIntentId,
          amount: (session.amount_total || 0) / 100,
          userId: user.id,
          customerId: session.customer as string,
          currency: session.currency || "eur",
          metadata: session.metadata,
          autoDebit: false,
        });
        if (!result.ok) {
          return new Response(
            JSON.stringify({ success: false, error: result.error, refunded: result.refunded }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            payment_type: "price_lock_balance",
            price_lock_id: lockId,
            status: result.lock?.status,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (paymentType === "order") {
      const orderId = session.metadata?.order_id;
      if (orderId) {
        // Traitement unique et idempotent, partagé avec le webhook.
        const result = await fulfillPaidOrder(supabase, stripe, session, user.id);
        if (!result.ok) {
          return new Response(
            JSON.stringify({ success: false, error: "Paiement non rapproché de la commande. Contacte le support." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            payment_type: "order",
            order_id: orderId,
            refused_price_locks: result.refusedLocks ?? 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (paymentType === "video") {
      const videoId = session.metadata?.video_id;
      if (videoId && paymentIntentId) {
        const { data: existingPurchase } = await supabase
          .from("video_purchases")
          .select("id")
          .eq("user_id", user.id)
          .eq("video_id", videoId)
          .maybeSingle();

        if (!existingPurchase) {
          await supabase.from("video_purchases").insert({
            user_id: user.id,
            video_id: videoId,
            amount_paid: (session.amount_total || 0) / 100,
            status: "active",
          });
        }

        return new Response(
          JSON.stringify({ success: true, payment_type: "video", video_id: videoId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (paymentType === "program") {
      const programId = session.metadata?.target_id;
      if (programId && paymentIntentId) {
        const { data: existingPurchase } = await supabase
          .from("program_purchases")
          .select("id")
          .eq("user_id", user.id)
          .eq("program_id", programId)
          .maybeSingle();

        if (!existingPurchase) {
          await supabase.from("program_purchases").insert({
            user_id: user.id,
            program_id: programId,
            price_paid: (session.amount_total || 0) / 100,
            status: "active",
            purchased_at: new Date().toISOString(),
          });
        }

        return new Response(
          JSON.stringify({ success: true, payment_type: "program", program_id: programId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, payment_type: paymentType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Verify payment error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
