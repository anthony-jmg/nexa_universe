import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.6.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Événement annulé : aucun nouvel achat ni Price Lock (traduit côté frontend).
const EVENT_CANCELLED_ERROR = 'Cet événement a été annulé. Aucun nouvel achat ou Price Lock n’est possible.';

// Durée de vie d'une session Stripe de commande panier (minimum Stripe : 30 min).
const ORDER_CHECKOUT_TTL_SECONDS = 32 * 60;

function validateCheckoutRequest(data: any): string[] {
  const errors: string[] = [];

  if (!data.payment_type) {
    errors.push('payment_type is required');
  } else if (!'order,video,program,professor_subscription,price_lock_deposit,price_lock_balance,price_lock_repurchase'.split(',').includes(data.payment_type)) {
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
  payment_type: (typeof VALID_PAYMENT_TYPES)[number];
  items: CheckoutItem[];
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  price_id?: string;
  locale?: string;
}

interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  metadata?: Record<string, string>;
}

// Price Lock : paiement du solde — le montant est TOUJOURS relu depuis la ligne
// réelle du lock (price_locks.remaining_amount). Le client ne transmet qu'un
// identifiant de lock ; le montant de la requête est ignoré.
async function resolvePriceLockBalance(
  supabase: any,
  userId: string,
  lockId: string
): Promise<{ error?: string; name?: string; amount?: number }> {
  if (!lockId) return { error: 'Price Lock introuvable.' };

  const { data: lock } = await supabase
    .from('price_locks')
    .select('id, user_id, event_id, status, expires_at, remaining_amount, locked_price, deposit_amount, event_ticket_type_id, auto_balance_payment_status, auto_balance_debit_attempted_at, ticket_type:event_ticket_types(ticket_type:ticket_types(name))')
    .eq('id', lockId)
    .maybeSingle();

  if (!lock) return { error: 'Price Lock introuvable.' };
  if (lock.user_id !== userId) return { error: 'Ce Price Lock ne vous appartient pas.' };
  if (lock.status !== 'active') return { error: 'Ce Price Lock n\u2019est plus actif.' };
  // Événement annulé : aucun paiement du solde (record_price_lock_payment refuse aussi).
  const { data: event } = await supabase
    .from('events')
    .select('event_status')
    .eq('id', lock.event_id)
    .maybeSingle();
  if (event?.event_status === 'cancelled') {
    return { error: 'Cet événement a été annulé : le solde ne peut plus être payé.' };
  }
  // Date limite dépassée : l'ancien tarif n'est plus garanti, même avant le
  // passage du cron d'expiration (record_price_lock_payment refuse aussi).
  if (lock.expires_at && new Date(lock.expires_at).getTime() <= Date.now()) {
    return { error: 'Ce Price Lock a expiré : ton ancien tarif n\u2019est plus garanti.' };
  }
  // Débit automatique en cours : pas de second paiement en parallèle.
  if (
    lock.auto_balance_payment_status === 'processing' &&
    lock.auto_balance_debit_attempted_at &&
    Date.now() - new Date(lock.auto_balance_debit_attempted_at).getTime() < 2 * 60 * 60 * 1000
  ) {
    return { error: 'Le prélèvement automatique de ce solde est en cours. Réessaie dans quelques minutes.' };
  }

  const remaining = Number(lock.remaining_amount);
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { error: 'Aucun solde restant sur ce Price Lock.' };
  }

  const ticketName = (lock as any).ticket_type?.ticket_type?.name || 'Billet';
  return {
    name: `Solde Price Lock — ${ticketName}`,
    amount: remaining,
  };
}

const REPURCHASE_REFUSALS: Record<string, string> = {
  not_expired: 'Ce Price Lock n\u2019est pas expiré.',
  consumed: 'Le versement de ce Price Lock a déjà été utilisé.',
  refunded: 'Le versement de ce Price Lock a été remboursé.',
  unavailable: 'Ce pass n\u2019est plus disponible à la vente.',
  sales_closed: 'Les ventes de ce pass sont terminées.',
  sold_out: 'Ce pass est complet pour le moment.',
  contact_us: 'Contacte-nous pour finaliser ton pass.',
};

// Price Lock expiré : rachat au prix public actuel, versement déjà payé déduit.
// Montant et éligibilité TOUJOURS calculés côté base (get_price_lock_repurchase_quote) ;
// le crédit n'est consommé qu'au paiement confirmé (consume_price_lock_credit).
async function resolvePriceLockRepurchase(
  supabase: any,
  userId: string,
  lockId: string | undefined
): Promise<{ error?: string; name?: string; amount?: number }> {
  if (!lockId || !UUID_REGEX.test(lockId)) return { error: 'Price Lock introuvable.' };

  const { data: quote, error } = await supabase.rpc('get_price_lock_repurchase_quote', {
    p_lock_id: lockId,
    p_user_id: userId,
  });
  if (error || !quote) return { error: 'Price Lock introuvable.' };
  if (quote.status !== 'available') {
    return { error: REPURCHASE_REFUSALS[quote.status] ?? 'Achat impossible pour ce Price Lock.' };
  }

  const amount = Number(quote.amount_due);
  // Stripe : 0,50 € minimum.
  if (!Number.isFinite(amount) || amount < 0.5) {
    return { error: REPURCHASE_REFUSALS.contact_us };
  }

  const { data: ett } = await supabase
    .from('event_ticket_types')
    .select('ticket_types(name), events(title)')
    .eq('id', quote.event_ticket_type_id)
    .maybeSingle();
  const ticketName = (ett as any)?.ticket_types?.name || 'Billet';
  const eventTitle = (ett as any)?.events?.title;
  return {
    name: `${eventTitle ? `${eventTitle} — ` : ''}${ticketName} (versement Price Lock déduit)`,
    amount,
  };
}

// Price Lock : premier versement — montant ET règles TOUJOURS fixés côté serveur.
// Si l'utilisateur a choisi un montant (selected_deposit_amount en metadata),
// la fonction SQL create_stripe_price_lock_deposit le revalide intégralement
// (minimum 20 €, < prix bloqué, fenêtre, quota, limites). Sinon, repli exact
// sur le dépôt fixe configuré du billet (comportement historique).
async function resolvePriceLockDeposit(
  supabase: any,
  userId: string,
  ticketTypeId: string,
  selectedDepositAmount?: number | null
): Promise<{ error?: string; name?: string; amount?: number; selected?: number | null }> {
  if (!ticketTypeId) return { error: 'Billet introuvable pour le Price Lock.' };

  const [{ data: ett }, { data: pricing, error: pricingError }] = await Promise.all([
    supabase
      .from('event_ticket_types')
      .select('id, price, price_lock_enabled, price_lock_deposit_amount, price_increase_date, price_lock_opens_at, is_active, event_id, quantity_available, quantity_sold, ticket_type:ticket_types(name), event:events(event_status)')
      .eq('id', ticketTypeId)
      .maybeSingle(),
    supabase
      .rpc('get_event_ticket_pricing', { p_event_ticket_type_id: ticketTypeId })
      .maybeSingle(),
  ]);

  if (!ett) return { error: 'Billet introuvable pour le Price Lock.' };
  // Événement annulé : aucun nouveau Price Lock, aucune session Stripe.
  if (ett.event?.event_status === 'cancelled') return { error: EVENT_CANCELLED_ERROR };
  if (!ett.is_active) return { error: 'Ce billet n’est plus disponible à la vente.' };
  if (!ett.price_lock_enabled) return { error: 'Price Lock non disponible pour ce billet.' };
  if (!ett.price_increase_date) return { error: 'Aucune hausse tarifaire programmée pour ce billet.' };

  if (pricingError) return { error: 'Impossible de déterminer le tarif actuel.' };
  if (!pricing || pricing.current_price == null) {
    return { error: 'Aucun tarif actif pour ce billet. Contacte le support.' };
  }

  const now = Date.now();
  const increaseAt = new Date(ett.price_increase_date).getTime();
  const opensAt = ett.price_lock_opens_at
    ? new Date(ett.price_lock_opens_at).getTime()
    : increaseAt - 10 * 24 * 60 * 60 * 1000;

  if (now < opensAt) return { error: 'Le Price Lock n’est pas encore ouvert pour ce billet.' };
  if (now >= increaseAt) return { error: 'Price Lock fermé pour ce billet : la hausse est déjà passée.' };

  // Un seul Price Lock actif par utilisateur et par ÉVÉNEMENT (tous billets confondus)
  const [{ count: sameEvent }, { count: activeLocks }] = await Promise.all([
    supabase
      .from('price_locks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_id', ett.event_id)
      .eq('status', 'active'),
    supabase
      .from('price_locks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active'),
  ]);
  if ((sameEvent ?? 0) > 0) {
    return { error: 'Tu as déjà un Price Lock actif pour ce festival.' };
  }

  // Max 2 Price Locks actifs simultanément par utilisateur
  if ((activeLocks ?? 0) >= 2) {
    return { error: 'Maximum 2 Price Locks actifs simultanément.' };
  }

  // Quota : quantity_sold + locks actifs < quantity_available
  if (ett.quantity_available !== null && ett.quantity_available !== undefined) {
    const { count: locksForType } = await supabase
      .from('price_locks')
      .select('id', { count: 'exact', head: true })
      .eq('event_ticket_type_id', ticketTypeId)
      .eq('status', 'active');
    if (ett.quantity_sold + (locksForType ?? 0) >= ett.quantity_available) {
      return { error: 'Quota Price Lock épuisé pour ce billet.' };
    }
  }

  const ticketName = (ett as any).ticket_type?.name || 'Billet';

  // Montant choisi par l'utilisateur : revalidation serveur via fonction SQL dédiée.
  if (selectedDepositAmount != null) {
    const { data: validated, error: validateError } = await supabase.rpc(
      'create_stripe_price_lock_deposit',
      { p_user_id: userId, p_ticket_type_id: ticketTypeId, p_amount: selectedDepositAmount }
    );
    if (validateError || typeof validated !== 'number') {
      return { error: validateError?.message || 'Le versement choisi n’est pas valide pour ce Price Lock.' };
    }
    return {
      name: `Price Lock — ${ticketName}`,
      amount: validated,
      selected: validated,
    };
  }

  return {
    name: `Price Lock — ${ticketName}`,
    amount: Number(ett.price_lock_deposit_amount),
    selected: null,
  };
}

type ResolvedItems = { error?: string; items?: CheckoutItem[] };

// Commande panier : les lignes facturées sont TOUJOURS relues depuis
// order_items (prix validés par validate-and-create-order). Les prix envoyés
// par le client sont ignorés.
async function resolveOrderItems(
  supabase: any,
  userId: string,
  orderId: string | undefined
): Promise<ResolvedItems & { hasAutoBalance?: boolean }> {
  if (!orderId || !UUID_REGEX.test(orderId)) return { error: 'Commande introuvable.' };

  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, status, total_amount, expires_at')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || order.user_id !== userId) return { error: 'Commande introuvable.' };
  if (order.status !== 'pending') return { error: 'Cette commande n’est plus en attente de paiement.' };
  if (order.expires_at && new Date(order.expires_at).getTime() <= Date.now()) {
    return { error: 'Cette commande a expiré. Recommence ta commande.' };
  }

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('id, product_id, event_ticket_type_id, quantity, unit_price, purchase_type, details')
    .eq('order_id', orderId);

  if (!orderItems || orderItems.length === 0) return { error: 'Commande vide.' };

  const productIds = orderItems.map((i: any) => i.product_id).filter(Boolean);
  const ticketTypeIds = orderItems.map((i: any) => i.event_ticket_type_id).filter(Boolean);
  const [{ data: products }, { data: ticketTypes }] = await Promise.all([
    productIds.length
      ? supabase.from('products').select('id, name').in('id', productIds)
      : Promise.resolve({ data: [] }),
    ticketTypeIds.length
      ? supabase
          .from('event_ticket_types')
          .select('id, ticket_types(name), events(title, event_status)')
          .in('id', ticketTypeIds)
      : Promise.resolve({ data: [] }),
  ]);
  // Événement annulé depuis la création de la commande : aucune session Stripe.
  if ((ticketTypes || []).some((t) => t.events?.event_status === 'cancelled')) {
    return { error: EVENT_CANCELLED_ERROR };
  }
  const productNames = new Map((products || []).map((p: any) => [p.id, p.name]));
  const ticketNames = new Map(
    (ticketTypes || []).map((t: any) => [
      t.id,
      `${t.events?.title ?? 'Event'} - ${t.ticket_types?.name ?? 'Ticket'}`,
    ])
  );

  // Les lignes gratuites ne sont pas envoyées à Stripe (minimum 1 centime par
  // ligne), sinon le montant encaissé ne correspondrait plus au total.
  const paidItems = orderItems.filter((item: any) => Number(item.unit_price) > 0);
  if (paidItems.length === 0) return { error: 'Aucun article payant dans cette commande.' };

  const items: CheckoutItem[] = paidItems.map((item: any) => {
    const isDeposit = item.purchase_type === 'price_lock_deposit';
    const baseName = item.product_id
      ? productNames.get(item.product_id) ?? 'Article'
      : ticketNames.get(item.event_ticket_type_id) ?? 'Billet';
    return {
      id: item.product_id || item.event_ticket_type_id || item.id,
      name: isDeposit ? `Price Lock — ${baseName}` : baseName,
      price: Number(item.unit_price),
      quantity: item.quantity,
    };
  });

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (Math.abs(total - Number(order.total_amount)) >= 0.01) {
    console.error(`Order ${orderId}: items total ${total} != order total ${order.total_amount}`);
    return { error: 'Montant de la commande incohérent. Recommence ta commande.' };
  }

  const hasAutoBalance = orderItems.some(
    (item: any) =>
      item.purchase_type === 'price_lock_deposit' &&
      item.details?.balance_payment_mode === 'automatic'
  );

  return { items, hasAutoBalance };
}

async function resolveVideoItem(supabase: any, videoId: string | undefined): Promise<ResolvedItems> {
  if (!videoId || !UUID_REGEX.test(videoId)) return { error: 'Vidéo introuvable.' };

  const { data: video } = await supabase
    .from('videos')
    .select('id, title, price, visibility')
    .eq('id', videoId)
    .maybeSingle();

  if (!video) return { error: 'Vidéo introuvable.' };
  const price = Number(video.price);
  if (video.visibility !== 'paid' || !Number.isFinite(price) || price <= 0) {
    return { error: 'Cette vidéo n’est pas en vente.' };
  }

  return { items: [{ id: video.id, name: video.title || 'Vidéo', price, quantity: 1 }] };
}

// Programme : prix de base relu en base, remise abonné appliquée uniquement si
// l'abonnement actif au professeur est vérifié côté serveur.
async function resolveProgramItem(
  supabase: any,
  userId: string,
  programId: string | undefined
): Promise<ResolvedItems> {
  if (!programId || !UUID_REGEX.test(programId)) return { error: 'Programme introuvable.' };

  const { data: program } = await supabase
    .from('programs')
    .select('id, title, price, is_active, professor_id')
    .eq('id', programId)
    .maybeSingle();

  if (!program || program.is_active === false) return { error: 'Programme introuvable.' };
  let price = Number(program.price);
  if (!Number.isFinite(price) || price <= 0) return { error: 'Ce programme n’est pas en vente.' };

  if (program.professor_id) {
    const [{ data: subscription }, { data: professor }] = await Promise.all([
      supabase
        .from('professor_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('professor_id', program.professor_id)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('professors')
        .select('subscriber_discount_percentage')
        .eq('id', program.professor_id)
        .maybeSingle(),
    ]);
    const discount = Number(professor?.subscriber_discount_percentage ?? 0);
    if (subscription && discount > 0 && discount <= 100) {
      price = price * (1 - discount / 100);
    }
  }

  return {
    items: [{ id: program.id, name: program.title || 'Programme', price: Math.round(price * 100) / 100, quantity: 1 }],
  };
}

async function resolveProfessorSubscriptionItem(
  supabase: any,
  professorId: string | undefined
): Promise<ResolvedItems> {
  if (!professorId || !UUID_REGEX.test(professorId)) return { error: 'Professeur introuvable.' };

  const [{ data: professor }, { data: profile }] = await Promise.all([
    supabase.from('professors').select('id, subscription_price').eq('id', professorId).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', professorId).maybeSingle(),
  ]);

  if (!professor) return { error: 'Professeur introuvable.' };
  const price = Number(professor.subscription_price);
  if (!Number.isFinite(price) || price <= 0) return { error: 'Abonnement indisponible pour ce professeur.' };

  return {
    items: [{
      id: professor.id,
      name: `Abonnement mensuel — ${profile?.full_name || 'Professeur'}`,
      price,
      quantity: 1,
    }],
  };
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

    const requestData: CheckoutRequest = await req.json();

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

    const { payment_type, success_url, cancel_url, metadata = {} } = requestData;
    // Langue de la page Stripe = langue active du site (FR / EN) ; sinon 'auto'.
    const checkoutLocale: "fr" | "en" | "auto" =
      requestData.locale === "fr" || requestData.locale === "en" ? requestData.locale : "auto";

    // Tous les montants facturés sont recalculés côté serveur : les prix et
    // price_id envoyés par le client sont ignorés.
    let resolvedItems: CheckoutItem[] = [];
    let hasPriceLockAutoBalance = false;
    // Metadata posée par le serveur (jamais écrasable par la requête client).
    const serverMetadata: Record<string, string> = {};
    if (payment_type === 'price_lock_repurchase') {
      const lockId = metadata.price_lock_id || metadata.target_id;
      const resolved = await resolvePriceLockRepurchase(supabase, user.id, lockId);
      if (resolved.error) {
        return new Response(
          JSON.stringify({ error: resolved.error }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      serverMetadata.price_lock_id = lockId!;
      serverMetadata.repurchase_amount = resolved.amount!.toFixed(2);
      resolvedItems = [{
        id: lockId!,
        name: resolved.name!,
        price: resolved.amount!,
        quantity: 1,
      }];
    } else if (payment_type === 'price_lock_deposit') {
      const ticketTypeId = metadata.event_ticket_type_id || metadata.target_id;
      // Montant choisi par l'utilisateur : jamais lu depuis le panier, uniquement
      // depuis la metadata dédiée puis revalidé côté base (minimum, plafond).
      const rawSelected = (metadata as Record<string, any>).selected_deposit_amount;
      const parsedSelected = rawSelected != null ? Number(rawSelected) : null;
      const selectedDepositAmount =
        parsedSelected != null && Number.isFinite(parsedSelected) && parsedSelected > 0
          ? parsedSelected
          : null;
      const resolved = await resolvePriceLockDeposit(supabase, user.id, ticketTypeId, selectedDepositAmount);
      if (resolved.error) {
        return new Response(
          JSON.stringify({ error: resolved.error }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      resolvedItems = [{
        id: ticketTypeId!,
        name: resolved.name!,
        price: resolved.amount!,
        quantity: 1,
      }];
    } else if (payment_type === 'price_lock_balance') {
      const lockId = metadata.price_lock_id || metadata.target_id;
      const resolved = await resolvePriceLockBalance(supabase, user.id, lockId);
      if (resolved.error) {
        return new Response(
          JSON.stringify({ error: resolved.error }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      resolvedItems = [{
        id: lockId!,
        name: resolved.name!,
        price: resolved.amount!,
        quantity: 1,
      }];
    } else {
      let resolved: ResolvedItems & { hasAutoBalance?: boolean };
      if (payment_type === 'order') {
        resolved = await resolveOrderItems(supabase, user.id, metadata.order_id);
      } else if (payment_type === 'video') {
        resolved = await resolveVideoItem(supabase, metadata.video_id);
      } else if (payment_type === 'program') {
        resolved = await resolveProgramItem(supabase, user.id, metadata.target_id);
      } else {
        resolved = await resolveProfessorSubscriptionItem(supabase, metadata.professor_id);
      }
      if (resolved.error || !resolved.items) {
        return new Response(
          JSON.stringify({ error: resolved.error || 'Paiement impossible.' }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      resolvedItems = resolved.items;
      hasPriceLockAutoBalance = resolved.hasAutoBalance === true;
    }

    // Resolve professor's Stripe Connect account for direct payouts
    let professorConnectAccountId: string | null = null;
    let platformFeePercentage = 20;

    if (["video", "program", "professor_subscription"].includes(payment_type)) {
      // Le professeur bénéficiaire est toujours déduit du contenu acheté,
      // jamais d'un professor_id fourni par le client.
      let professorId = payment_type === "professor_subscription" ? metadata.professor_id : undefined;

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

    const isSubscription = payment_type === "professor_subscription";

    let session;
    let totalAmount: number;

    // user_id / payment_type posés APRÈS la metadata client : jamais écrasables.
    const sessionMetadata = {
      ...metadata,
      ...serverMetadata,
      user_id: user.id,
      payment_type,
    };

    if (isSubscription) {
      totalAmount = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const subscriptionTransferData = professorConnectAccountId
        ? { transfer_data: { destination: professorConnectAccountId, amount_percent: (100 - platformFeePercentage) } }
        : {};

      const item = resolvedItems[0];
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
              },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        locale: checkoutLocale,
        success_url,
        cancel_url,
        metadata: sessionMetadata,
        subscription_data: {
          metadata: sessionMetadata,
          ...subscriptionTransferData,
        },
      });
    } else {
      const lineItems = resolvedItems.map((item) => {
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

      totalAmount = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
        locale: checkoutLocale,
        success_url,
        cancel_url,
        metadata: sessionMetadata,
        // Commande panier : la session expire avant la commande (orders.expires_at
        // = création + 1 h), pour qu'aucun paiement n'arrive sur une commande
        // annulée par cancel_expired_orders. Stripe impose au moins 30 min.
        // Rachat Price Lock : prix public figé au plus 32 min (minimum Stripe 30).
        ...(payment_type === "order" || payment_type === "price_lock_repurchase"
          ? { expires_at: Math.floor(Date.now() / 1000) + ORDER_CHECKOUT_TTL_SECONDS }
          : {}),
        // Price Lock en prélèvement automatique : le moyen de paiement est
        // sauvegardé (référence Stripe uniquement) pour le débit du solde.
        // Le mode est relu depuis order_items, pas depuis la requête client.
        ...(payment_type === "order" && hasPriceLockAutoBalance
          ? { payment_intent_data: { setup_future_usage: "off_session" as const } }
          : {}),
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
      expires_at: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
