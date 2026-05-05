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
  } else if (!['order', 'video', 'program', 'professor_subscription', 'event_ticket', 'platform_subscription'].includes(data.payment_type)) {
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
  payment_type: "order" | "video" | "program" | "professor_subscription" | "event_ticket" | "platform_subscription";
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

    const isSubscription = payment_type === "platform_subscription" || payment_type === "professor_subscription";

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
      const lineItems = items.map((item) => {
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

      totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
