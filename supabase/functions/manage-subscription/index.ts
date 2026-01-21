import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.6.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ManageSubscriptionRequest {
  action: "cancel" | "reactivate";
  subscription_type: "platform" | "professor";
  professor_id?: string;
  cancellation_reason?: string;
  cancellation_feedback?: string;
  request_refund?: boolean;
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
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const requestData: ManageSubscriptionRequest = await req.json();
    const { action, subscription_type, professor_id, cancellation_reason, cancellation_feedback, request_refund } = requestData;

    if (!action || !subscription_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (subscription_type === "professor" && !professor_id) {
      return new Response(
        JSON.stringify({ error: "professor_id is required for professor subscriptions" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let subscriptionId: string | null = null;

    if (subscription_type === "platform") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_subscription_id")
        .eq("id", user.id)
        .maybeSingle();

      subscriptionId = profile?.stripe_subscription_id;
    } else if (subscription_type === "professor" && professor_id) {
      const { data: profSub } = await supabase
        .from("professor_subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", user.id)
        .eq("professor_id", professor_id)
        .eq("status", "active")
        .maybeSingle();

      subscriptionId = profSub?.stripe_subscription_id;
    }

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ error: "No active subscription found" }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (action === "cancel") {
      const now = new Date().toISOString();
      let refundProcessed = false;
      let refundId = null;
      let refundAmount = 0;

      if (request_refund) {
        let canRefund = false;
        let waiverReason = null;

        if (subscription_type === "platform") {
          const { data: refundCalc } = await supabase
            .rpc("calculate_platform_refund_amount", { user_id_param: user.id });

          refundAmount = refundCalc || 0;
          canRefund = refundAmount > 0;

          if (!canRefund) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("platform_withdrawal_right_waived, platform_withdrawal_waiver_reason")
              .eq("id", user.id)
              .maybeSingle();

            if (profile?.platform_withdrawal_right_waived) {
              waiverReason = profile.platform_withdrawal_waiver_reason;
            }
          }
        } else if (professor_id) {
          const { data: refundCalc } = await supabase
            .rpc("calculate_professor_refund_amount", {
              user_id_param: user.id,
              professor_id_param: professor_id
            });

          refundAmount = refundCalc || 0;
          canRefund = refundAmount > 0;

          if (!canRefund) {
            const { data: profSub } = await supabase
              .from("professor_subscriptions")
              .select("withdrawal_right_waived, withdrawal_waiver_reason")
              .eq("user_id", user.id)
              .eq("professor_id", professor_id)
              .eq("status", "active")
              .maybeSingle();

            if (profSub?.withdrawal_right_waived) {
              waiverReason = profSub.withdrawal_waiver_reason;
            }
          }
        }

        if (!canRefund) {
          return new Response(
            JSON.stringify({
              error: "Refund not available",
              reason: waiverReason || "outside_withdrawal_period",
              message: waiverReason
                ? "You have used benefits from this subscription, which waives your right to a refund according to EU consumer law."
                : "The 14-day withdrawal period has passed."
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

        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          if (subscription.latest_invoice) {
            const invoice = typeof subscription.latest_invoice === 'string'
              ? await stripe.invoices.retrieve(subscription.latest_invoice)
              : subscription.latest_invoice;

            if (invoice.payment_intent) {
              const paymentIntentId = typeof invoice.payment_intent === 'string'
                ? invoice.payment_intent
                : invoice.payment_intent.id;

              const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                reason: 'requested_by_customer',
              });

              refundId = refund.id;
              refundProcessed = true;

              const amountRefunded = refund.amount / 100;

              let targetSubscriptionId = null;
              if (subscription_type === "professor" && professor_id) {
                const { data: profSub } = await supabase
                  .from("professor_subscriptions")
                  .select("id")
                  .eq("user_id", user.id)
                  .eq("professor_id", professor_id)
                  .eq("status", "active")
                  .maybeSingle();
                targetSubscriptionId = profSub?.id;
              }

              await supabase
                .from("subscription_refunds")
                .insert({
                  user_id: user.id,
                  subscription_type,
                  subscription_id: targetSubscriptionId,
                  amount: amountRefunded,
                  reason: cancellation_reason || 'withdrawal_period',
                  user_feedback: cancellation_feedback,
                  status: 'completed',
                  stripe_refund_id: refundId,
                  processed_at: now,
                });
            }
          }

          await stripe.subscriptions.cancel(subscriptionId);
        } catch (refundError) {
          console.error("Error processing refund:", refundError);
          refundProcessed = false;
        }
      } else {
        await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }

      if (subscription_type === "platform") {
        await supabase
          .from("profiles")
          .update({
            subscription_cancel_at_period_end: !request_refund,
            platform_cancellation_reason: cancellation_reason,
            platform_cancellation_feedback: cancellation_feedback,
            platform_cancelled_at: now,
            updated_at: now,
          })
          .eq("id", user.id);
      } else if (subscription_type === "professor" && professor_id) {
        await supabase
          .from("professor_subscriptions")
          .update({
            cancel_at_period_end: !request_refund,
            cancellation_reason,
            cancellation_feedback,
            cancelled_at: now,
          })
          .eq("user_id", user.id)
          .eq("professor_id", professor_id)
          .eq("status", "active");
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: refundProcessed
            ? "Subscription cancelled and refund processed"
            : "Subscription will be cancelled at the end of the billing period",
          refund_processed: refundProcessed,
          refund_id: refundId,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else if (action === "reactivate") {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      if (subscription_type === "platform") {
        await supabase
          .from("profiles")
          .update({
            subscription_cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Subscription has been reactivated",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error managing subscription:", error);
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
