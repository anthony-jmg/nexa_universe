import { createClient } from "npm:@supabase/supabase-js@2";
import { Validator } from "../_shared/validators.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderItem {
  product_id?: string;
  event_ticket_type_id?: string;
  quantity: number;
  selected_size?: string;
}

interface ShippingInfo {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
}

interface OrderRequest {
  items: OrderItem[];
  shipping_info: ShippingInfo;
}

interface ValidatedItem {
  product_id?: string;
  event_ticket_type_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  details: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
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

    const requestData: OrderRequest = await req.json();

    const validator = new Validator();
    validator.array(requestData.items, "items")
      .arrayMinLength(requestData.items, 1, "items");

    if (requestData.shipping_info) {
      validator.required(requestData.shipping_info.name, "shipping_info.name")
        .required(requestData.shipping_info.email, "shipping_info.email")
        .email(requestData.shipping_info.email, "shipping_info.email");
    }

    const validationResult = validator.getResult();
    if (!validationResult.valid) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: validationResult.errors,
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

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("platform_subscription_status, platform_subscription_expires_at")
      .eq("id", user.id)
      .single();

    const isMember = userProfile?.platform_subscription_status === "active" &&
      userProfile?.platform_subscription_expires_at &&
      new Date(userProfile.platform_subscription_expires_at) > new Date();

    let totalAmount = 0;
    const validatedItems: ValidatedItem[] = [];
    const stockReservations: Array<{ product_id: string; quantity: number }> = [];

    for (const item of requestData.items) {
      if (item.product_id) {
        const { data: product } = await supabase
          .from("products")
          .select("id, name, price, member_price, stock")
          .eq("id", item.product_id)
          .single();

        if (!product) {
          throw new Error(`Product ${item.product_id} not found`);
        }

        const { data: availableStockResult } = await supabase
          .rpc("get_available_stock", { p_product_id: product.id });

        const availableStock = availableStockResult as number;

        if (product.stock >= 0 && availableStock < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}. Only ${availableStock} available.`);
        }

        const price = isMember ? product.member_price : product.price;
        totalAmount += price * item.quantity;

        validatedItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: price,
          details: item.selected_size ? { size: item.selected_size } : {},
        });

        if (product.stock >= 0) {
          stockReservations.push({
            product_id: product.id,
            quantity: item.quantity,
          });
        }
      } else if (item.event_ticket_type_id) {
        const { data: eventTicketType } = await supabase
          .from("event_ticket_types")
          .select(`
            id,
            price,
            member_price,
            quantity_available,
            quantity_sold,
            ticket_types (name),
            events (title)
          `)
          .eq("id", item.event_ticket_type_id)
          .single();

        if (!eventTicketType) {
          throw new Error(`Event ticket type ${item.event_ticket_type_id} not found`);
        }

        if (eventTicketType.quantity_available !== null) {
          const available = eventTicketType.quantity_available - eventTicketType.quantity_sold;
          if (available < item.quantity) {
            throw new Error(`Insufficient tickets available. Only ${available} left.`);
          }
        }

        const price = isMember && eventTicketType.member_price > 0
          ? eventTicketType.member_price
          : eventTicketType.price;

        totalAmount += price * item.quantity;

        validatedItems.push({
          event_ticket_type_id: eventTicketType.id,
          product_name: `${eventTicketType.events.title} - ${eventTicketType.ticket_types.name}`,
          quantity: item.quantity,
          unit_price: price,
          details: { event_ticket: true },
        });
      } else {
        throw new Error("Each item must have either product_id or event_ticket_type_id");
      }
    }

    const requiresShipping = validatedItems.some(item => item.product_id);

    if (requiresShipping && !requestData.shipping_info.address) {
      throw new Error("Shipping address is required for physical products");
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        total_amount: totalAmount,
        is_member_order: isMember,
        shipping_name: requestData.shipping_info.name,
        shipping_email: requestData.shipping_info.email,
        shipping_phone: requestData.shipping_info.phone || "",
        shipping_address: requestData.shipping_info.address || "",
        notes: requestData.shipping_info.notes || "",
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    const productItems = validatedItems.filter(item => item.product_id);
    if (productItems.length > 0) {
      const orderItems = productItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        details: item.details,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw itemsError;
      }
    }

    for (const reservation of stockReservations) {
      const { data: reserveResult } = await supabase
        .rpc("reserve_stock", {
          p_product_id: reservation.product_id,
          p_order_id: order.id,
          p_quantity: reservation.quantity,
        });

      if (!reserveResult) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error("Failed to reserve stock. Please try again.");
      }
    }

    const eventItems = validatedItems.filter(item => item.event_ticket_type_id);
    if (eventItems.length > 0) {
      const pendingAttendees = eventItems.map(item => ({
        order_id: order.id,
        event_ticket_type_id: item.event_ticket_type_id,
        quantity: item.quantity,
      }));

      const { error: attendeesError } = await supabase
        .from("pending_event_attendees")
        .insert(pendingAttendees);

      if (attendeesError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw attendeesError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        total_amount: totalAmount,
        validated_items: validatedItems,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Order validation error:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Failed to create order",
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
