import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const baseLock = {
  locked_price: 1,
  deposit_amount: 0.5,
  total_paid: 0.5,
  remaining_amount: 0.5,
  expires_at: new Date(now + 5 * DAY).toISOString(),
  status: 'active',
  event_ticket_types: { id: 'ett-1', price_tiers: [] },
};

const priceLocks = [
  {
    ...baseLock,
    id: 'lock-failed',
    auto_balance_payment_status: 'failed',
    events: { id: 'evt-1', title: 'Festival avec échec', start_date: new Date(now + 30 * DAY).toISOString() },
  },
  {
    ...baseLock,
    id: 'lock-ok',
    auto_balance_payment_status: null,
    events: { id: 'evt-2', title: 'Festival sans échec', start_date: new Date(now + 30 * DAY).toISOString() },
  },
];

// Billet d'un événement dépublié : la jointure events revient à null (RLS).
const attendees = [
  { id: 'att-1', event_id: 'evt-draft', check_in_status: 'not_checked_in', events: null, event_ticket_types: null },
];

// Objets stables : MyPurchases recharge ses données à chaque changement de `user`.
const authValue = { user: { id: 'user-1' }, profile: { id: 'user-1', role: 'student' } };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authValue,
}));
vi.mock('../../contexts/CartContext', () => ({
  useCart: () => ({ clearCart: vi.fn() }),
}));
vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
vi.mock('../../lib/supabase', () => {
  const result = (table: string) => {
    if (table === 'price_locks') return { data: priceLocks, error: null };
    if (table === 'event_attendees') return { data: attendees, error: null };
    return { data: [], error: null };
  };
  // Requête Supabase factice : chaînable et « thenable » comme le vrai client.
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'not', 'order', 'neq', 'is', 'limit', 'update']) {
      b[m] = () => b;
    }
    b.then = (
      resolve: (value: ReturnType<typeof result>) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(result(table)).then(resolve, reject);
    return b;
  };
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: () => Promise.resolve({ data: null, error: null }),
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    },
  };
});

import { MyPurchases } from '../../pages/MyPurchases';

const FAILURE_MESSAGE = 'Le prélèvement automatique n’a pas abouti. Vous pouvez régler votre solde manuellement.';

describe('MyPurchases — Price Lock après échec du prélèvement automatique', () => {
  it('affiche un message simple uniquement pour le lock en échec, sans planter sur un événement dépublié', async () => {
    render(<MyPurchases onNavigate={vi.fn()} />);

    fireEvent.click((await screen.findAllByText('Billets'))[0]);

    expect(await screen.findByText('Festival avec échec')).toBeInTheDocument();
    expect(screen.getByText('Festival sans échec')).toBeInTheDocument();
    expect(screen.getAllByText(FAILURE_MESSAGE)).toHaveLength(1);
    expect(screen.queryByText(/No such PaymentMethod/)).not.toBeInTheDocument();
    // Le paiement manuel reste proposé
    expect(screen.getAllByText(/^Payer le solde/)).toHaveLength(2);
  });
});
