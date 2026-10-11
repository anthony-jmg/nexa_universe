import { Database } from './database.types';

/**
 * Logique centrale de prix côté client : toutes les pages lisent les prix
 * via ces helpers (alignés sur la fonction base get_event_ticket_pricing).
 * Le prix facturé reste systématiquement relu côté serveur au checkout.
 */

type EttRow = Database['public']['Tables']['event_ticket_types']['Row'];

export interface TierLike {
  label?: string | null;
  price?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface PricingLike {
  current_tier_id?: string | null;
  current_tier_label?: string | null;
  current_price?: number | null;
  next_tier_id?: string | null;
  next_price?: number | null;
  next_price_change_at?: string | null;
  price_lock_enabled?: boolean | null;
  price_lock_deposit_amount?: number | null;
  price_lock_opens_at?: string | null;
  price_lock_expiration_basis?: string | null;
}

// Paliers enrichis rattachés à un event_ticket_type par les selects frontend
export type EttWithPricing = EttRow & {
  price_tiers?: TierLike[];
  current_tier_id?: string | null;
  current_tier_label?: string | null;
  current_price?: number | null;
  next_tier_id?: string | null;
  next_price?: number | null;
  next_price_change_at?: string | null;
  price_lock_expiration_basis?: string | null;
};

/** Palier actif d'un billet : dernier starts_at <= now non terminé. */
export function resolveActiveTier(ett: EttWithPricing): TierLike | null {
  const now = Date.now();
  const tiers = (ett.price_tiers || [])
    .filter(t => t.starts_at && new Date(t.starts_at).getTime() <= now)
    .filter(t => !t.ends_at || new Date(t.ends_at).getTime() > now)
    .sort((a, b) => new Date(b.starts_at!).getTime() - new Date(a.starts_at!).getTime());
  return tiers[0] ?? null;
}

/** Prochain palier : premier starts_at > now. */
export function resolveNextTier(ett: EttWithPricing): TierLike | null {
  const now = Date.now();
  const tiers = (ett.price_tiers || [])
    .filter(t => t.starts_at && new Date(t.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime());
  return tiers[0] ?? null;
}

/** Prix courant affichable : palier actif, sinon fallback legacy dérivé. */
export function currentPrice(ett: EttWithPricing): number {
  return Number(resolveActiveTier(ett)?.price ?? ett.price ?? 0);
}

/** Prochain prix affichable (null = ne pas afficher de hausse). */
export function nextPrice(ett: EttWithPricing): number | null {
  return resolveNextTier(ett)?.price != null ? Number(resolveNextTier(ett)!.price) : null;
}

/** Prochaine date de hausse (null = ne pas afficher). */
export function nextPriceChangeAt(ett: EttWithPricing): Date | null {
  const t = resolveNextTier(ett);
  return t?.starts_at ? new Date(t.starts_at) : null;
}

/**
 * Base d'expiration Price Lock : prochain palier + garantie, plafonnée fin
 * de vente. Retourne null si aucune hausse future (pas d'affichage).
 */
export function priceLockDeadline(ett: EttWithPricing): Date | null {
  const next = resolveNextTier(ett);
  if (!next?.starts_at) return null;
  const guaranteed = new Date(
    new Date(next.starts_at).getTime() + (ett.price_lock_guarantee_days ?? 30) * 86400000
  );
  const saleEnd = ett.sales_end_date ? new Date(ett.sales_end_date) : null;
  if (saleEnd && saleEnd < guaranteed) return saleEnd;
  return guaranteed;
}

/** Fenêtre d'ouverture Price Lock : price_lock_opens_at, sinon 10 jours avant la prochaine hausse. */
export function priceLockOpensAt(ett: EttWithPricing): Date | null {
  if (ett.price_lock_opens_at) return new Date(ett.price_lock_opens_at);
  const next = resolveNextTier(ett);
  return next?.starts_at ? new Date(new Date(next.starts_at).getTime() - 10 * 86400000) : null;
}

/**
 * Price Lock disponible : activé ET hausse future ET fenêtre d'ouverture
 * atteinte (aligné sur fetchPriceLockSummary, sinon le badge promet un lock
 * que la modal refuse).
 */
export function priceLockAvailable(ett: EttWithPricing): boolean {
  const opensAt = priceLockOpensAt(ett);
  const next = resolveNextTier(ett);
  return Boolean(
    ett.is_active &&
    ett.price_lock_enabled &&
    next &&
    opensAt &&
    Date.now() >= opensAt.getTime() &&
    Date.now() < new Date(next.starts_at!).getTime()
  );
}

/** Prix minimum "à partir de" sur une carte événement. */
export function minEventPrice(event: { event_ticket_types?: EttWithPricing[] }): number | null {
  const active = (event.event_ticket_types || []).filter(ett => ett.is_active);
  if (active.length === 0) return null;
  return Math.min(...active.map(ett => currentPrice(ett)));
}

/**
 * Prochain tarif "à partir de" pour une carte : uniquement si tous les
 * billets actifs partagent le même prochain palier (même prix et même date).
 * Sinon null (ne pas inventer de hausse unique, renvoyer vers la fiche).
 */
export function minNextEventPrice(event: { event_ticket_types?: EttWithPricing[] }): { price: number; changeAt: Date } | null {
  const active = (event.event_ticket_types || []).filter(ett => ett.is_active);
  if (active.length === 0) return null;

  const nexts = active.map(ett => {
    const next = resolveNextTier(ett);
    return next && next.price != null && next.starts_at
      ? { price: Number(next.price), changeAt: new Date(next.starts_at) }
      : null;
  });

  if (nexts.some(n => n === null)) return null;

  const first = nexts[0]!;
  const consistent = nexts.every(
    n => n!.price === first.price && n!.changeAt.getTime() === first.changeAt.getTime()
  );
  return consistent ? { price: first.price, changeAt: first.changeAt } : null;
}
