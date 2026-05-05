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
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || (profile.role !== "professor" && profile.role !== "admin")) {
      return new Response(
        JSON.stringify({ error: "Only professors can use Stripe Connect" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action } = await req.json();

    if (action === "create-account") {
      const { data: professor } = await supabase
        .from("professors")
        .select("stripe_connect_account_id")
        .eq("id", user.id)
        .maybeSingle();

      let accountId = professor?.stripe_connect_account_id;

      if (!accountId) {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", user.id)
          .maybeSingle();

        const account = await stripe.accounts.create({
          type: "express",
          country: "FR",
          email: userProfile?.email || user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: {
            user_id: user.id,
          },
        });

        accountId = account.id;

        await supabase
          .from("professors")
          .update({ stripe_connect_account_id: accountId })
          .eq("id", user.id);
      }

      const { data: siteUrlRow } = await supabase
        .from("profiles")
        .select("id")
        .limit(0);

      const returnUrl = req.headers.get("origin") || "https://www.nexa-universe.fr";

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${returnUrl}/professor-dashboard?connect=refresh`,
        return_url: `${returnUrl}/professor-dashboard?connect=success`,
        type: "account_onboarding",
      });

      return new Response(
        JSON.stringify({ url: accountLink.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-status") {
      const { data: professor } = await supabase
        .from("professors")
        .select("stripe_connect_account_id, stripe_connect_onboarding_completed, stripe_connect_enabled, platform_fee_percentage")
        .eq("id", user.id)
        .maybeSingle();

      if (!professor?.stripe_connect_account_id) {
        return new Response(
          JSON.stringify({
            connected: false,
            onboarding_completed: false,
            charges_enabled: false,
            payouts_enabled: false,
            platform_fee_percentage: professor?.platform_fee_percentage || 20,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const account = await stripe.accounts.retrieve(professor.stripe_connect_account_id);

      const onboardingCompleted = account.details_submitted || false;
      const chargesEnabled = account.charges_enabled || false;
      const payoutsEnabled = account.payouts_enabled || false;

      if (onboardingCompleted !== professor.stripe_connect_onboarding_completed ||
          chargesEnabled !== professor.stripe_connect_enabled) {
        await supabase
          .from("professors")
          .update({
            stripe_connect_onboarding_completed: onboardingCompleted,
            stripe_connect_enabled: chargesEnabled,
          })
          .eq("id", user.id);
      }

      return new Response(
        JSON.stringify({
          connected: true,
          onboarding_completed: onboardingCompleted,
          charges_enabled: chargesEnabled,
          payouts_enabled: payoutsEnabled,
          platform_fee_percentage: professor.platform_fee_percentage || 20,
          account_id: professor.stripe_connect_account_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create-login-link") {
      const { data: professor } = await supabase
        .from("professors")
        .select("stripe_connect_account_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!professor?.stripe_connect_account_id) {
        return new Response(
          JSON.stringify({ error: "No Stripe Connect account found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const loginLink = await stripe.accounts.createLoginLink(professor.stripe_connect_account_id);

      return new Response(
        JSON.stringify({ url: loginLink.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stripe Connect error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
