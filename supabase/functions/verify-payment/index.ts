import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.6.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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

    if (session.payment_status !== "paid" && session.status !== "complete") {
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

    if (paymentType === "order") {
      const orderId = session.metadata?.order_id;
      if (orderId) {
        const { data: order } = await supabase
          .from("orders")
          .select("id, status")
          .eq("id", orderId)
          .maybeSingle();

        if (order && order.status !== "paid" && order.status !== "processing" && order.status !== "shipped" && order.status !== "completed") {
          const { data: orderItems } = await supabase
            .from("order_items")
            .select("product_id, item_type")
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

          const { data: converted } = await supabase.rpc("convert_pending_to_actual_attendees", { p_order_id: orderId });

          console.log(`Order ${orderId} verified and paid. Status: '${newStatus}'. Tickets converted: ${converted}`);

          if (paymentIntentId) {
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
                payment_type: "order",
                order_id: orderId,
                metadata: session.metadata,
              });
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, payment_type: "order", order_id: orderId }),
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
