import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const visibleItem = {
  id: 'cart-1',
  quantity: 1,
  purchase_type: 'full_purchase',
  event_ticket_type: {
    id: 'ett-visible',
    price: 10,
    ticket_type: { id: 'tt-1', name: 'Full Pass' },
    event: { id: 'evt-1', title: 'Festival publié' },
  },
};

// Article d'un événement dépublié : la jointure events revient à null (RLS).
const unpublishedItem = {
  id: 'cart-2',
  quantity: 1,
  purchase_type: 'price_lock_deposit',
  event_ticket_type: {
    id: 'ett-draft',
    price: 1,
    ticket_type: { id: 'tt-1', name: 'Full Pass' },
    event: null,
  },
};

// Objet stable : le panier se recharge à chaque changement de `user`.
const authValue = { user: { id: 'user-1' } };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authValue,
}));
vi.mock('../../lib/supabase', () => {
  const result = (table: string) =>
    table === 'cart_event_tickets'
      ? { data: [visibleItem, unpublishedItem], error: null }
      : { data: [], error: null };
  // Requête Supabase factice : chaînable et « thenable » comme le vrai client.
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order']) {
      b[m] = () => b;
    }
    b.then = (
      resolve: (value: ReturnType<typeof result>) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(result(table)).then(resolve, reject);
    return b;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});

import { CartProvider, useCart } from '../../contexts/CartContext';

function EventTicketTitles() {
  const { eventTickets } = useCart();
  return (
    <ul>
      {eventTickets.map((ticket) => (
        <li key={ticket.id}>{ticket.eventTicketType.event.title}</li>
      ))}
    </ul>
  );
}

describe('CartContext — article d’un événement dépublié', () => {
  it('ignore l’article dont l’événement n’est plus visible au lieu de faire planter le panier', async () => {
    render(
      <CartProvider>
        <EventTicketTitles />
      </CartProvider>
    );

    expect(await screen.findByText('Festival publié')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
