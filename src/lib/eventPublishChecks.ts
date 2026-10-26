// Contrôles de cohérence d'un festival avant publication (Admin → Événements).
// Bloquants au passage en « Publié » ; simples avertissements en brouillon.

export interface PublishCheckTier {
  label: string;
  price: number;
  starts_at: string;
  ends_at: string;
  _delete?: boolean;
}

export interface PublishCheckTicket {
  name: string;
  is_active: boolean;
  quantity_available: number | null;
  sale_end_date: string;
  price_lock_enabled: boolean;
  price_lock_deposit_amount: number;
  price_lock_opens_at: string;
  tiers: PublishCheckTier[];
}

export interface PublishCheckEvent {
  start_date: string;
  end_date: string;
  is_test: boolean;
}

export interface PublishCheckResult {
  /** Configurations impossibles à acheter ou incompatibles avec le Price Lock. */
  errors: string[];
  /** Points à confirmer (ex. stock illimité). */
  warnings: string[];
}

// Minimum global du versement Price Lock côté base (hors événements de test).
export const PRICE_LOCK_MIN_DEPOSIT = 20;

export const UNLIMITED_STOCK_WARNING = 'Stock non renseigné : ce pass sera considéré comme illimité.';

const time = (value: string): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

export function checkEventForPublication(
  event: PublishCheckEvent,
  tickets: PublishCheckTicket[],
  now: Date = new Date()
): PublishCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nowMs = now.getTime();
  const start = time(event.start_date);
  const end = time(event.end_date);

  if (start == null) {
    errors.push('La date de début de l’événement est requise.');
  } else {
    if (start <= nowMs) errors.push('L’événement a déjà commencé ou est passé.');
    if (end != null && end <= start) errors.push('La date de fin de l’événement doit être après sa date de début.');
  }

  const active = tickets.filter((t) => t.is_active);
  if (active.length === 0) errors.push('Aucun billet actif : l’événement ne peut pas être acheté.');

  for (const ticket of active) {
    const name = `Billet « ${ticket.name} »`;
    const tiers = ticket.tiers
      .filter((t) => !t._delete && time(t.starts_at) != null)
      .sort((a, b) => time(a.starts_at)! - time(b.starts_at)!);

    const current = [...tiers]
      .reverse()
      .find((t) => time(t.starts_at)! <= nowMs && (time(t.ends_at) == null || time(t.ends_at)! > nowMs));
    const next = tiers.find((t) => time(t.starts_at)! > nowMs);

    if (!current) errors.push(`${name} : aucun palier en cours, le pass ne peut pas être acheté immédiatement.`);

    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].price < tiers[i - 1].price) {
        errors.push(`${name} : le prix baisse entre « ${tiers[i - 1].label} » et « ${tiers[i].label} ».`);
      }
    }
    if (start != null) {
      for (const tier of tiers) {
        if (time(tier.starts_at)! >= start) {
          errors.push(`${name} : le palier « ${tier.label} » commence après le début de l’événement.`);
        }
      }
    }

    const saleEnd = time(ticket.sale_end_date);
    if (saleEnd != null) {
      if (saleEnd <= nowMs) errors.push(`${name} : la fin des ventes est déjà passée.`);
      if (start != null && saleEnd > start) errors.push(`${name} : la fin des ventes est après le début de l’événement.`);
    }

    if (ticket.quantity_available == null) {
      warnings.push(`${name} : ${UNLIMITED_STOCK_WARNING}`);
    } else if (ticket.quantity_available <= 0) {
      errors.push(`${name} : le stock est à 0, le pass ne peut pas être acheté.`);
    }

    if (ticket.price_lock_enabled) {
      if (!next) {
        errors.push(`${name} : Price Lock activé sans palier futur (aucune hausse à bloquer).`);
      }
      const deposit = Number(ticket.price_lock_deposit_amount);
      if (!(deposit > 0)) {
        errors.push(`${name} : le versement minimum Price Lock doit être supérieur à 0.`);
      } else if (!event.is_test && deposit < PRICE_LOCK_MIN_DEPOSIT) {
        errors.push(`${name} : le versement minimum Price Lock doit être d’au moins ${PRICE_LOCK_MIN_DEPOSIT} € (hors événement de test).`);
      }
      if (current && deposit >= current.price) {
        errors.push(`${name} : le versement minimum Price Lock doit être inférieur au prix actuel (${current.price} €).`);
      }
      const opensAt = time(ticket.price_lock_opens_at);
      if (opensAt != null && next && opensAt >= time(next.starts_at)!) {
        errors.push(`${name} : l’ouverture du Price Lock doit précéder la prochaine hausse (${next.label}).`);
      }
    }
  }

  return { errors, warnings };
}
