import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.6.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createPriceLockAfterPayment } from "../_shared/price-lock.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey || !webhookSecret) {
      throw new Error("Stripe configuration missing");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No stripe signature");
    }

    const body = await req.arrayBuffer();
    const bodyText = new TextDecoder().decode(body);
    const event = await stripe.webhooks.constructEventAsync(bodyText, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider());

    console.log(`Received webhook: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, stripe, session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(supabase, stripe, paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(supabase, paymentIntent);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, subscription, event.type);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(supabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleConnectAccountUpdated(supabase, account);
        break;
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
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
});

async function handleCheckoutCompleted(
  supabase: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.user_id;
  const paymentType = session.metadata?.payment_type;

  if (!userId || !paymentType) {
    console.error("Missing metadata in checkout session");
    return;
  }

  await supabase
    .from("stripe_checkout_sessions")
    .update({ status: "completed" })
    .eq("stripe_session_id", session.id);

  if (session.mode === "subscription" && session.subscription) {
    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionChange(supabase, subscription, "checkout.session.completed");
    return;
  }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;

  if (paymentType === "price_lock_deposit") {
    const ticketTypeId = session.metadata?.event_ticket_type_id || session.metadata?.target_id;
    if (ticketTypeId && paymentIntentId) {
      const result = await createPriceLockAfterPayment(
        supabase,
        userId,
        ticketTypeId,
        paymentIntentId,
        Number(session.metadata?.selected_deposit_amount ?? 0) > 0
          ? Number(session.metadata.selected_deposit_amount)
          : (session.amount_total || 0) / 100
      );
      if (result.error) {
        console.error("Failed to create price lock:", result.error);
        return;
      }

      const { data: existingPayment } = await supabase
        .from("stripe_payments")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();

      if (!existingPayment) {
        await supabase.from("stripe_payments").insert({
          user_id: userId,
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

      console.log(`Price lock ${result.lockId} created for user ${userId}`);
      return;
    }
  }

  if (paymentType === "price_lock_balance") {
    const lockId = session.metadata?.price_lock_id || session.metadata?.target_id;
    if (lockId && paymentIntentId) {
      const balanceAmount = (session.amount_total || 0) / 100;

      // Enregistre le solde via la fonction backend existante (idempotente,
      // une seule fois, montant exact exigé, statut -> 'completed').
      const { data: completedLock, error: recordError } = await supabase.rpc(
        "record_price_lock_payment",
        {
          p_lock_id: lockId,
          p_amount: balanceAmount,
          p_stripe_payment_intent_id: paymentIntentId,
        }
      );
      if (recordError) {
        console.error("Failed to record price lock balance payment:", recordError);
        return;
      }

      // Convertit les détenteurs en attente de solde en Full Pass confirmés.
      const { error: completeError } = await supabase.rpc(
        "complete_price_lock_attendees",
        { p_lock_id: lockId }
      );
      if (completeError) {
        console.error(`Failed to complete attendees for lock ${lockId}:`, completeError);
      }

      const { data: existingPayment } = await supabase
        .from("stripe_payments")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();

      if (!existingPayment) {
        await supabase.from("stripe_payments").insert({
          user_id: completedLock?.user_id || userId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_customer_id: session.customer as string,
          amount: balanceAmount,
          currency: session.currency || "eur",
          status: "succeeded",
          payment_type: "price_lock_balance",
          price_lock_id: lockId,
          metadata: session.metadata,
        });
      }

      console.log(`Price lock ${lockId} balance paid (${balanceAmount} €), status: ${completedLock?.status}`);
      return;
    }
  }

  if (paymentType === "order") {
    const orderId = session.metadata?.order_id;
    if (orderId) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id, product_id, quantity, item_type, event_ticket_type_id, purchase_type, details")
        .eq("order_id", orderId);

      const hasPhysicalProducts = orderItems?.some((item: any) => item.item_type === "product" && item.product_id);
      const newStatus = hasPhysicalProducts ? "paid" : "completed";

      await supabase
        .from("orders")
        .update({
          status: newStatus,
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq("id", orderId);

      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          if (item.product_id) {
            const { data: product } = await supabase
              .from("products")
              .select("stock_quantity")
              .eq("id", item.product_id)
              .maybeSingle();

            if (product && product.stock_quantity >= 0) {
              await supabase
                .from("products")
                .update({ stock_quantity: product.stock_quantity - item.quantity })
                .eq("id", item.product_id);
            }
          }
        }
      }

      // Price Lock : le lock n'est créé qu'ici, après paiement confirmé.
      // Les règles (snapshot du prix, fenêtre, quota, limites utilisateur)
      // restent appliquées par le trigger backend existant.
      let orderPriceLockId: string | null = null;
      const priceLockItems = (orderItems || []).filter(
        (item: any) => item.purchase_type === "price_lock_deposit" && item.event_ticket_type_id
      );
      for (const item of priceLockItems) {
        const result = await createPriceLockAfterPayment(
          supabase,
          userId,
          item.event_ticket_type_id,
          paymentIntentId,
          Number(session.metadata?.selected_deposit_amount ?? 0) > 0
            ? Number(session.metadata.selected_deposit_amount)
            : (session.amount_total || 0) / 100
        );
        if (result.error) {
          console.error(`Failed to create price lock for order item ${item.id}:`, result.error);
          continue;
        }
        if (!orderPriceLockId && result.lockId) {
          orderPriceLockId = result.lockId;
        }
        if (result.lockId && item.id) {
          // Le panier n'est pas la source de vérité : le mode validé dans les
          // order_items devient la configuration définitive du lock.
          const details = (item.details || {}) as Record<string, any>;
          const balanceMode = details.balance_payment_mode === "automatic" ? "automatic" : "manual";
          const lockPatch: Record<string, any> = {
            balance_payment_mode: balanceMode,
            order_item_id: item.id,
          };
          if (balanceMode === "automatic") {
            const { data: createdLock } = await supabase
              .from("price_locks")
              .select("expires_at")
              .eq("id", result.lockId)
              .maybeSingle();
            lockPatch.auto_balance_payment_at = createdLock?.expires_at ?? null;
            lockPatch.auto_balance_consent_at = new Date().toISOString();
            lockPatch.stripe_customer_id = session.customer as string;
            const paymentIntent = paymentIntentId
              ? await stripe.paymentIntents.retrieve(paymentIntentId)
              : null;
            if (paymentIntent?.payment_method) {
              lockPatch.stripe_payment_method_id = paymentIntent.payment_method as string;
            }
          }
          await supabase
            .from("price_locks")
            .update(lockPatch)
            .eq("id", result.lockId)
            .is("order_item_id", null);
        }
      }

      const { error: rpcError } = await supabase.rpc("convert_pending_to_actual_attendees", { p_order_id: orderId });
      if (rpcError) {
        console.error(`Failed to convert pending attendees for order ${orderId}:`, rpcError);
      }

      if (paymentIntentId) {
        const { data: existingOrderPayment } = await supabase
          .from("stripe_payments")
          .select("id")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();

        if (!existingOrderPayment) {
          await supabase.from("stripe_payments").insert({
            user_id: userId,
            stripe_payment_intent_id: paymentIntentId,
            stripe_customer_id: session.customer as string,
            amount: (session.amount_total || 0) / 100,
            currency: session.currency || "eur",
            status: "succeeded",
            payment_type: "order",
            order_id: orderId,
            price_lock_id: orderPriceLockId,
            metadata: session.metadata,
          });
        }
      }

      console.log(`Order ${orderId} paid: status set to '${newStatus}', stock updated, reservations released, attendees created, price locks: ${priceLockItems.length}`);
    }
  } else if (paymentType === "video") {
    const videoId = session.metadata?.video_id;
    if (videoId && paymentIntentId) {
      const { data: purchase } = await supabase
        .from("video_purchases")
        .insert({
          user_id: userId,
          video_id: videoId,
          amount_paid: (session.amount_total || 0) / 100,
          status: "active",
        })
        .select()
        .single();

      if (purchase) {
        await supabase.from("stripe_payments").insert({
          user_id: userId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_customer_id: session.customer as string,
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || "eur",
          status: "succeeded",
          payment_type: "video",
          video_purchase_id: purchase.id,
          metadata: session.metadata,
        });
      }
    }
  } else if (paymentType === "program") {
    const programId = session.metadata?.target_id;
    if (programId && paymentIntentId) {
      const { data: purchase } = await supabase
        .from("program_purchases")
        .insert({
          user_id: userId,
          program_id: programId,
          price_paid: (session.amount_total || 0) / 100,
          status: "active",
          purchased_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (purchase) {
        await supabase.from("stripe_payments").insert({
          user_id: userId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_customer_id: session.customer as string,
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || "eur",
          status: "succeeded",
          payment_type: "program",
          program_purchase_id: purchase.id,
          metadata: session.metadata,
        });

        console.log(`Program ${programId} purchased by user ${userId}`);
      }
    }
  }
}

async function handlePaymentSucceeded(
  supabase: any,
  stripe: Stripe,
  paymentIntent: Stripe.PaymentIntent
) {
  await supabase
    .from("stripe_payments")
    .update({ status: "succeeded" })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  // Débit automatique du solde Price Lock : ce n'est PAS une session Checkout,
  // le traitement passe donc exclusivement par cet événement. On réutilise
  // record_price_lock_payment (idempotent) + complete_price_lock_attendees.
  if (
    paymentIntent.metadata?.payment_type === "price_lock_balance" &&
    paymentIntent.metadata?.auto_debit === "true"
  ) {
    const lockId = paymentIntent.metadata.price_lock_id || paymentIntent.metadata.target_id;
    if (!lockId) {
      console.error("Auto debit succeeded but no lock id in metadata:", paymentIntent.id);
      return;
    }
    const balanceAmount = (paymentIntent.amount_received || paymentIntent.amount) / 100;

    const { data: completedLock, error: recordError } = await supabase.rpc(
      "record_price_lock_payment",
      {
        p_lock_id: lockId,
        p_amount: balanceAmount,
        p_stripe_payment_intent_id: paymentIntent.id,
      }
    );
    if (recordError) {
      console.error(`Failed to record auto debit for lock ${lockId}:`, recordError.message);
      return;
    }

    await supabase.rpc("complete_price_lock_attendees", { p_lock_id: lockId });

    const { data: existingPayment } = await supabase
      .from("stripe_payments")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .maybeSingle();
    if (!existingPayment) {
      await supabase.from("stripe_payments").insert({
        user_id: completedLock?.user_id ?? paymentIntent.metadata.user_id,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: paymentIntent.customer as string,
        amount: balanceAmount,
        currency: paymentIntent.currency || "eur",
        status: "succeeded",
        payment_type: "price_lock_balance",
        price_lock_id: lockId,
        metadata: paymentIntent.metadata,
      });
    }

    await supabase.rpc("finalize_price_lock_auto_debit", {
      p_lock_id: lockId,
      p_pi_id: paymentIntent.id,
      p_succeeded: true,
    });

    console.log(`Auto debit recorded for lock ${lockId}: ${balanceAmount} €, status: ${completedLock?.status}`);
  }
}

async function handlePaymentFailed(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
) {
  await supabase
    .from("stripe_payments")
    .update({ status: "failed" })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  // Débit automatique refusé : on marque l'échec et on libère la réservation —
  // le lock reste payable manuellement, aucune nouvelle tentative automatique
  // n'est déclenchée (pas de retry sans règle explicite).
  if (paymentIntent.metadata?.auto_debit === "true") {
    const lockId = paymentIntent.metadata.price_lock_id || paymentIntent.metadata.target_id;
    if (lockId) {
      await supabase.rpc("finalize_price_lock_auto_debit", {
        p_lock_id: lockId,
        p_pi_id: paymentIntent.id,
        p_succeeded: false,
        p_failure_reason:
          paymentIntent.last_payment_error?.message || "Paiement refusé par Stripe",
      });
      console.log(`Auto debit failed for lock ${lockId}, released for manual payment`);
    }
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  if (order) {
    await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id);

    await supabase.rpc("release_stock_reservation", { p_order_id: order.id });

    console.log(`Order ${order.id} cancelled due to payment failure, reservations released`);
  }
}

async function handleSubscriptionChange(
  supabase: any,
  subscription: Stripe.Subscription,
  eventType: string
) {
  const userId = subscription.metadata?.user_id;
  const paymentType = subscription.metadata?.payment_type;
  const professorId = subscription.metadata?.professor_id;
  const planType = subscription.metadata?.plan_type;

  if (!userId) {
    console.error("Missing user_id in subscription metadata");
    return;
  }

  const isActive = subscription.status === "active" || subscription.status === "trialing";
  const status = isActive ? "active" : "cancelled";
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  if (paymentType === "professor_subscription" && professorId) {
    const priceAmount = subscription.items.data[0]?.price.unit_amount || 0;
    const pricePaid = priceAmount / 100;

    const { data: existing } = await supabase
      .from("professor_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("professor_id", professorId)
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("professor_subscriptions")
        .update({
          status,
          expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("professor_subscriptions")
        .insert({
          user_id: userId,
          professor_id: professorId,
          stripe_subscription_id: subscription.id,
          price_paid: pricePaid,
          status,
          started_at: new Date(subscription.current_period_start * 1000).toISOString(),
          expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        });
    }

    console.log(`Updated professor subscription for user ${userId}: ${status} at ${pricePaid}/month`);
  }
}

async function handleSubscriptionDeleted(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const userId = subscription.metadata?.user_id;
  const paymentType = subscription.metadata?.payment_type;
  const professorId = subscription.metadata?.professor_id;

  if (!userId) {
    console.error("Missing user_id in subscription metadata");
    return;
  }

  if (paymentType === "professor_subscription" && professorId) {
    await supabase
      .from("professor_subscriptions")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("professor_id", professorId)
      .eq("stripe_subscription_id", subscription.id);

    console.log(`Cancelled professor subscription for user ${userId}`);
  }
}

async function handleInvoicePaymentSucceeded(
  supabase: any,
  invoice: Stripe.Invoice
) {
  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  console.log(`Invoice payment succeeded for subscription ${subscriptionId}`);
}

async function handleInvoicePaymentFailed(
  supabase: any,
  invoice: Stripe.Invoice
) {
  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  const userId = invoice.customer_metadata?.user_id;

  if (userId) {
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Payment Failed",
      message: "Your subscription payment failed. Please update your payment method.",
      type: "payment_failed",
      priority: "high",
    });
  }

  console.log(`Invoice payment failed for subscription ${subscriptionId}`);
}

async function handleConnectAccountUpdated(
  supabase: any,
  account: Stripe.Account
) {
  const userId = account.metadata?.user_id;
  if (!userId) {
    console.log(`Connect account ${account.id} updated but no user_id in metadata`);
    return;
  }

  const onboardingCompleted = account.details_submitted || false;
  const chargesEnabled = account.charges_enabled || false;

  await supabase
    .from("professors")
    .update({
      stripe_connect_onboarding_completed: onboardingCompleted,
      stripe_connect_enabled: chargesEnabled,
    })
    .eq("id", userId);

  console.log(`Connect account ${account.id} updated for professor ${userId}: onboarding=${onboardingCompleted}, charges=${chargesEnabled}`);
}
