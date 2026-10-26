import { describe, it, expect } from 'vitest';
import { priceLockDeadline, EttWithPricing } from '../../lib/tierPricing';

const DAY = 86400000;
const now = Date.now();
const iso = (days: number) => new Date(now + days * DAY).toISOString();

// Billet avec une hausse dans 10 jours et 30 jours de garantie → échéance J+40
const ett = (saleEndDate: string | null) =>
  ({
    is_active: true,
    price: 50,
    price_lock_guarantee_days: 30,
    sale_end_date: saleEndDate,
    price_tiers: [
      { label: 'Early', price: 50, starts_at: iso(-5), ends_at: iso(10) },
      { label: 'Regular', price: 70, starts_at: iso(10), ends_at: null },
    ],
  }) as unknown as EttWithPricing;

describe('priceLockDeadline — fin des ventes (sale_end_date)', () => {
  it('sans fin des ventes : prochaine hausse + garantie', () => {
    expect(priceLockDeadline(ett(null))?.toISOString()).toBe(iso(40));
  });

  it('fin des ventes avant la garantie : la date limite est plafonnée à sale_end_date', () => {
    expect(priceLockDeadline(ett(iso(20)))?.toISOString()).toBe(iso(20));
  });

  it('fin des ventes après la garantie : la garantie reste la date limite', () => {
    expect(priceLockDeadline(ett(iso(60)))?.toISOString()).toBe(iso(40));
  });
});
