import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Validator } from "../_shared/validators.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AttendeeInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface OrderItem {
  product_id?: string;
  event_ticket_type_id?: string;
  quantity: number;
  selected_size?: string;
  attendees?: AttendeeInfo[];
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
  attendees_by_ticket?: Record<string, AttendeeInfo[]>;
}

interface ValidatedItem {
  item_type: string;
  product_id?: string;
  event_ticket_type_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  selected_size?: string;
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
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
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    if (requestData.shipping_info) {
      if (!requestData.shipping_info.email && user.email) {
        requestData.shipping_info.email = user.email;
      }
      if (!requestData.shipping_info.name && user.email) {
        requestData.shipping_info.name = user.email.split('@')[0];
      }
    } else {
      requestData.shipping_info = {
        name: user.email?.split('@')[0] || 'Client',
        email: user.email || '',
      };
    }

    const validator = new Validator();
    validator
      .array(requestData.items, "items")
      .arrayMinLength(requestData.items, 1, "items");

    if (requestData.shipping_info) {
      validator
        .required(requestData.shipping_info.name, "shipping_info.name")
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select(
        "platform_subscription_status, platform_subscription_expires_at"
      )
      .eq("id", user.id)
      .maybeSingle();

    const isMember =
      userProfile?.platform_subscription_status === "active" &&
      userProfile?.platform_subscription_expires_at &&
      new Date(userProfile.platform_subscription_expires_at) > new Date();

    let totalAmount = 0;
    const validatedItems: ValidatedItem[] = [];
    const stockReservations: Array<{
      product_id: string;
      quantity: number;
    }> = [];

    for (const item of requestData.items) {
      if (item.product_id) {
        const { data: product } = await supabase
          .from("products")
          .select("id, name, price, member_price")
          .eq("id", item.product_id)
          .maybeSingle();

        if (!product) {
          return new Response(
            JSON.stringify({
              error: `Product ${item.product_id} not found`,
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

        const { data: availableStockResult } = await supabase.rpc(
          "get_available_stock",
          { p_product_id: product.id }
        );

        const availableStock = (availableStockResult as number) ?? 0;
        const { count: sizeCount } = await supabase
          .from("product_sizes")
          .select("id", { count: "exact", head: true })
          .eq("product_id", product.id);

        const hasStockTracking = (sizeCount ?? 0) > 0;

        if (hasStockTracking && availableStock < item.quantity) {
          return new Response(
            JSON.stringify({
              error: `Insufficient stock for product ${product.name}. Only ${availableStock} available.`,
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

        const price =
          isMember && product.member_price > 0
            ? product.member_price
            : product.price;
        totalAmount += price * item.quantity;

        validatedItems.push({
          item_type: "product",
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: price,
          selected_size: item.selected_size,
        });

        if (hasStockTracking) {
          stockReservations.push({
            product_id: product.id,
            quantity: item.quantity,
          });
        }
      } else if (item.event_ticket_type_id) {
        const { data: eventTicketType } = await supabase
          .from("event_ticket_types")
          .select(
            `
            id,
            event_id,
            price,
            member_price,
            quantity_available,
            quantity_sold,
            ticket_types (name),
            events (title)
          `
          )
          .eq("id", item.event_ticket_type_id)
          .maybeSingle();

        if (!eventTicketType) {
          return new Response(
            JSON.stringify({
              error: `Event ticket type ${item.event_ticket_type_id} not found`,
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

        if (eventTicketType.quantity_available !== null) {
          const available =
            eventTicketType.quantity_available -
            eventTicketType.quantity_sold;
          if (available < item.quantity) {
            return new Response(
              JSON.stringify({
                error: `Insufficient tickets available. Only ${available} left.`,
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
        }

        const price =
          isMember &&
          eventTicketType.member_price > 0
            ? eventTicketType.member_price
            : eventTicketType.price;

        totalAmount += price * item.quantity;

        const eventTitle =
          (eventTicketType.events as any)?.title ?? "Event";
        const ticketName =
          (eventTicketType.ticket_types as any)?.name ?? "Ticket";

        validatedItems.push({
          item_type: "event_ticket",
          event_ticket_type_id: eventTicketType.id,
          product_name: `${eventTitle} - ${ticketName}`,
          quantity: item.quantity,
          unit_price: price,
        });
      } else {
        return new Response(
          JSON.stringify({
            error:
              "Each item must have either product_id or event_ticket_type_id",
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
    }

    const requiresShipping = validatedItems.some(
      (item) => item.item_type === "product"
    );

    if (requiresShipping && !requestData.shipping_info?.address) {
      return new Response(
        JSON.stringify({
          error: "Shipping address is required for physical products",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
      console.error("Order insert error:", orderError);
      return new Response(
        JSON.stringify({ error: "Failed to create order" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orderItems = validatedItems.map((item) => ({
      order_id: order.id,
      item_type: item.item_type,
      product_id: item.product_id || null,
      event_ticket_type_id: item.event_ticket_type_id || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      selected_size: item.selected_size || null,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Order items insert error:", itemsError);
      await supabase.from("orders").delete().eq("id", order.id);
      return new Response(
        JSON.stringify({ error: "Failed to create order items" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    for (const reservation of stockReservations) {
      const { data: reserveResult } = await supabase.rpc("reserve_stock", {
        p_product_id: reservation.product_id,
        p_order_id: order.id,
        p_quantity: reservation.quantity,
      });

      if (!reserveResult) {
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        return new Response(
          JSON.stringify({
            error: "Failed to reserve stock. Please try again.",
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
    }

    const eventItems = validatedItems.filter(
      (item) => item.item_type === "event_ticket"
    );
    for (const item of eventItems) {
      const attendeesForTicket = requestData.attendees_by_ticket?.[item.event_ticket_type_id!] || [];

      for (let i = 0; i < item.quantity; i++) {
        const qrCode = `EVT-${order.id}-${item.event_ticket_type_id}-${i}-${Date.now()}`;
        const attendeeInfo = attendeesForTicket[i];

        const { data: ticketType } = await supabase
          .from("event_ticket_types")
          .select("event_id")
          .eq("id", item.event_ticket_type_id!)
          .maybeSingle();

        if (ticketType) {
          const { error: attendeeError } = await supabase
            .from("pending_event_attendees")
            .insert({
              reservation_id: order.id,
              event_id: ticketType.event_id,
              user_id: user.id,
              event_ticket_type_id: item.event_ticket_type_id,
              qr_code: qrCode,
              expires_at: new Date(
                Date.now() + 30 * 60 * 1000
              ).toISOString(),
              attendee_first_name: attendeeInfo?.firstName || null,
              attendee_last_name: attendeeInfo?.lastName || null,
              attendee_email: attendeeInfo?.email || null,
              attendee_phone: attendeeInfo?.phone || null,
            });

          if (attendeeError) {
            console.error(
              "Pending attendee insert error:",
              attendeeError
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        total_amount: totalAmount,
        validated_items: validatedItems.map((item) => ({
          product_id: item.product_id,
          event_ticket_type_id: item.event_ticket_type_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          details: item.selected_size
            ? { size: item.selected_size }
            : item.event_ticket_type_id
              ? { event_ticket: "true" }
              : {},
        })),
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
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
