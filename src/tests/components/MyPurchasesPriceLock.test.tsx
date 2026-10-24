import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const future = (days: number) => new Date(now + days * DAY).toISOString();

const baseLock = {
  locked_price: 1,
  deposit_amount: 0.5,
  total_paid: 0.5,
  remaining_amount: 0.5,
  expires_at: future(5),
  status: 'active',
  balance_payment_mode: 'manual',
  auto_balance_payment_at: null,
  auto_balance_payment_status: null,
  event_ticket_types: { id: 'ett-1', ticket_types: { name: 'Full Pass' }, price_tiers: [] },
};

const baseTicket = {
  user_id: 'user-1',
  event_ticket_type_id: 'ett-1',
  qr_code: 'qr',
  checked_in_at: null,
  purchased_at: future(-1),
  created_at: future(-1),
  pass_file_path: null,
  attendee_first_name: 'Ana',
  attendee_last_name: 'Test',
  attendee_email: null,
  attendee_phone: null,
  event_ticket_types: { id: 'ett-1', price: 1, ticket_types: { name: 'Full Pass' } },
};

const festival = (id: string, title: string) => ({
  id,
  title,
  location: 'Lisbonne',
  start_date: future(30),
  end_date: future(31),
  thumbnail_url: null,
});

const ticket = (
  id: string,
  title: string,
  checkInStatus: string,
  weezeventStatus: string,
  passStatus = 'pending'
) => ({
  ...baseTicket,
  id,
  event_id: `evt-${id}`,
  check_in_status: checkInStatus,
  weezevent_sync_status: weezeventStatus,
  pass_status: passStatus,
  events: festival(`evt-${id}`, title),
});

const data: { price_locks: unknown[]; event_attendees: unknown[] } = { price_locks: [], event_attendees: [] };
const queries: { table: string; method: string; args: unknown[] }[] = [];

// Objets stables : MyPurchases recharge ses données à chaque changement de `user`.
const authValue = { user: { id: 'user-1' }, profile: { id: 'user-1', role: 'student' } };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authValue,
}));
vi.mock('../../contexts/CartContext', () => ({
  useCart: () => ({ clearCart: vi.fn() }),
}));
vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) =>
      ({
        'purchases.title': 'Mes Pass',
        'purchases.subtitle': 'Retrouvez vos Price Locks et vos billets de festivals',
      })[key] ?? key,
  }),
}));
vi.mock('../../lib/supabase', () => {
  const result = (table: string) => ({
    data: (data as Record<string, unknown[]>)[table] ?? [],
    error: null,
  });
  // Requête Supabase factice : chaînable et « thenable » comme le vrai client.
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'not', 'order', 'neq', 'is', 'limit', 'update']) {
      b[m] = (...args: unknown[]) => {
        queries.push({ table, method: m, args });
        return b;
      };
    }
    b.then = (
      resolve: (value: ReturnType<typeof result>) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(result(table)).then(resolve, reject);
    return b;
  };
  return {
    supabase: {
      from: (table: string) => {
        queries.push({ table, method: 'from', args: [] });
        return builder(table);
      },
      rpc: () => Promise.resolve({ data: null, error: null }),
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    },
  };
});

import { MyPurchases } from '../../pages/MyPurchases';

const FAILURE_MESSAGE = 'Le prélèvement automatique n’a pas abouti. Vous pouvez régler votre solde manuellement.';

const renderPage = async () => {
  render(<MyPurchases onNavigate={vi.fn()} />);
  await screen.findByText('Price Locks actifs');
};

describe('Mes Pass', () => {
  beforeEach(() => {
    data.price_locks = [];
    data.event_attendees = [];
    queries.length = 0;
  });

  it('affiche le titre, les deux sections et plus aucune navigation Academy', async () => {
    await renderPage();

    expect(screen.getByText('Mes Pass')).toBeInTheDocument();
    expect(screen.getByText('Retrouvez vos Price Locks et vos billets de festivals')).toBeInTheDocument();
    expect(screen.getByText('Mes billets')).toBeInTheDocument();
    for (const label of ['Professeurs', 'Programmes', 'Vidéos', 'Commandes']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    // Plus aucune requête vers les anciennes tables Academy / commandes
    const tables = new Set(queries.filter((q) => q.method === 'from').map((q) => q.table));
    expect([...tables].sort()).toEqual(['event_attendees', 'price_locks']);
  });

  it('affiche les états vides', async () => {
    await renderPage();

    expect(screen.getByText('Aucun Price Lock actif')).toBeInTheDocument();
    expect(screen.getByText('Vous n’avez pas encore de billet de festival.')).toBeInTheDocument();
  });

  it('affiche un Price Lock actif avec son billet, ses montants et le message d’échec uniquement si failed', async () => {
    data.price_locks = [
      {
        ...baseLock,
        id: 'lock-failed',
        balance_payment_mode: 'automatic',
        auto_balance_payment_at: future(2),
        auto_balance_payment_status: 'failed',
        events: { id: 'evt-1', title: 'Festival avec échec', start_date: future(30) },
      },
      {
        ...baseLock,
        id: 'lock-auto',
        balance_payment_mode: 'automatic',
        auto_balance_payment_at: future(2),
        events: { id: 'evt-2', title: 'Festival prélèvement prévu', start_date: future(30) },
      },
    ];
    await renderPage();

    expect(screen.getByText('Festival avec échec')).toBeInTheDocument();
    expect(screen.getByText('Festival prélèvement prévu')).toBeInTheDocument();
    expect(screen.getAllByText('Full Pass')).toHaveLength(2);
    expect(screen.getAllByText(FAILURE_MESSAGE)).toHaveLength(1);
    expect(screen.queryByText(/No such PaymentMethod/)).not.toBeInTheDocument();
    // Prélèvement prévu affiché seulement pour le lock non encore tenté
    expect(screen.getAllByText(/^Prélèvement automatique du solde prévu le/)).toHaveLength(1);
    expect(screen.getAllByText(/^Payer le solde/)).toHaveLength(2);
    expect(screen.queryByText('Aucun Price Lock actif')).not.toBeInTheDocument();
  });

  it('ne charge que les Price Locks actifs ou expirés (un lock completed n’apparaît pas)', async () => {
    await renderPage();

    const statusFilter = queries.find((q) => q.table === 'price_locks' && q.method === 'in');
    expect(statusFilter?.args).toEqual(['status', ['active', 'expired']]);
  });

  it('affiche des statuts de billet clairs, sans libellé « Pass : En attente »', async () => {
    data.event_attendees = [
      ticket('a', 'Festival solde', 'awaiting_balance', 'pending'),
      ticket('b', 'Festival émission', 'not_checked_in', 'pending'),
      ticket('c', 'Festival envoyé', 'not_checked_in', 'synced'),
      ticket('d', 'Festival problème', 'not_checked_in', 'failed'),
    ];
    await renderPage();

    expect(screen.getByText('Paiement du solde en attente')).toBeInTheDocument();
    expect(screen.getByText('Billet officiel en attente d’émission')).toBeInTheDocument();
    expect(screen.getByText('Billet officiel envoyé')).toBeInTheDocument();
    expect(screen.getByText('Problème lors de l’émission du billet')).toBeInTheDocument();
    expect(screen.queryByText(/Pass : /)).not.toBeInTheDocument();
    expect(screen.queryByText('Vous n’avez pas encore de billet de festival.')).not.toBeInTheDocument();
  });

  it('affiche le statut clair dans le détail du billet', async () => {
    data.event_attendees = [ticket('c', 'Festival envoyé', 'not_checked_in', 'synced')];
    await renderPage();

    fireEvent.click(screen.getByText('Billet officiel envoyé'));

    expect(await screen.findByText('Votre billet officiel a été émis et vous a été envoyé.')).toBeInTheDocument();
    expect(screen.queryByText(/Pass : En attente/)).not.toBeInTheDocument();
  });

  it('ignore les billets d’un événement dépublié sans planter', async () => {
    data.event_attendees = [
      { ...ticket('x', 'Festival dépublié', 'not_checked_in', 'pending'), events: null },
    ];
    await renderPage();

    expect(screen.getByText('Vous n’avez pas encore de billet de festival.')).toBeInTheDocument();
  });
});
