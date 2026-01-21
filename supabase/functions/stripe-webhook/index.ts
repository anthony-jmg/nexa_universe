import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.6.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

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

  if (paymentType === "order") {
    const orderId = session.metadata?.order_id;
    if (orderId) {
      await supabase
        .from("orders")
        .update({
          status: "paid",
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq("id", orderId);

      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", orderId);

      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          if (item.product_id) {
            const { data: product } = await supabase
              .from("products")
              .select("stock")
              .eq("id", item.product_id)
              .single();

            if (product && product.stock >= 0) {
              await supabase
                .from("products")
                .update({ stock: product.stock - item.quantity })
                .eq("id", item.product_id);
            }
          }
        }
      }

      await supabase.rpc("release_stock_reservation", { p_order_id: orderId });

      await supabase.rpc("convert_pending_to_actual_attendees", { p_order_id: orderId });

      if (paymentIntentId) {
        await supabase.from("stripe_payments").insert({
          user_id: userId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_customer_id: session.customer as string,
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || "eur",
          status: "succeeded",
          payment_type: "order",
          order_id: orderId,
          metadata: session.metadata,
        });
      }

      console.log(`Order ${orderId} paid: stock updated, reservations released, attendees created`);
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
}

async function handlePaymentFailed(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
) {
  await supabase
    .from("stripe_payments")
    .update({ status: "failed" })
    .eq("stripe_payment_intent_id", paymentIntent.id);

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

  if (paymentType === "platform_subscription") {
    const priceId = subscription.items.data[0]?.price.id;
    const priceAmount = subscription.items.data[0]?.price.unit_amount || 0;
    const pricePaid = priceAmount / 100;

    await supabase
      .from("profiles")
      .update({
        platform_subscription_status: status,
        platform_subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        platform_subscription_price_paid: pricePaid,
        subscription_cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    console.log(`Updated platform subscription for user ${userId}: ${status} at ${pricePaid}/month`);
  } else if (paymentType === "professor_subscription" && professorId) {
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

  if (paymentType === "platform_subscription") {
    await supabase
      .from("profiles")
      .update({
        platform_subscription_status: "cancelled",
        stripe_subscription_id: null,
        stripe_price_id: null,
        subscription_cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    console.log(`Cancelled platform subscription for user ${userId}`);
  } else if (paymentType === "professor_subscription" && professorId) {
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
