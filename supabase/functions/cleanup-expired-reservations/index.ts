import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: reservationsData, error: reservationsError } = await supabase.rpc(
      "cleanup_expired_reservations"
    );

    if (reservationsError) {
      console.error("Error cleaning up reservations:", reservationsError);
      throw reservationsError;
    }

    const { data: ordersData, error: ordersError } = await supabase.rpc(
      "cancel_expired_orders"
    );

    if (ordersError) {
      console.error("Error cancelling expired orders:", ordersError);
      throw ordersError;
    }

    const result = {
      success: true,
      reservations_cleaned: reservationsData ?? 0,
      orders_cancelled: ordersData ?? 0,
      timestamp: new Date().toISOString(),
    };

    console.log("Cleanup completed:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
