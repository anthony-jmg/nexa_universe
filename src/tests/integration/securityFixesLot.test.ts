import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fulfillPaidOrder } from '../../../supabase/functions/_shared/order-fulfillment';
import { handleChargeRefunded } from '../../../supabase/functions/_shared/refunds';

// Lot de corrections avant le premier festival :
// 1. coût négocié réservé à l'Admin, 2. pas de survente, 3. pas d'annulation
// de billet par le client, 4. remboursement Stripe répercuté dans Nexa.

const root = join(__dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const MIGRATION = read('supabase/migrations/20261119141650_security_fixes_lot.sql');
const sql = MIGRATION.replace(/--.*$/gm, '');

// Supabase simulé pour fulfillPaidOrder : claim_paid_order renvoie `claim`.
const fakeSupabase = (claim: string) => {
  const calls: { op: string; table?: string; fn?: string; values?: unknown }[] = [];
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'or', 'maybeSingle', 'single']) b[m] = () => b;
    b.upsert = (values: unknown) => { calls.push({ op: 'upsert', table, values }); return Promise.resolve({ error: null }); };
    b.insert = (values: unknown) => { calls.push({ op: 'insert', table, values }); return Promise.resolve({ error: null }); };
    b.update = (values: unknown) => { calls.push({ op: 'update', table, values }); return b; };
    b.delete = () => { calls.push({ op: 'delete', table }); return b; };
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    return b;
  };
  return {
    calls,
    client: {
      rpc: (fn: string) => {
        calls.push({ op: 'rpc', fn });
        return Promise.resolve(fn === 'claim_paid_order' ? { data: claim, error: null } : { data: null, error: null });
      },
      from: builder,
    },
  };
};
const session = { metadata: { order_id: 'order-1' }, payment_intent: 'pi_1', amount_total: 8000, customer: 'cus_1', currency: 'eur' };

describe('1. Coût négocié réservé à l’Admin', () => {
  it('colonne retirée de event_ticket_types, valeurs recopiées dans une table Admin uniquement', () => {
    expect(sql).toMatch(/INSERT INTO public\.event_ticket_type_costs \(event_ticket_type_id, nexa_cost\)\nSELECT id, nexa_cost FROM public\.event_ticket_types WHERE nexa_cost IS NOT NULL;\n\nALTER TABLE public\.event_ticket_types DROP COLUMN nexa_cost;/);
    expect(sql).toContain('ALTER TABLE public.event_ticket_type_costs ENABLE ROW LEVEL SECURITY;');
    expect(sql).toMatch(/FOR ALL\s+TO authenticated\s+USING \(nexa_caller_is_admin\(\)\)\s+WITH CHECK \(nexa_caller_is_admin\(\)\);/);
    expect(sql).toContain('REVOKE ALL ON public.event_ticket_type_costs FROM anon;');
  });

  it('l’Admin lit et enregistre le coût dans la nouvelle table, plus jamais dans event_ticket_types', () => {
    const admin = read('src/components/EventsManagement.tsx');
    const payload = admin.slice(admin.indexOf('const toTicketTypePayload'), admin.indexOf('// Validation des paliers'));
    expect(payload).not.toContain('nexa_cost');
    expect(admin).toContain('cost:event_ticket_type_costs (nexa_cost)');
    expect(admin).toMatch(/\.from\('event_ticket_type_costs'\)\s*\.upsert\(\{ event_ticket_type_id: eventTicketTypeId, nexa_cost: nexaCost/);
    expect((admin.match(/await saveCost\(/g) || []).length).toBe(2);
    expect(read('src/components/EventSalesStats.tsx')).toContain('cost:event_ticket_type_costs (nexa_cost)');
    // Plus aucune référence publique à la colonne retirée
    expect(read('src/lib/database.types.ts')).not.toMatch(/event_ticket_types: \{\s+Row: \{[^}]*nexa_cost/);
  });
});

describe('2. Pas de survente à l’achat comptant', () => {
  it('claim_paid_order revérifie les places sous verrou et refuse au-delà du quota', () => {
    const claim = sql.slice(sql.indexOf('FUNCTION public.claim_paid_order'), sql.indexOf('FUNCTION public.guard_event_attendees_client_writes'));
    expect(claim).toMatch(/FOR UPDATE OF ett/);
    expect(claim).toMatch(/IF r\.quantity_sold \+ v_locks \+ v_claimed \+ r\.qty > r\.quantity_available THEN/);
    expect(claim).toContain("o2.status IN ('processing', 'completed')");
    expect(claim).toContain("RETURN 'sold_out';");
    expect(claim).toContain("RETURN 'already_refunded';");
  });

  it('pass complet au paiement : remboursement intégral, enregistré, aucun billet émis', async () => {
    const { client, calls } = fakeSupabase('sold_out');
    const refunds = { create: vi.fn().mockResolvedValue({ id: 're_1' }) };
    const result = await fulfillPaidOrder(client, { refunds }, session, 'user-1');
    expect(result).toEqual({ ok: false, reason: 'sold_out' });
    expect(refunds.create).toHaveBeenCalledTimes(1);
    expect(refunds.create.mock.calls[0][0]).toMatchObject({ payment_intent: 'pi_1', metadata: { reason: 'order_sold_out' } });
    expect(refunds.create.mock.calls[0][0]).not.toHaveProperty('amount');
    expect(refunds.create.mock.calls[0][1]).toEqual({ idempotencyKey: 'order-sold-out-refund-pi_1' });
    expect(calls).toContainEqual(expect.objectContaining({ op: 'upsert', table: 'stripe_payments', values: expect.objectContaining({ status: 'refunded', order_id: 'order-1', amount: 80 }) }));
    // Ni Price Lock, ni conversion des participants
    expect(calls.map((c) => c.fn).filter(Boolean)).toEqual(['claim_paid_order']);
  });

  it('second appel (webhook + verify) : même clé de remboursement, toujours rien de livré', async () => {
    const { client, calls } = fakeSupabase('already_refunded');
    const refunds = { create: vi.fn().mockResolvedValue({ id: 're_1' }) };
    const result = await fulfillPaidOrder(client, { refunds }, session, 'user-1');
    expect(result).toEqual({ ok: false, reason: 'already_refunded' });
    expect(refunds.create.mock.calls[0][1]).toEqual({ idempotencyKey: 'order-sold-out-refund-pi_1' });
    expect(calls.map((c) => c.fn).filter(Boolean)).toEqual(['claim_paid_order']);
  });

  it('remboursement Stripe en échec : paiement gardé « succeeded » pour traitement manuel', async () => {
    const { client, calls } = fakeSupabase('sold_out');
    const refunds = { create: vi.fn().mockRejectedValue(new Error('stripe down')) };
    await fulfillPaidOrder(client, { refunds }, session, 'user-1');
    expect(calls).toContainEqual(expect.objectContaining({ op: 'upsert', values: expect.objectContaining({ status: 'succeeded' }) }));
    expect(calls.filter((c) => c.op === 'update')).toEqual([]);
  });
});

describe('3. Le client ne peut plus annuler un billet', () => {
  it('base : tout changement de statut par le client refusé, coordonnées toujours modifiables', () => {
    const guard = sql.slice(sql.indexOf('FUNCTION public.guard_event_attendees_client_writes'), sql.indexOf('FUNCTION public.apply_full_stripe_refund'));
    expect(guard).toMatch(/IF NEW\.check_in_status IS DISTINCT FROM OLD\.check_in_status THEN\s+RAISE EXCEPTION 'Changement de statut du billet non autorisé';/);
    expect(guard).not.toContain("NEW.check_in_status = 'cancelled'");
    expect(guard).toContain("'attendee_first_name', 'attendee_last_name', 'attendee_email'");
  });

  it('Mes Pass : plus de bouton ni d’appel d’annulation', () => {
    const page = read('src/pages/MyPurchases.tsx');
    expect(page).not.toMatch(/cancelTicket|update\(\{ check_in_status/);
    expect(read('src/i18n/translations.ts')).not.toMatch(/myPasses\.(ticket\.cancelConfirm|modal\.cancelTicket)/);
  });
});

describe('4. Remboursement fait dans Stripe', () => {
  it('remboursement total : apply_full_stripe_refund appelée avec le paiement', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'applied', cancelled_tickets: 1 }, error: null });
    const res = await handleChargeRefunded({ rpc }, { id: 'ch_1', refunded: true, payment_intent: 'pi_9' });
    expect(rpc).toHaveBeenCalledWith('apply_full_stripe_refund', { p_payment_intent_id: 'pi_9' });
    expect(res).toEqual({ status: 'applied', cancelled_tickets: 1 });
  });

  it('remboursement partiel : aucun changement automatique', async () => {
    const rpc = vi.fn();
    const res = await handleChargeRefunded({ rpc }, { id: 'ch_1', refunded: false, payment_intent: { id: 'pi_9' } });
    expect(res).toEqual({ status: 'partial_refund_ignored' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('erreur base : exception, Stripe rejouera le webhook (fonction idempotente)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(handleChargeRefunded({ rpc }, { id: 'ch_1', refunded: true, payment_intent: 'pi_9' })).rejects.toThrow('boom');
  });

  it('webhook branché sur charge.refunded', () => {
    const webhook = read('supabase/functions/stripe-webhook/index.ts');
    expect(webhook).toMatch(/case "charge\.refunded": \{\s+const charge = event\.data\.object as Stripe\.Charge;\s+await handleChargeRefunded\(supabase, charge\);/);
  });

  it('fonction SQL : billets non scannés annulés, places et Price Locks libérés, réservée au serveur', () => {
    const fn = sql.slice(sql.indexOf('FUNCTION public.apply_full_stripe_refund'));
    expect(fn).toContain("IF a.check_in_status = 'checked_in' THEN");
    expect(fn).toMatch(/SET quantity_sold = GREATEST\(quantity_sold - 1, 0\)/);
    expect(fn).toMatch(/SET status = CASE WHEN status = 'active' THEN 'cancelled' ELSE status END/);
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.apply_full_stripe_refund(text) FROM PUBLIC, anon, authenticated;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.apply_full_stripe_refund(text) TO service_role;');
  });
});

describe('Aucune donnée existante supprimée', () => {
  it('seules suppressions : réservations temporaires d’une commande remboursée faute de place', () => {
    const deletes = sql.match(/DELETE FROM \w+/g) ?? [];
    expect(deletes).toEqual([
      'DELETE FROM stock_reservations',
      'DELETE FROM pending_event_attendees',
      'DELETE FROM stock_reservations',
    ]);
    expect(sql).not.toMatch(/TRUNCATE|DROP TABLE/i);
    // Seule colonne retirée : nexa_cost, vide et recopiée juste avant
    expect(sql.match(/DROP COLUMN \w+/g)).toEqual(['DROP COLUMN nexa_cost']);
  });
});
