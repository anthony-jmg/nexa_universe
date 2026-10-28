import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { purchaseErrorMessage } from '../../lib/purchaseErrors';
import { translate } from '../../i18n/translations';

// Événement annulé : aucun nouvel achat comptant, aucun nouveau Price Lock,
// aucune session Stripe. Les vrais handlers des Edge Functions (Deno) sont
// exécutés dans Node avec Supabase et Stripe simulés.

const root = join(__dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const FR = 'Cet événement a été annulé. Aucun nouvel achat ou Price Lock n’est possible.';
const EN = 'This event has been cancelled. No new purchase or Price Lock can be created.';

type Handler = (req: Request) => Promise<Response>;

// Transpile le fichier Deno et l'exécute avec des modules injectés.
const loadHandler = (path: string, modules: Record<string, unknown>): Handler => {
  const { outputText } = ts.transpileModule(read(path), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  let handler: Handler | null = null;
  const Deno = { serve: (h: Handler) => { handler = h; }, env: { get: () => 'test' } };
  const requireMock = (name: string) => {
    if (name in modules) return modules[name];
    if (name.startsWith('jsr:')) return {};
    throw new Error(`module inattendu ${name}`);
  };
  new Function('require', 'exports', 'Deno', outputText)(requireMock, {}, Deno);
  if (!handler) throw new Error('Deno.serve non appelé');
  return handler;
};

// --- Base simulée -----------------------------------------------------------
interface Db {
  eventStatus: string;
  writes: { table: string; op: string; values?: unknown }[];
  rpcs: string[];
}
const db: Db = { eventStatus: 'published', writes: [], rpcs: [] };

const ticketType = () => ({
  id: 'ett-1',
  event_id: 'evt-1',
  price: 100,
  quantity_available: null,
  quantity_sold: 0,
  is_active: true,
  price_lock_enabled: true,
  price_lock_deposit_amount: 30,
  price_increase_date: new Date(Date.now() + 3 * 86400000).toISOString(),
  price_lock_opens_at: new Date(Date.now() - 86400000).toISOString(),
  sale_end_date: null,
  max_per_order: null,
  ticket_types: { name: 'Full Pass' },
  ticket_type: { name: 'Full Pass' },
  events: { title: 'Festival', event_status: db.eventStatus },
  event: { event_status: db.eventStatus },
});

const tableRows = (table: string): unknown => {
  switch (table) {
    case 'event_ticket_types': return [ticketType()];
    case 'orders': return { id: 'order-1', user_id: 'user-1', status: 'pending', total_amount: 100, expires_at: null };
    case 'order_items': return [{ id: 'oi-1', product_id: null, event_ticket_type_id: 'ett-1', quantity: 1, unit_price: 100, purchase_type: null, details: null }];
    case 'stripe_customers': return { stripe_customer_id: 'cus_1' };
    default: return null;
  }
};

const supabaseMock = {
  auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'ana@example.com' } }, error: null }) },
  rpc: (fn: string) => {
    db.rpcs.push(fn);
    const data = fn === 'get_event_ticket_pricing' ? { current_price: 100, current_tier_id: 'tier-1' } : null;
    const result = { data, error: null };
    return Object.assign(Promise.resolve(result), { maybeSingle: () => Promise.resolve(result) });
  },
  from: (table: string) => {
    const b: Record<string, unknown> = {};
    let rows: unknown = tableRows(table);
    let single = false;
    for (const m of ['select', 'eq', 'in', 'is', 'gte', 'order', 'limit']) b[m] = () => b;
    for (const op of ['insert', 'update', 'delete', 'upsert']) {
      b[op] = (values?: unknown) => {
        db.writes.push({ table, op, values });
        rows = table === 'orders' && op === 'insert' ? { id: 'order-new' } : null;
        return b;
      };
    }
    b.single = () => { single = true; return b; };
    b.maybeSingle = () => { single = true; return b; };
    b.then = (resolve: (v: unknown) => unknown) => {
      const data = Array.isArray(rows) && single ? rows[0] : rows;
      return Promise.resolve({ data, error: null, count: 0 }).then(resolve);
    };
    return b;
  },
};

const stripeSessions = vi.fn();
class StripeMock {
  checkout = { sessions: { create: (...args: unknown[]) => { stripeSessions(...args); return Promise.resolve({ id: 'cs_1', url: 'https://stripe.test', expires_at: null }); } } };
  customers = { create: () => Promise.resolve({ id: 'cus_new' }) };
}

const supabaseModule = { createClient: () => supabaseMock };
const validators = (() => {
  const { outputText } = ts.transpileModule(read('supabase/functions/_shared/validators.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  const exports: Record<string, unknown> = {};
  new Function('exports', outputText)(exports);
  return exports;
})();

const orderHandler = loadHandler('supabase/functions/validate-and-create-order/index.ts', {
  'npm:@supabase/supabase-js@2': supabaseModule,
  '../_shared/validators.ts': validators,
  '../_shared/rate-limiter.ts': { checkRateLimit: () => Promise.resolve(true) },
});
const checkoutHandler = loadHandler('supabase/functions/create-stripe-checkout/index.ts', {
  'npm:@supabase/supabase-js@2.57.4': supabaseModule,
  'npm:stripe@17.6.0': { __esModule: true, default: StripeMock },
});

const post = (handler: Handler, body: unknown) =>
  handler(new Request('https://edge.test', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })).then(async (res) => ({ status: res.status, body: await res.json() }));

const cartOrder = (purchaseType?: string) => post(orderHandler, {
  items: [{ event_ticket_type_id: 'ett-1', quantity: 1, price_snapshot: 100, ...(purchaseType ? { purchase_type: purchaseType } : {}) }],
});
const checkout = (paymentType: string, metadata: Record<string, string>) => post(checkoutHandler, {
  payment_type: paymentType,
  items: [{ id: 'x', name: 'x', price: 1, quantity: 1 }],
  success_url: 'https://nexa.test/ok',
  cancel_url: 'https://nexa.test/ko',
  metadata,
});

const writesTo = (...tables: string[]) => db.writes.filter((w) => tables.includes(w.table));

beforeEach(() => {
  db.writes = [];
  db.rpcs = [];
  stripeSessions.mockClear();
});

describe('Événement annulé : refus côté serveur', () => {
  beforeEach(() => { db.eventStatus = 'cancelled'; });

  it('1 / 4. achat comptant (validate-and-create-order) refusé, aucune commande créée', async () => {
    const res = await cartOrder();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: FR, code: 'EVENT_CANCELLED', event_ticket_type_id: 'ett-1' });
    expect(writesTo('orders', 'order_items', 'pending_event_attendees', 'price_locks')).toEqual([]);
  });

  it('2 / 5. Price Lock dans le panier refusé avant toute validation de versement', async () => {
    const res = await cartOrder('price_lock_deposit');
    expect(res.body.code).toBe('EVENT_CANCELLED');
    expect(db.rpcs).not.toContain('create_stripe_price_lock_deposit');
    expect(writesTo('orders', 'order_items', 'pending_event_attendees', 'price_locks')).toEqual([]);
  });

  it('2 / 3 / 5. premier versement Price Lock direct : refusé, aucune session Stripe', async () => {
    const res = await checkout('price_lock_deposit', { event_ticket_type_id: 'ett-1', selected_deposit_amount: '30' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: FR });
    expect(stripeSessions).not.toHaveBeenCalled();
    expect(db.rpcs).not.toContain('create_stripe_price_lock_deposit');
    expect(writesTo('price_locks', 'stripe_checkout_sessions', 'stripe_customers')).toEqual([]);
  });

  it('3. commande créée avant l’annulation : paiement refusé, aucune session Stripe', async () => {
    const res = await checkout('order', { order_id: '11111111-1111-4111-8111-111111111111' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: FR });
    expect(stripeSessions).not.toHaveBeenCalled();
    expect(writesTo('stripe_checkout_sessions', 'orders')).toEqual([]);
  });

  it('5. filet SQL : tout nouveau Price Lock refusé par enforce_price_lock_rules (paiement en cours → remboursement existant)', () => {
    const sql = read('supabase/migrations/20261028072315_cancelled_event_no_new_price_lock.sql');
    expect(sql).toMatch(/IF EXISTS \(SELECT 1 FROM events e WHERE e\.id = cfg\.event_id AND e\.event_status = 'cancelled'\) THEN\nRAISE EXCEPTION 'Cet événement a été annulé\. Aucun nouvel achat ou Price Lock n’est possible\.';/);
    // Refus du lock après paiement = remboursement déjà en place (panier et achat direct)
    expect(read('supabase/functions/_shared/order-fulfillment.ts')).toMatch(/price-lock-refund-\$\{paymentIntentId\}-\$\{item\.id\}/);
    expect(read('supabase/functions/stripe-webhook/index.ts')).toMatch(/Lock refusé après paiement : remboursement intégral/);
  });
});

describe('Événements publiés / à venir : comportement inchangé', () => {
  for (const status of ['published', 'upcoming']) {
    it(`${status === 'published' ? '6' : '7'}. ${status} : commande créée et sessions Stripe ouvertes`, async () => {
      db.eventStatus = status;
      const order = await cartOrder();
      expect(order.status).toBe(200);
      expect(order.body.success).toBe(true);
      expect(writesTo('orders').map((w) => w.op)).toEqual(['insert']);

      const pay = await checkout('order', { order_id: '11111111-1111-4111-8111-111111111111' });
      expect(pay.body).toEqual({ sessionId: 'cs_1', url: 'https://stripe.test' });

      const deposit = await checkout('price_lock_deposit', { event_ticket_type_id: 'ett-1' });
      expect(deposit.body).toEqual({ sessionId: 'cs_1', url: 'https://stripe.test' });
      expect(stripeSessions).toHaveBeenCalledTimes(2);
    });
  }
});

describe('Message utilisateur', () => {
  it('8. FR', () => {
    expect(purchaseErrorMessage(new Error(FR), (k, p) => translate('fr', k, p))).toBe(FR);
    // Apostrophe droite également reconnue
    expect(purchaseErrorMessage(new Error(FR.replace('’', "'")), (k, p) => translate('fr', k, p))).toBe(FR);
  });

  it('9. EN', () => {
    expect(purchaseErrorMessage(new Error(FR), (k, p) => translate('en', k, p))).toBe(EN);
  });

  it('message serveur identique dans les deux Edge Functions et la base', () => {
    expect(read('supabase/functions/validate-and-create-order/index.ts')).toContain(FR);
    expect(read('supabase/functions/create-stripe-checkout/index.ts')).toContain(FR);
  });
});

describe('10. aucune modification des données existantes', () => {
  it('la migration ne fait que remplacer la fonction du trigger BEFORE INSERT', () => {
    const sql = read('supabase/migrations/20261028072315_cancelled_event_no_new_price_lock.sql').replace(/--.*$/gm, '');
    expect(sql.match(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)).toEqual(['CREATE OR REPLACE FUNCTION public.enforce_price_lock_rules']);
    // Aucune instruction de données ni de schéma (seul « FOR UPDATE », verrou de lecture existant)
    expect(sql).not.toMatch(/^\s*(UPDATE|DELETE|INSERT|DROP|ALTER|TRUNCATE|CREATE\s+(TRIGGER|POLICY|TABLE))\b/im);
    expect(sql).not.toMatch(/POLICY/i);
  });
});
