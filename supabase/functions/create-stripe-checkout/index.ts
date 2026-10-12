import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.6.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateCheckoutRequest(data: any): string[] {
  const errors: string[] = [];

  if (!data.payment_type) {
    errors.push('payment_type is required');
  } else if (!'order,video,program,professor_subscription,event_ticket,price_lock_deposit,price_lock_balance'.split(',').includes(data.payment_type)) {
    errors.push('Invalid payment_type');
  }

  if (!Array.isArray(data.items)) {
    errors.push('items must be an array');
  } else {
    if (data.items.length === 0) {
      errors.push('items array cannot be empty');
    }
    if (data.items.length > 100) {
      errors.push('items array cannot exceed 100 items');
    }

    data.items.forEach((item: any, index: number) => {
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`Item ${index}: id is required and must be a string`);
      }
      if (!item.name || typeof item.name !== 'string') {
        errors.push(`Item ${index}: name is required and must be a string`);
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        errors.push(`Item ${index}: price must be a non-negative number`);
      }
      if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 1000) {
        errors.push(`Item ${index}: quantity must be between 1 and 1000`);
      }
    });
  }

  if (!data.success_url || typeof data.success_url !== 'string') {
    errors.push('success_url is required and must be a string');
  } else {
    try {
      new URL(data.success_url);
    } catch {
      errors.push('success_url must be a valid URL');
    }
  }

  if (!data.cancel_url || typeof data.cancel_url !== 'string') {
    errors.push('cancel_url is required and must be a string');
  } else {
    try {
      new URL(data.cancel_url);
    } catch {
      errors.push('cancel_url must be a valid URL');
    }
  }

  return errors;
}

interface CheckoutRequest {
  payment_type: (typeof VALID_PAYMENT_TYPES)[number];
  items: CheckoutItem[];
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  price_id?: string;
}

interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  metadata?: Record<string, string>;
}

// Price Lock : paiement du solde — le montant est TOUJOURS relu depuis la ligne
// réelle du lock (price_locks.remaining_amount). Le client ne transmet qu'un
// identifiant de lock ; le montant de la requête est ignoré.
async function resolvePriceLockBalance(
  supabase: any,
  userId: string,
  lockId: string
): Promise<{ error?: string; name?: string; amount?: number }> {
  if (!lockId) return { error: 'Price Lock introuvable.' };

  const { data: lock } = await supabase
    .from('price_locks')
    .select('id, user_id, status, remaining_amount, locked_price, deposit_amount, event_ticket_type_id, ticket_type:event_ticket_types(ticket_type:ticket_types(name))')
    .eq('id', lockId)
    .maybeSingle();

  if (!lock) return { error: 'Price Lock introuvable.' };
  if (lock.user_id !== userId) return { error: 'Ce Price Lock ne vous appartient pas.' };
  if (lock.status !== 'active') return { error: 'Ce Price Lock n\u2019est plus actif.' };

  const remaining = Number(lock.remaining_amount);
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { error: 'Aucun solde restant sur ce Price Lock.' };
  }

  const ticketName = (lock as any).ticket_type?.ticket_type?.name || 'Billet';
  return {
    name: `Solde Price Lock — ${ticketName}`,
    amount: remaining,
  };
}

// Price Lock : premier versement — montant et règles TOUJOURS fixés côté serveur
// depuis la fonction centrale de paliers (event_ticket_price_tiers). Le client
// ne transmet qu'un identifiant de billet ; le montant de la requête est ignoré.
async function resolvePriceLockDeposit(
  supabase: any,
  userId: string,
  ticketTypeId: string
): Promise<{ error?: string; name?: string; amount?: number }> {
  if (!ticketTypeId) return { error: 'Billet introuvable pour le Price Lock.' };

  const { data: ett } = await supabase
    .from('event_ticket_types')
    .select('id, price, price_lock_enabled, price_lock_deposit_amount, price_increase_date, price_lock_opens_at, is_active, event_id, ticket_type:ticket_types(name)')
    .eq('id', ticketTypeId)
    .maybeSingle();

  if (!ett) return { error: 'Billet introuvable pour le Price Lock.' };
  if (!ett.is_active) return { error: 'Ce billet n’est plus disponible à la vente.' };
  if (!ett.price_lock_enabled) return { error: 'Price Lock non disponible pour ce billet.' };
  if (!ett.price_increase_date) return { error: 'Aucune hausse tarifaire programmée pour ce billet.' };

  // Prix courant = palier actif lu côté base (source de vérité unique)
  const { data: pricing, error: pricingError } = await supabase
    .rpc('get_event_ticket_pricing', { p_event_ticket_type_id: ticketTypeId })
    .maybeSingle();
  if (pricingError) return { error: 'Impossible de déterminer le tarif actuel.' };
  if (!pricing || pricing.current_price == null) {
    return { error: 'Aucun tarif actif pour ce billet. Contacte le support.' };
  }

  const now = Date.now();
  const increaseAt = new Date(ett.price_increase_date).getTime();
  const opensAt = ett.price_lock_opens_at
    ? new Date(ett.price_lock_opens_at).getTime()
    : increaseAt - 10 * 24 * 60 * 60 * 1000;

  if (now < opensAt) return { error: 'Le Price Lock n’est pas encore ouvert pour ce billet.' };
  if (now >= increaseAt) return { error: 'Price Lock fermé pour ce billet : la hausse est déjà passée.' };

  // Un seul Price Lock actif par utilisateur et par billet
  const { count: sameType } = await supabase
    .from('price_locks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_ticket_type_id', ticketTypeId)
    .eq('status', 'active');
  if ((sameType ?? 0) > 0) {
    return { error: 'Tu as déjà un Price Lock actif pour ce billet.' };
  }

  // Max 2 Price Locks actifs simultanément par utilisateur
  const { count: activeLocks } = await supabase
    .from('price_locks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');
  if ((activeLocks ?? 0) >= 2) {
    return { error: 'Maximum 2 Price Locks actifs simultanément.' };
  }

  // Quota : quantity_sold + locks actifs < quantity_available
  if (ett.quantity_available !== null && ett.quantity_available !== undefined) {
    const { count: locksForType } = await supabase
      .from('price_locks')
      .select('id', { count: 'exact', head: true })
      .eq('event_ticket_type_id', ticketTypeId)
      .eq('status', 'active');
    if (ett.quantity_sold + (locksForType ?? 0) >= ett.quantity_available) {
      return { error: 'Quota Price Lock épuisé pour ce billet.' };
    }
  }

  const ticketName = (ett as any).ticket_type?.name || 'Billet';
  return {
    name: `Price Lock — ${ticketName}`,
    amount: Number(ett.price_lock_deposit_amount),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY is not configured in edge function secrets");
      return new Response(
        JSON.stringify({ error: "Payment system not configured. STRIPE_SECRET_KEY is missing." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError?.message || "No user found");
      return new Response(
        JSON.stringify({ error: "Invalid or expired session. Please sign in again." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = supabaseAdmin;

    console.log("Authenticated user:", user.id, user.email);

    const requestData: CheckoutRequest = await req.json();

    console.log('Received checkout request:', {
      payment_type: requestData.payment_type,
      items_count: requestData.items?.length,
      items: requestData.items,
      has_success_url: !!requestData.success_url,
      has_cancel_url: !!requestData.cancel_url,
      metadata: requestData.metadata,
      price_id: requestData.price_id,
    });

    const validationErrors = validateCheckoutRequest(requestData);
    if (validationErrors.length > 0) {
      console.error('Validation errors:', validationErrors);
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: validationErrors,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { payment_type, items, success_url, cancel_url, metadata = {}, price_id } = requestData;

    // Price Lock : le montant facturé est recalculé côté serveur depuis le billet réel
    let resolvedItems = items;
    if (payment_type === 'price_lock_deposit') {
      const ticketTypeId = metadata.event_ticket_type_id || metadata.target_id;
      const resolved = await resolvePriceLockDeposit(supabase, user.id, ticketTypeId);
      if (resolved.error) {
        return new Response(
          JSON.stringify({ error: resolved.error }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      resolvedItems = [{
        id: ticketTypeId!,
        name: resolved.name!,
        price: resolved.amount!,
        quantity: 1,
      }];
    } else if (payment_type === 'price_lock_balance') {
      const lockId = metadata.price_lock_id || metadata.target_id;
      const resolved = await resolvePriceLockBalance(supabase, user.id, lockId);
      if (resolved.error) {
        return new Response(
          JSON.stringify({ error: resolved.error }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      resolvedItems = [{
        id: lockId!,
        name: resolved.name!,
        price: resolved.amount!,
        quantity: 1,
      }];
    }

    // Resolve professor's Stripe Connect account for direct payouts
    let professorConnectAccountId: string | null = null;
    let platformFeePercentage = 20;

    if (["video", "program", "professor_subscription"].includes(payment_type)) {
      let professorId = metadata.professor_id;

      // If professor_id not in metadata, resolve from video or program
      if (!professorId && payment_type === "video" && metadata.video_id) {
        const { data: video } = await supabase
          .from("videos")
          .select("professor_id")
          .eq("id", metadata.video_id)
          .maybeSingle();
        professorId = video?.professor_id;
      }
      if (!professorId && payment_type === "program" && metadata.target_id) {
        const { data: program } = await supabase
          .from("programs")
          .select("professor_id")
          .eq("id", metadata.target_id)
          .maybeSingle();
        professorId = program?.professor_id;
      }

      if (professorId) {
        const { data: professor } = await supabase
          .from("professors")
          .select("stripe_connect_account_id, stripe_connect_enabled, platform_fee_percentage")
          .eq("id", professorId)
          .maybeSingle();

        if (professor?.stripe_connect_account_id && professor?.stripe_connect_enabled) {
          professorConnectAccountId = professor.stripe_connect_account_id;
          platformFeePercentage = professor.platform_fee_percentage || 20;
          console.log(`Using Stripe Connect for professor ${professorId}, fee: ${platformFeePercentage}%`);
        }
      }
    }

    let stripeCustomerId: string | undefined;
    const { data: existingCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingCustomer) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .maybeSingle();

      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.full_name,
        metadata: {
          user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      await supabase.from("stripe_customers").insert({
        user_id: user.id,
        stripe_customer_id: customer.id,
      });
    }

    const isSubscription = payment_type === "professor_subscription";

    let session;
    let totalAmount: number;

    if (isSubscription) {
      totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const subscriptionTransferData = professorConnectAccountId
        ? { transfer_data: { destination: professorConnectAccountId, amount_percent: (100 - platformFeePercentage) } }
        : {};

      if (price_id) {
        session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          line_items: [
            {
              price: price_id,
              quantity: 1,
            },
          ],
          mode: "subscription",
          success_url,
          cancel_url,
          metadata: {
            user_id: user.id,
            payment_type,
            ...metadata,
          },
          subscription_data: {
            metadata: {
              user_id: user.id,
              payment_type,
              ...metadata,
            },
            ...subscriptionTransferData,
          },
        });
      } else {
        const item = items[0];
        session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          line_items: [
            {
              price_data: {
                currency: "eur",
                unit_amount: Math.round(item.price * 100),
                recurring: {
                  interval: "month",
                },
                product_data: {
                  name: item.name,
                  metadata: item.metadata || {},
                },
              },
              quantity: 1,
            },
          ],
          mode: "subscription",
          success_url,
          cancel_url,
          metadata: {
            user_id: user.id,
            payment_type,
            ...metadata,
          },
          subscription_data: {
            metadata: {
              user_id: user.id,
              payment_type,
              ...metadata,
            },
            ...subscriptionTransferData,
          },
        });
      }
    } else {
      const lineItems = resolvedItems.map((item) => {
        const sanitizedMetadata: Record<string, string> = {};
        if (item.metadata) {
          for (const [k, v] of Object.entries(item.metadata)) {
            sanitizedMetadata[String(k)] = String(v);
          }
        }
        return {
          price_data: {
            currency: "eur",
            unit_amount: Math.max(1, Math.round(item.price * 100)),
            product_data: {
              name: item.name || "Item",
              metadata: sanitizedMetadata,
            },
          },
          quantity: item.quantity,
        };
      });

      totalAmount = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const paymentIntentData = professorConnectAccountId
        ? {
            payment_intent_data: {
              transfer_data: {
                destination: professorConnectAccountId,
                amount: Math.round(totalAmount * 100 * (100 - platformFeePercentage) / 100),
              },
            },
          }
        : {};

      session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        line_items: lineItems,
        mode: "payment",
        success_url,
        cancel_url,
        metadata: {
          user_id: user.id,
          payment_type,
          ...metadata,
        },
        // Price Lock en prélèvement automatique : le moyen de paiement est
        // sauvegardé (référence Stripe uniquement) pour le débit du solde.
        ...(payment_type === "order" &&
        (metadata as Record<string, any>).has_price_lock_auto_balance === "true"
          ? { payment_intent_data: { setup_future_usage: "off_session" as const } }
          : {}),
        ...paymentIntentData,
      });
    }

    const targetId = metadata.target_id && UUID_REGEX.test(metadata.target_id) ? metadata.target_id : null;

    const { error: insertError } = await supabase.from("stripe_checkout_sessions").insert({
      user_id: user.id,
      stripe_session_id: session.id,
      payment_type,
      target_id: targetId,
      amount: totalAmount,
      currency: "eur",
      status: "pending",
      metadata: metadata,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      console.error("Failed to save checkout session to DB:", insertError);
    }

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stripeCode = error && typeof error === 'object' && 'code' in error ? (error as any).code : undefined;
    const stripeType = error && typeof error === 'object' && 'type' in error ? (error as any).type : undefined;
    console.error("Checkout error:", { message, stripeCode, stripeType, raw: error });

    return new Response(
      JSON.stringify({
        error: message,
        stripe_code: stripeCode,
        stripe_type: stripeType,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
