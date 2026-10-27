import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

// Événement annulé : les pass restent visibles dans Mes Pass (achat comptant,
// Price Lock soldé, actif ou expiré), avec le montant réellement payé, le
// message de remboursement et aucun bouton de paiement ou de rachat.

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const future = (days: number) => new Date(now + days * DAY).toISOString();

const lang = vi.hoisted(() => ({ value: 'fr' as 'fr' | 'en' }));

const ticketBase = {
  user_id: 'user-1',
  qr_code: 'qr',
  checked_in_at: null,
  purchased_at: future(-10),
  created_at: future(-10),
  pass_status: 'pending',
  pass_file_path: null,
  attendee_first_name: 'Ana',
  attendee_last_name: 'Test',
  attendee_email: null,
  attendee_phone: null,
  // Événement annulé : masqué par la RLS publique, la jointure revient à null.
  events: null,
};

const passEvent = (id: string, title: string, amounts: Record<string, number> = {}) => ({
  event_id: id,
  title,
  location: 'Lisbonne',
  start_date: future(30),
  end_date: future(31),
  thumbnail_url: null,
  event_status: 'cancelled',
  is_active: true,
  attendee_amounts: amounts,
});

const lockBase = {
  deposit_amount: 30,
  balance_payment_mode: 'manual',
  auto_balance_payment_at: null,
  auto_balance_payment_status: null,
  event_ticket_types: { id: 'ett-1', ticket_types: { name: 'Full Pass' } },
  events: null,
};

const data: { price_locks: unknown[]; event_attendees: unknown[] } = { price_locks: [], event_attendees: [] };
let passEvents: unknown[] = [];
const quotes: Record<string, unknown> = {};
const queries: { table: string; method: string; args: unknown[] }[] = [];
const rpcCalls: string[] = [];

const authValue = { user: { id: 'user-1' }, profile: { id: 'user-1', role: 'student' } };
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authValue }));
vi.mock('../../contexts/CartContext', () => ({ useCart: () => ({ clearCart: vi.fn() }) }));
vi.mock('../../contexts/LanguageContext', async () => {
  const { translate } = await import('../../i18n/translations');
  return {
    useLanguage: () => ({
      t: (key: string, params?: Record<string, string | number>) => translate(lang.value, key, params),
      language: lang.value,
    }),
  };
});
vi.mock('../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'not', 'order', 'neq', 'is', 'limit', 'update', 'delete', 'insert', 'upsert']) {
      b[m] = (...args: unknown[]) => {
        queries.push({ table, method: m, args });
        return b;
      };
    }
    b.then = (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) =>
      Promise.resolve({ data: (data as Record<string, unknown[]>)[table] ?? [], error: null }).then(resolve, reject);
    return b;
  };
  return {
    supabase: {
      from: (table: string) => {
        queries.push({ table, method: 'from', args: [] });
        return builder(table);
      },
      rpc: (fn: string, args: { p_lock_id?: string }) => {
        rpcCalls.push(fn);
        if (fn === 'get_my_pass_events') return Promise.resolve({ data: passEvents, error: null });
        if (fn === 'get_my_expired_price_lock_reservation_ids') return Promise.resolve({ data: [], error: null });
        return Promise.resolve({ data: (args?.p_lock_id && quotes[args.p_lock_id]) ?? null, error: null });
      },
      auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'token' } } }) },
    },
  };
});

import { MyPurchases } from '../../pages/MyPurchases';
import { formatPrice } from '../../lib/formatEuro';
import { setActiveLanguage } from '../../lib/locale';

// Montant tel qu'affiché (espaces insécables normalisés par Testing Library).
const price = (value: number) => formatPrice(value).replace(/\s/g, ' ');

const FR_MESSAGE = 'Cet événement a été annulé. Les sommes encaissées par Nexa pour ce pass te seront remboursées.';
const EN_MESSAGE = 'This event has been cancelled. Amounts collected by Nexa for this pass will be refunded to you.';
const PAYMENT_BUTTON = /payer le solde|acheter au prix actuel|pay the balance|buy at the current price/i;
const NO_PROMISE = /automatiquement|automatic|sous \d+|within \d+|\d+\s*(jours|days|semaines|weeks)|instantan|instant/i;

// Les quatre cas, chacun sur un événement annulé distinct.
const loadAllCases = () => {
  data.event_attendees = [
    // CAS 1 : achat comptant (80 € payés ; prix public actuel 120 €).
    { ...ticketBase, id: 't-cash', event_id: 'evt-cash', event_ticket_type_id: 'ett-1', check_in_status: 'not_checked_in', weezevent_sync_status: 'synced',
      event_ticket_types: { id: 'ett-1', price: 120, ticket_types: { name: 'Full Pass' } } },
    // CAS 2 : Price Lock entièrement payé (billet confirmé, 95 € versés).
    { ...ticketBase, id: 't-pl', event_id: 'evt-pl', event_ticket_type_id: 'ett-2', check_in_status: 'not_checked_in', weezevent_sync_status: 'pending',
      event_ticket_types: { id: 'ett-2', price: 150, ticket_types: { name: 'Party Pass' } } },
  ];
  data.price_locks = [
    // CAS 3 : Price Lock actif, prélèvement automatique programmé.
    { ...lockBase, id: 'lock-active', event_id: 'evt-active', locked_price: 100, total_paid: 30, remaining_amount: 70,
      expires_at: future(5), status: 'active', balance_payment_mode: 'automatic', auto_balance_payment_at: future(2) },
    // CAS 4 : Price Lock expiré.
    { ...lockBase, id: 'lock-expired', event_id: 'evt-exp', locked_price: 100, total_paid: 20, remaining_amount: 90,
      expires_at: future(-1), status: 'expired' },
  ];
  quotes['lock-expired'] = { status: 'event_cancelled', current_price: 110, amount_due: null, event_title: 'Festival Expiré' };
  passEvents = [
    passEvent('evt-cash', 'Festival Comptant', { 't-cash': 80 }),
    passEvent('evt-pl', 'Festival Soldé', { 't-pl': 95 }),
    passEvent('evt-active', 'Festival Actif'),
    passEvent('evt-exp', 'Festival Expiré'),
  ];
};

const renderPage = async (title = 'Festival Expiré') => {
  render(<MyPurchases onNavigate={vi.fn()} />);
  await screen.findAllByText(title);
};

const card = (title: string) => {
  const node = screen.getByText(title).closest('.rounded-xl') as HTMLElement;
  expect(node).not.toBeNull();
  return within(node);
};

describe('Mes Pass — événement annulé', () => {
  beforeEach(() => {
    cleanup();
    lang.value = 'fr';
    setActiveLanguage('fr');
    data.price_locks = [];
    data.event_attendees = [];
    passEvents = [];
    queries.length = 0;
    rpcCalls.length = 0;
    for (const key of Object.keys(quotes)) delete quotes[key];
    loadAllCases();
  });

  it('1. achat comptant : reste visible, badge, montant réellement payé, message, aucun bouton', async () => {
    await renderPage();
    const c = card('Festival Comptant');
    expect(c.getAllByText('Événement annulé').length).toBeGreaterThan(0);
    expect(c.getByText(FR_MESSAGE)).toBeInTheDocument();
    // 5. montant payé réel (commande), jamais le prix public actuel
    expect(c.getByText(price(80))).toBeInTheDocument();
    expect(c.queryByText(price(120))).not.toBeInTheDocument();
    expect(c.queryByRole('button', { name: PAYMENT_BUTTON })).not.toBeInTheDocument();
  });

  it('2. Price Lock entièrement payé : reste visible avec le montant versé', async () => {
    await renderPage();
    const c = card('Festival Soldé');
    expect(c.getAllByText('Événement annulé').length).toBeGreaterThan(0);
    expect(c.getByText(FR_MESSAGE)).toBeInTheDocument();
    expect(c.getByText(price(95))).toBeInTheDocument();
    expect(c.queryByText(price(150))).not.toBeInTheDocument();
  });

  it('3. Price Lock actif : visible, montant payé et solde informatif, sans Payer le solde ni prélèvement annoncé', async () => {
    await renderPage();
    const c = card('Festival Actif');
    expect(c.getByText('Événement annulé')).toBeInTheDocument();
    expect(c.queryByText('Actif')).not.toBeInTheDocument();
    expect(c.getByText(price(30))).toBeInTheDocument();
    expect(c.getByText(price(70))).toBeInTheDocument();
    expect(c.getByText(FR_MESSAGE)).toBeInTheDocument();
    // 6. aucun bouton Payer le solde ; 11. aucun prélèvement automatique annoncé
    expect(c.queryByRole('button')).not.toBeInTheDocument();
    expect(c.queryByText(/Prélèvement automatique du solde prévu/)).not.toBeInTheDocument();
    expect(c.queryByText(/Garanti jusqu/)).not.toBeInTheDocument();
  });

  it('4. Price Lock expiré : visible, message, aucun rachat ni paiement', async () => {
    await renderPage();
    const c = card('Festival Expiré');
    expect(c.getByText('Événement annulé')).toBeInTheDocument();
    expect(c.getByText(FR_MESSAGE)).toBeInTheDocument();
    expect(c.getByText(price(20))).toBeInTheDocument();
    // 7. aucun bouton de rachat
    expect(c.queryByRole('button')).not.toBeInTheDocument();
    expect(c.queryByText(price(110))).not.toBeInTheDocument();
  });

  it('5–7. aucun bouton de paiement, de rachat ou d’annulation sur toute la page, modal comprise', async () => {
    await renderPage();
    expect(screen.queryByRole('button', { name: PAYMENT_BUTTON })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Festival Comptant').closest('.rounded-xl')!.querySelector('.cursor-pointer')!);
    const modal = within(screen.getByText('Pass').closest('div') as HTMLElement);
    expect(modal.getByText('Événement annulé')).toBeInTheDocument();
    expect(modal.getByText(FR_MESSAGE)).toBeInTheDocument();
    expect(modal.getByText(price(80))).toBeInTheDocument();
    expect(modal.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
  });

  it('12. message FR exact, sans délai ni remboursement automatique ou instantané', async () => {
    await renderPage();
    expect(screen.getAllByText(FR_MESSAGE)).toHaveLength(4);
    expect(document.body.textContent).not.toMatch(NO_PROMISE);
  });

  it('13. message et badge EN', async () => {
    lang.value = 'en';
    setActiveLanguage('en');
    await renderPage();
    expect(screen.getAllByText(EN_MESSAGE)).toHaveLength(4);
    expect(screen.getAllByText('Event cancelled').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText(FR_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: PAYMENT_BUTTON })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(NO_PROMISE);
    expect(screen.getByText(price(80))).toBeInTheDocument();
  });

  it('14. lecture seule : aucune écriture ni suppression, données chargées via get_my_pass_events', async () => {
    await renderPage();
    expect(rpcCalls).toContain('get_my_pass_events');
    const writes = queries.filter((q) => ['update', 'delete', 'insert', 'upsert'].includes(q.method));
    expect(writes).toEqual([]);
  });

  it('événement non annulé : comportement inchangé (Payer le solde toujours proposé)', async () => {
    passEvents = [];
    data.event_attendees = [];
    data.price_locks = [{ ...lockBase, id: 'lock-ok', event_id: 'evt-ok', locked_price: 100, total_paid: 30, remaining_amount: 70,
      expires_at: future(5), status: 'active', events: { id: 'evt-ok', title: 'Festival Publié', start_date: future(30) } }];
    await renderPage('Festival Publié');
    expect(screen.getByRole('button', { name: /Payer le solde/ })).toBeInTheDocument();
    expect(screen.queryByText('Événement annulé')).not.toBeInTheDocument();
  });

  it('erreur de get_my_pass_events : aucun plantage, billets masqués comme avant', async () => {
    passEvents = null as unknown as unknown[];
    await renderPage('Festival Expiré');
    expect(screen.queryByText('Festival Comptant')).not.toBeInTheDocument();
    // Le devis serveur event_cancelled suffit à bloquer le rachat.
    const c = card('Festival Expiré');
    expect(c.queryByRole('button')).not.toBeInTheDocument();
    expect(c.getByText(FR_MESSAGE)).toBeInTheDocument();
  });
});
