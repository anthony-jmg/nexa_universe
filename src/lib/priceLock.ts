import { supabase } from './supabase';
import { createStripeCheckout } from './stripe';

export interface PriceLockSummary {
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  currentPrice: number;
  nextPrice: number;
  priceIncreaseDate: string;
  depositAmount: number;
  minimumDeposit: number;
  lockedPrice: number;
  guaranteeEndDate: string;
  remainingAmount: number;
}

export interface PriceLockRecord {
  id: string;
  event_id: string;
  event_ticket_type_id: string;
  locked_price: number;
  deposit_amount: number;
  total_paid: number;
  remaining_amount: number;
  expires_at: string;
  status: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const formatPrice = (value: number) => `${Math.round(value)} €`;

export const formatDateFr = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

interface TicketTypeRow {
  id: string;
  event_id: string;
  price_lock_enabled: boolean;
  price_lock_deposit_amount: number;
  price_lock_guarantee_days: number;
  price_lock_opens_at: string | null;
  quantity_available: number | null;
  quantity_sold: number;
  is_active: boolean;
  sale_start_date: string | null;
  sale_end_date: string | null;
  ticket_type: { name: string };
  price_tiers: Array<{ label: string; price: number | string; starts_at: string; ends_at: string | null }>;
  event: { is_test: boolean } | null;
}

interface PricingTier {
  label: string;
  price: number;
  starts_at: Date;
  ends_at: Date | null;
}

const resolveTiers = (rows: TicketTypeRow['price_tiers']): PricingTier[] =>
  rows
    .map(t => ({
      label: t.label,
      price: Number(t.price),
      starts_at: new Date(t.starts_at),
      ends_at: t.ends_at ? new Date(t.ends_at) : null,
    }))
    .sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());

const activeTier = (tiers: PricingTier[], now: number): PricingTier | null =>
  [...tiers].reverse().find(
    t => t.starts_at.getTime() <= now && (!t.ends_at || t.ends_at.getTime() > now)
  ) ?? null;

const nextTier = (tiers: PricingTier[], now: number): PricingTier | null =>
  tiers.find(t => t.starts_at.getTime() > now) ?? null;

/**
 * Recharge les données réelles du billet (event_ticket_types) côté base
 * au moment d'ouvrir la modal : prix du palier actif, prochain palier,
 * versement, dates et disponibilité. Aucun montant codé en dur.
 */
export async function fetchPriceLockSummary(
  eventId: string,
  eventTitle: string,
  ticketTypeId: string
): Promise<PriceLockSummary | { error: string }> {
  const { data, error } = await supabase
    .from('event_ticket_types')
    .select(`
      id,
      event_id,
      sale_start_date,
      sale_end_date,
      price_lock_enabled,
      price_lock_deposit_amount,
      price_lock_guarantee_days,
      price_lock_opens_at,
      quantity_available,
      quantity_sold,
      is_active,
      ticket_type:ticket_types(name),
      price_tiers:event_ticket_price_tiers(label, price, starts_at, ends_at),
      event:events(is_test)
    `)
    .eq('id', ticketTypeId)
    .maybeSingle();

  if (error || !data) {
    return { error: 'Billet introuvable. Actualise la page et réessaie.' };
  }

  const ett = data as unknown as TicketTypeRow;
  const now = Date.now();
  const tiers = resolveTiers(ett.price_tiers || []);
  const current = activeTier(tiers, now);
  const next = nextTier(tiers, now);

  if (!ett.is_active) {
    return { error: 'Ce billet n’est plus disponible à la vente.' };
  }
  if (!ett.price_lock_enabled) {
    return { error: 'Le Price Lock n’est pas disponible pour ce billet.' };
  }
  if (!current) {
    return { error: 'Aucun tarif actif pour ce billet actuellement.' };
  }
  if (!next) {
    return { error: 'Aucune hausse tarifaire programmée pour ce billet.' };
  }

  const opensAt = ett.price_lock_opens_at
    ? new Date(ett.price_lock_opens_at)
    : new Date(next.starts_at.getTime() - 10 * DAY_MS);

  if (now < opensAt.getTime()) {
    return { error: 'Le Price Lock n’est pas encore ouvert pour ce billet.' };
  }
  if (now >= next.starts_at.getTime()) {
    return { error: 'Le Price Lock est fermé : la hausse tarifaire est déjà passée.' };
  }

  if (ett.quantity_available !== null) {
    const { count, error: countError } = await supabase
      .from('price_locks')
      .select('id', { count: 'exact', head: true })
      .eq('event_ticket_type_id', ticketTypeId)
      .eq('status', 'active');
    if (!countError && ett.quantity_sold + (count ?? 0) >= ett.quantity_available) {
      return { error: 'Le quota Price Lock est épuisé pour ce billet.' };
    }
  }

  const depositAmount = ett.price_lock_deposit_amount;
  const isTestEvent = ett.event?.is_test ?? false;
  // Minimum fonctionnel : 20 € pour les événements publics, montant configuré pour les événements test.
  const minDeposit = isTestEvent ? depositAmount : Math.max(depositAmount, 20);
  // Expiration : prochaine hausse + garantie, plafonnée à la fin de vente.
  const guaranteedEnd = new Date(next.starts_at.getTime() + ett.price_lock_guarantee_days * DAY_MS);
  const saleEnd = ett.sale_end_date ? new Date(ett.sale_end_date) : null;
  const guaranteeEnd = saleEnd && saleEnd < guaranteedEnd ? saleEnd : guaranteedEnd;

  return {
    eventId,
    eventTitle,
    ticketTypeId: ett.id,
    ticketTypeName: ett.ticket_type?.name ?? 'Billet',
    currentPrice: current.price,
    nextPrice: next.price,
    priceIncreaseDate: next.starts_at.toISOString(),
    depositAmount: minDeposit,
    minimumDeposit: minDeposit,
    lockedPrice: current.price,
    guaranteeEndDate: guaranteeEnd.toISOString(),
    remainingAmount: Math.max(0, current.price - minDeposit),
  };
}

/**
 * Démarre le paiement Stripe du premier versement Price Lock.
 * chosenAmount : montant librement choisi par l'utilisateur (>= minimum,
 * < prix bloqué) — revalidé côté serveur avant la création de la session.
 * Le lock n'est PAS créé ici : il sera créé par le backend uniquement
 * après confirmation réelle du paiement (webhook / verify-payment).
 */
export async function startPriceLockDepositCheckout(
  summary: PriceLockSummary,
  chosenAmount?: number
): Promise<string> {
  const deposit = chosenAmount ?? summary.minimumDeposit;
  const origin = window.location.origin;
  return createStripeCheckout({
    payment_type: 'price_lock_deposit',
    items: [{
      id: summary.ticketTypeId,
      name: `Price Lock — ${summary.eventTitle} (${summary.ticketTypeName})`,
      price: deposit,
      quantity: 1,
    }],
    metadata: {
      event_id: summary.eventId,
      event_ticket_type_id: summary.ticketTypeId,
      target_id: summary.ticketTypeId,
      payment_type: 'price_lock_deposit',
      selected_deposit_amount: String(deposit),
    },
    success_url: `${origin}/shop?price_lock=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/shop?price_lock=cancelled`,
  });
}

export async function fetchUserPriceLock(
  ticketTypeId: string
): Promise<PriceLockRecord | null> {
  // Règle métier : un seul Price Lock actif par utilisateur et par ÉVÉNEMENT,
  // tous types de billets confondus. On récupère d'abord l'event_id du billet,
  // puis on cherche un lock actif sur cet événement (pas seulement ce billet).
  const { data: ett } = await supabase
    .from('event_ticket_types')
    .select('event_id')
    .eq('id', ticketTypeId)
    .maybeSingle();

  if (!ett) return null;

  const { data } = await supabase
    .from('price_locks')
    .select('id, event_id, event_ticket_type_id, locked_price, deposit_amount, total_paid, remaining_amount, expires_at, status')
    .eq('event_id', ett.event_id)
    .eq('status', 'active')
    .maybeSingle();
  return (data as unknown as PriceLockRecord) ?? null;
}

export async function fetchPriceLockById(lockId: string): Promise<PriceLockRecord | null> {
  const { data } = await supabase
    .from('price_locks')
    .select('id, event_id, event_ticket_type_id, locked_price, deposit_amount, total_paid, remaining_amount, expires_at, status')
    .eq('id', lockId)
    .maybeSingle();
  return (data as unknown as PriceLockRecord) ?? null;
}

/**
 * Démarre le paiement du solde Price Lock (UNE seule fois, montant exact).
 * Le montant affiché est relu depuis le lock ; côté serveur, la fonction de
 * checkout ignore le montant transmis et facture price_locks.remaining_amount.
 */
export async function startPriceLockBalanceCheckout(lock: PriceLockRecord): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Vous devez être connecté.');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/create-stripe-checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      payment_type: 'price_lock_balance',
      items: [{
        id: lock.id,
        name: 'Solde Price Lock',
        price: Number(lock.remaining_amount),
        quantity: 1,
      }],
      metadata: {
        price_lock_id: lock.id,
        target_id: lock.id,
        payment_type: 'price_lock_balance',
      },
      success_url: `${window.location.origin}/my-purchases?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${window.location.origin}/my-purchases?payment=cancelled`,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data?.url) {
    throw new Error(data?.error || 'Impossible de démarrer le paiement du solde.');
  }
  return data.url;
}

/**
 * Vérifie auprès de Stripe (fonction verify-payment existante) que le paiement
 * du versement Price Lock est réellement confirmé, puis recharge le lock créé.
 * Retourne null tant que le lock n'existe pas côté base (paiement non confirmé).
 */
export async function verifyPriceLockPayment(sessionId: string): Promise<PriceLockRecord | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/verify-payment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (!data?.success || !data?.price_lock_id) return null;

  return fetchPriceLockById(data.price_lock_id);
}

