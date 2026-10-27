import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { applyBalancePayment } from '../../../supabase/functions/_shared/price-lock';
import { purchaseErrorMessage } from '../../lib/purchaseErrors';
import { translate } from '../../i18n/translations';

// Événement annulé : plus aucun paiement du solde (manuel ou automatique) ;
// un paiement déjà encaissé par Stripe (course) est remboursé par le
// mécanisme existant (applyBalancePayment → refundPayment).

const root = join(__dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const MIGRATION = read('supabase/migrations/20261027174004_cancelled_event_passes_and_payment_guard.sql');
const CHECKOUT = read('supabase/functions/create-stripe-checkout/index.ts');

// Exécute la vraie fonction resolvePriceLockBalance de l'Edge Function
// (Deno) dans Node : extraite du fichier source puis transpilée.
type Resolve = (supabase: unknown, userId: string, lockId: string) => Promise<{ error?: string; amount?: number }>;
const loadResolvePriceLockBalance = (): Resolve => {
  const start = CHECKOUT.indexOf('async function resolvePriceLockBalance(');
  const end = CHECKOUT.indexOf('const REPURCHASE_REFUSALS');
  expect(start).toBeGreaterThan(-1);
  const { outputText } = ts.transpileModule(CHECKOUT.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  });
  return new Function(`${outputText}\nreturn resolvePriceLockBalance;`)() as Resolve;
};

const adminClient = (lock: Record<string, unknown>, eventStatus: string) => ({
  from: (table: string) => {
    const row = table === 'price_locks' ? lock : table === 'events' ? { event_status: eventStatus } : null;
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.maybeSingle = () => Promise.resolve({ data: row, error: null });
    return b;
  },
});

const activeLock = {
  id: 'lock-1',
  user_id: 'user-1',
  event_id: 'evt-1',
  status: 'active',
  expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
  remaining_amount: 70,
  auto_balance_payment_status: null,
  auto_balance_debit_attempted_at: null,
  ticket_type: { ticket_type: { name: 'Full Pass' } },
};

describe('8. create-stripe-checkout : paiement manuel du solde refusé si l’événement est annulé', () => {
  const resolve = loadResolvePriceLockBalance();

  it('événement annulé → aucune session de paiement, erreur claire', async () => {
    const result = await resolve(adminClient(activeLock, 'cancelled'), 'user-1', 'lock-1');
    expect(result.amount).toBeUndefined();
    expect(result.error).toBe('Cet événement a été annulé : le solde ne peut plus être payé.');
  });

  it('événement publié → solde relu en base, comportement inchangé', async () => {
    const result = await resolve(adminClient(activeLock, 'published'), 'user-1', 'lock-1');
    expect(result).toEqual({ name: 'Solde Price Lock — Full Pass', amount: 70 });
  });

  it('erreur traduite côté frontend (FR / EN), jamais brute', () => {
    for (const message of [
      'Cet événement a été annulé : le solde ne peut plus être payé.',
      'Cet événement a été annulé : aucun paiement ne peut être enregistré',
    ]) {
      expect(purchaseErrorMessage({ message }, (k, p) => translate('fr', k, p))).toBe(
        'Cet événement a été annulé : aucun paiement ne peut plus être effectué.'
      );
      expect(purchaseErrorMessage({ message }, (k, p) => translate('en', k, p))).toBe(
        'This event has been cancelled: no further payment can be made.'
      );
    }
  });
});

describe('9 / 10. fonctions SQL (migration appliquée)', () => {
  it('9. claim_price_lock_auto_debit : jamais réservé si l’événement est annulé', () => {
    const claim = MIGRATION.slice(MIGRATION.indexOf('FUNCTION public.claim_price_lock_auto_debit'), MIGRATION.indexOf('FUNCTION public.record_price_lock_payment'));
    expect(claim).toMatch(/AND NOT EXISTS \(\s*SELECT 1 FROM events e\s*WHERE e\.id = price_locks\.event_id AND e\.event_status = 'cancelled'\s*\)/);
    // Conditions existantes conservées
    for (const kept of ["status = 'active'", 'expires_at > now()', "balance_payment_mode = 'automatic'", 'remaining_amount > 0', 'auto_balance_canceled_at IS NULL']) {
      expect(claim).toContain(kept);
    }
  });

  it('10. record_price_lock_payment : refuse d’enregistrer un solde si l’événement est annulé', () => {
    const record = MIGRATION.slice(MIGRATION.indexOf('FUNCTION public.record_price_lock_payment'));
    expect(record).toMatch(/IF EXISTS \(SELECT 1 FROM events e WHERE e\.id = pl\.event_id AND e\.event_status = 'cancelled'\) THEN\s*RAISE EXCEPTION 'Cet événement a été annulé : aucun paiement ne peut être enregistré';/);
    // Vérifié sous verrou, avant toute mise à jour du lock
    expect(record.indexOf("e.event_status = 'cancelled'")).toBeGreaterThan(record.indexOf('FOR UPDATE'));
    expect(record.indexOf("e.event_status = 'cancelled'")).toBeLessThan(record.indexOf("status = 'completed'"));
  });
});

describe('11. cas de course : paiement Stripe déjà parti → remboursé par le mécanisme existant', () => {
  const setup = () => {
    const rpc = vi.fn((fn: string) =>
      Promise.resolve(
        fn === 'record_price_lock_payment'
          ? { data: null, error: { message: 'Cet événement a été annulé : aucun paiement ne peut être enregistré', code: 'P0001' } }
          : { data: null, error: null }
      )
    );
    const updates: unknown[] = [];
    const supabase = {
      rpc,
      from: () => ({
        upsert: () => Promise.resolve({ error: null }),
        update: (values: unknown) => {
          updates.push(values);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    };
    const refundsCreate = vi.fn().mockResolvedValue({ id: 're_1' });
    return { supabase, rpc, updates, stripe: { refunds: { create: refundsCreate } }, refundsCreate };
  };

  for (const autoDebit of [true, false]) {
    it(`${autoDebit ? 'prélèvement automatique' : 'paiement manuel'} : solde non enregistré, remboursement intégral idempotent`, async () => {
      const { supabase, rpc, updates, stripe, refundsCreate } = setup();
      const result = await applyBalancePayment(supabase, stripe, {
        lockId: 'lock-1',
        paymentIntentId: 'pi_race',
        amount: 70,
        userId: 'user-1',
        customerId: 'cus_1',
        currency: 'eur',
        metadata: null,
        autoDebit,
      });
      expect(result).toEqual({ ok: false, error: 'Cet événement a été annulé : aucun paiement ne peut être enregistré', refunded: true });
      expect(rpc).toHaveBeenCalledWith('record_price_lock_payment', expect.objectContaining({ p_lock_id: 'lock-1', p_auto_debit: autoDebit }));
      // Remboursement total (pas de montant partiel), clé stable par paiement
      expect(refundsCreate).toHaveBeenCalledTimes(1);
      expect(refundsCreate.mock.calls[0][0]).toMatchObject({ payment_intent: 'pi_race' });
      expect(refundsCreate.mock.calls[0][0]).not.toHaveProperty('amount');
      expect(refundsCreate.mock.calls[0][1]).toEqual({ idempotencyKey: 'price-lock-balance-refund-pi_race' });
      expect(updates).toEqual([{ status: 'refunded' }]);
      // Participants jamais confirmés
      expect(rpc).not.toHaveBeenCalledWith('complete_price_lock_attendees', expect.anything());
    });
  }

  it('aucun second mécanisme de remboursement ajouté', () => {
    expect(MIGRATION).not.toMatch(/refunds\.create|refund_processed_at\s*=/);
    expect(CHECKOUT).not.toMatch(/refunds\.create/);
    expect(read('supabase/functions/_shared/price-lock.ts').match(/stripe\.refunds\.create/g)).toHaveLength(1);
  });
});

describe('14 / 15. aucune suppression, aucune exposition générale des événements annulés', () => {
  const sql = MIGRATION.replace(/--.*$/gm, '');

  it('14. la migration ne supprime ni ne modifie aucune donnée', () => {
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b|\bTRUNCATE\b|\bDROP\b|\bALTER\s+TABLE\b|\bINSERT\s+INTO\b/i);
    // Seules mises à jour : celles déjà présentes dans les fonctions recréées
    const updates = sql.match(/\bUPDATE\s+\w+/gi) ?? [];
    expect(updates.map((u) => u.replace(/\s+/g, ' '))).toEqual([
      'UPDATE price_locks',
      'UPDATE stripe_payments',
      'UPDATE price_locks',
    ]);
  });

  it('15. RLS publique de events inchangée, get_my_pass_events limitée à l’utilisateur connecté', () => {
    expect(sql).not.toMatch(/POLICY/i);
    const fn = sql.slice(sql.indexOf('get_my_pass_events'), sql.indexOf('claim_price_lock_auto_debit'));
    expect(fn).toContain('a.user_id = auth.uid()');
    expect(fn).toContain('pl.user_id = auth.uid()');
    expect(fn).toMatch(/JOIN linked l ON l\.event_id = e\.id/);
    // Uniquement les événements déjà publics ou annulés (pas les brouillons)
    expect(fn).toMatch(/WHERE \(e\.event_status IN \('published', 'upcoming'\) AND e\.is_active\)\s*OR e\.event_status = 'cancelled'/);
    expect(fn).toMatch(/STABLE\s+SECURITY DEFINER/);
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.get_my_pass_events() FROM PUBLIC, anon;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_my_pass_events() TO authenticated;');
  });

  it('montant payé : prix de commande ou versement Price Lock, jamais le prix public', () => {
    const fn = sql.slice(sql.indexOf('get_my_pass_events'), sql.indexOf('claim_price_lock_auto_debit'));
    expect(fn).toContain('COALESCE(pl.total_paid, oi.unit_price)');
    expect(fn).toContain("o.status = 'completed'");
    expect(fn).not.toMatch(/price_lock_public_price|get_event_ticket_pricing|ett\.price/);
  });
});
