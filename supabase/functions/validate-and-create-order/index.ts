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
  purchase_type?: string;
  price_snapshot?: number;
  deposit_amount?: number;
  balance_payment_mode?: string;
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
  purchase_type: string;
  locked_price_snapshot?: number;
  deposit_amount?: number;
  balance_payment_mode?: string;
  price_tier_id?: string;
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

    let totalAmount = 0;
    const validatedItems: ValidatedItem[] = [];
    const stockReservations: Array<{
      product_id: string;
      quantity: number;
    }> = [];
    const orderEventsWithDeposit = new Set<string>();

    for (const item of requestData.items) {
      if (item.product_id) {
        const { data: product } = await supabase
          .from("products")
          .select("id, name, price")
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

        const price = product.price;
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
        const purchaseType = item.purchase_type === 'price_lock_deposit' ? 'price_lock_deposit' : 'full_purchase';
        // Mode de règlement du solde : manual par défaut, jamais déduit d'un autre champ.
        const balancePaymentMode = purchaseType === 'price_lock_deposit'
          ? (item.balance_payment_mode === 'automatic' ? 'automatic' : 'manual')
          : null;
        const cartPriceSnapshot = item.price_snapshot != null ? Number(item.price_snapshot) : null;
        const cartDepositAmount = item.deposit_amount != null ? Number(item.deposit_amount) : null;

        const { data: eventTicketType } = await supabase
          .from("event_ticket_types")
          .select(
            `
            id,
            event_id,
            price,
            quantity_available,
            quantity_sold,
            is_active,
            price_lock_enabled,
            price_lock_deposit_amount,
            price_increase_date,
            price_lock_opens_at,
            sale_end_date,
            max_per_order,
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

        if (eventTicketType.is_active === false) {
          return new Response(
            JSON.stringify({ error: "Ce billet n'est plus disponible à la vente." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let unitPrice = Number(eventTicketType.price);
        // Prix relu côté base depuis le palier actif (source de vérité unique)
        const { data: pricing, error: pricingError } = await supabase
          .rpc("get_event_ticket_pricing", { p_event_ticket_type_id: eventTicketType.id })
          .maybeSingle();
        if (pricingError || !pricing || pricing.current_price == null) {
          return new Response(
            JSON.stringify({ error: "Impossible de déterminer le tarif actuel de ce billet. Actualise la page." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        unitPrice = Number(pricing.current_price);
        let lockedPriceSnapshot: number | undefined;
        let depositAmount: number | undefined;

        if (purchaseType === "price_lock_deposit") {
          // Un seul Price Lock par festival et par commande, indépendamment du type de billet
          if (orderEventsWithDeposit.has(eventTicketType.event_id)) {
            return new Response(
              JSON.stringify({ error: "Un seul Price Lock est autorisé par festival." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (item.quantity !== 1) {
            return new Response(
              JSON.stringify({ error: "Un Price Lock est toujours limité à une quantité de 1." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          // Règles Price Lock vérifiées côté serveur, montant = dépôt officiel du billet
          if (!eventTicketType.price_lock_enabled) {
            return new Response(
              JSON.stringify({ error: "Price Lock non disponible pour ce billet." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (!eventTicketType.price_increase_date) {
            return new Response(
              JSON.stringify({ error: "Aucune hausse tarifaire programmée pour ce billet." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const now = Date.now();
          const increaseAt = new Date(eventTicketType.price_increase_date).getTime();
          const opensAt = eventTicketType.price_lock_opens_at
            ? new Date(eventTicketType.price_lock_opens_at).getTime()
            : increaseAt - 10 * 24 * 60 * 60 * 1000;
          if (now < opensAt) {
            return new Response(
              JSON.stringify({
                error: "Le Price Lock n'est pas encore ouvert pour ce billet.",
                code: "PRICE_LOCK_CLOSED",
                event_ticket_type_id: eventTicketType.id,
              }),
              {
                status: 409,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          if (now >= increaseAt) {
            return new Response(
              JSON.stringify({
                error: "Ce Price Lock n'est plus disponible pour ce tarif.",
                code: "PRICE_LOCK_CLOSED",
                event_ticket_type_id: eventTicketType.id,
                current_price: unitPrice,
              }),
              {
                status: 409,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          if (eventTicketType.sale_end_date && now >= new Date(eventTicketType.sale_end_date).getTime()) {
            return new Response(
              JSON.stringify({ error: "Ventes closes pour ce billet." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const { count: sameType } = await supabase
            .from("price_locks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("event_ticket_type_id", eventTicketType.id)
            .eq("status", "active");
          if ((sameType ?? 0) > 0) {
            return new Response(
              JSON.stringify({ error: "Tu as déjà un Price Lock actif pour ce billet." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const { count: activeForEvent } = await supabase
            .from("price_locks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("event_id", eventTicketType.event_id)
            .eq("status", "active");
          if ((activeForEvent ?? 0) > 0) {
            return new Response(
              JSON.stringify({ error: "Tu as déjà un Price Lock actif pour ce festival." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const { count: activeLocks } = await supabase
            .from("price_locks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "active");
          if ((activeLocks ?? 0) >= 2) {
            return new Response(
              JSON.stringify({ error: "Maximum 2 Price Locks actifs simultanément." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          lockedPriceSnapshot = unitPrice;
          // Le panier porte le montant choisi par l'utilisateur : revalidé côté
          // base (minimum configuré, 20 €, < tarif verrouillé) avant facturation.
          if (cartDepositAmount != null) {
            const { data: validatedDeposit, error: depositError } = await supabase.rpc(
              "create_stripe_price_lock_deposit",
              {
                p_user_id: user.id,
                p_ticket_type_id: eventTicketType.id,
                p_amount: cartDepositAmount,
              }
            );
            if (depositError || validatedDeposit == null) {
              return new Response(
                JSON.stringify({
                  error: depositError?.message || "Montant de versement Price Lock invalide.",
                  event_ticket_type_id: eventTicketType.id,
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            depositAmount = Number(validatedDeposit);
          } else {
            depositAmount = Number(eventTicketType.price_lock_deposit_amount);
          }
          if (depositAmount >= unitPrice) {
            return new Response(
              JSON.stringify({ error: "Le dépôt Price Lock doit être inférieur au tarif actuel." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          unitPrice = depositAmount;
          orderEventsWithDeposit.add(eventTicketType.event_id);
        }

        if (eventTicketType.quantity_available !== null) {
          let locksForType = 0;
          if (purchaseType === "price_lock_deposit") {
            const { count } = await supabase
              .from("price_locks")
              .select("id", { count: "exact", head: true })
              .eq("event_ticket_type_id", eventTicketType.id)
              .eq("status", "active");
            locksForType = count ?? 0;
          }
          const available =
            eventTicketType.quantity_available - eventTicketType.quantity_sold - locksForType;
          if (available < item.quantity) {
            return new Response(
              JSON.stringify({
                error: `Insufficient tickets available. Only ${Math.max(0, available)} left.`,
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

        const eventTitle =
          (eventTicketType.events as any)?.title ?? "Event";
        const ticketName =
          (eventTicketType.ticket_types as any)?.name ?? "Ticket";

        // Revalidation du prix : si le montant du panier ne correspond plus au
        // palier actif (ou au dépôt), on ne crée PAS la commande — le frontend
        // met à jour le panier et redemande une confirmation utilisateur.
        if (purchaseType === "full_purchase" && cartPriceSnapshot != null) {
          const drifted = Math.abs(unitPrice - cartPriceSnapshot) >= 0.01;
          if (drifted) {
            return new Response(
              JSON.stringify({
                error: "Le tarif de ce billet a évolué depuis l'ajout au panier.",
                code: "PRICE_CHANGED",
                event_ticket_type_id: eventTicketType.id,
                cart_price: cartPriceSnapshot,
                current_price: unitPrice,
                ticket_name: `${eventTitle} - ${ticketName}`,
              }),
              {
                status: 409,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
        // Versement Price Lock : le montant choisi dans le panier a déjà été
        // revalidé via create_stripe_price_lock_deposit (minimum, < tarif).

        totalAmount += unitPrice * item.quantity;

        validatedItems.push({
          item_type: "event_ticket",
          event_ticket_type_id: eventTicketType.id,
          product_name: `${eventTitle} - ${ticketName}`,
          quantity: item.quantity,
          unit_price: unitPrice,
          purchase_type: purchaseType,
          balance_payment_mode: balancePaymentMode ?? undefined,
          price_tier_id: (pricing as any)?.current_tier_id ?? undefined,
          ...(purchaseType === "price_lock_deposit"
            ? { locked_price_snapshot: lockedPriceSnapshot!, deposit_amount: depositAmount! }
            : {}),
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
        is_member_order: false,
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
      price_tier_id: item.price_tier_id || null,
      purchase_type:
        item.item_type === "event_ticket" && item.purchase_type === "price_lock_deposit"
          ? "price_lock_deposit"
          : null,
      locked_price_snapshot: item.locked_price_snapshot ?? null,
      deposit_amount: item.deposit_amount ?? null,
      details:
        item.item_type === "event_ticket" && item.purchase_type === "price_lock_deposit"
          ? { balance_payment_mode: item.balance_payment_mode || "manual" }
          : null,
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
      const attendeeKey = `${item.event_ticket_type_id}::${item.purchase_type}`;
      const attendeesForTicket = requestData.attendees_by_ticket?.[attendeeKey] || [];

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
              purchase_type: item.purchase_type,
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
          price_tier_id: item.price_tier_id ?? null,
          details: item.selected_size
            ? { size: item.selected_size, purchase_type: item.purchase_type, balance_payment_mode: item.balance_payment_mode }
            : item.event_ticket_type_id
              ? { event_ticket: "true", purchase_type: item.purchase_type, balance_payment_mode: item.balance_payment_mode }
              : { purchase_type: item.purchase_type },
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
