import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.6.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function checkRateLimit(supabase: any, userId: string): Promise<boolean> {
  const key = `checkout:${userId}`;
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 10;
  const windowStart = now - windowMs;

  const { data: rateLimitRecord } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('key', key)
    .gte('window_start', new Date(windowStart).toISOString())
    .maybeSingle();

  if (!rateLimitRecord) {
    await supabase
      .from('rate_limits')
      .insert({
        key,
        count: 1,
        window_start: new Date(now).toISOString(),
        expires_at: new Date(now + windowMs).toISOString(),
      });
    return true;
  }

  if (rateLimitRecord.count >= maxRequests) {
    return false;
  }

  await supabase
    .from('rate_limits')
    .update({ count: rateLimitRecord.count + 1 })
    .eq('id', rateLimitRecord.id);

  return true;
}

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

    const allowed = await checkRateLimit(supabase, user.id);
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again in a minute.",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }

    const requestData: CheckoutRequest = await req.json();

    const validationErrors = validateCheckoutRequest(requestData);
    if (validationErrors.length > 0) {
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

      if (price_id) {
        session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          payment_method_types: ["card"],
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
          },
        });
      } else {
        const item = items[0];
        session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          payment_method_types: ["card"],
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
          },
        });
      }
    } else {
      const lineItems = items.map((item) => ({
        price_data: {
          currency: "eur",
          unit_amount: Math.round(item.price * 100),
          product_data: {
            name: item.name,
            metadata: item.metadata || {},
          },
        },
        quantity: item.quantity,
      }));

      totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url,
        cancel_url,
        metadata: {
          user_id: user.id,
          payment_type,
          ...metadata,
        },
      });
    }

    await supabase.from("stripe_checkout_sessions").insert({
      user_id: user.id,
      stripe_session_id: session.id,
      payment_type,
      target_id: metadata.target_id || null,
      amount: totalAmount,
      currency: "eur",
      status: "pending",
      metadata: metadata,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

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
    console.error("Error creating checkout session:", error);
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
