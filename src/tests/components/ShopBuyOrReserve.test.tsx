import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

// Reproduit « [TEST] Price Lock A » : un seul type de billet, 1,00 € puis 2,00 €
// dans 5 jours, acompte minimum 0,50 € (événement is_test).
const testEvent = {
  id: 'evt-a',
  title: '[TEST] Price Lock A — solde manuel',
  description: 'Événement de test interne Price Lock — ne pas acheter.',
  location: 'Test',
  start_date: new Date(now + 30 * DAY).toISOString(),
  end_date: new Date(now + 31 * DAY).toISOString(),
  thumbnail_url: '',
  is_active: true,
  event_status: 'published',
  is_test: true,
  event_ticket_types: [
    {
      id: 'ett-a',
      event_id: 'evt-a',
      ticket_type_id: 'tt-test',
      price: 1,
      quantity_available: null,
      quantity_sold: 0,
      max_per_order: 1,
      sale_start_date: new Date(now - DAY).toISOString(),
      sale_end_date: null,
      is_active: true,
      next_price: 2,
      price_increase_date: new Date(now + 5 * DAY).toISOString(),
      price_lock_enabled: true,
      price_lock_deposit_amount: 0.5,
      price_lock_guarantee_days: 1,
      price_lock_opens_at: null,
      ticket_type: { id: 'tt-test', name: 'Full Pass Test', description: 'Accès à toutes les soirées', description_en: null as string | null },
      price_tiers: [
        { label: 'Test early', price: 1, starts_at: new Date(now - DAY).toISOString(), ends_at: new Date(now + 5 * DAY).toISOString() },
        { label: 'Test regular', price: 2, starts_at: new Date(now + 5 * DAY).toISOString(), ends_at: null },
      ],
    },
  ],
};

const addEventTicketToCart = vi.fn().mockResolvedValue(undefined);

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, profile: null }),
}));
vi.mock('../../contexts/CartContext', () => ({
  useCart: () => ({ addToCart: vi.fn(), addEventTicketToCart, getCartCount: () => 0 }),
}));
const lang = vi.hoisted(() => ({ current: 'fr' as 'fr' | 'en' }));
vi.mock('../../contexts/LanguageContext', async () => {
  const { translate } = await import('../../i18n/translations');
  return {
    useLanguage: () => ({
      t: (key: string, params?: Record<string, string | number>) => translate(lang.current, key, params),
      language: lang.current,
    }),
  };
});
vi.mock('../../lib/supabase', () => {
  const result = (table: string) =>
    table === 'events'
      ? { data: [testEvent], error: null, count: 1 }
      : { data: [], error: null, count: 0 };
  // Requête Supabase factice : chaînable et « thenable » comme le vrai client.
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gte', 'or', 'order', 'range', 'neq', 'is', 'limit']) {
      b[m] = () => b;
    }
    b.maybeSingle = () => Promise.resolve({ data: null, error: null });
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

import { Shop } from '../../pages/Shop';

describe('Shop — CTA « Acheter ou réserver »', () => {
  beforeEach(() => {
    addEventTicketToCart.mockClear();
    lang.current = 'fr';
    testEvent.event_ticket_types[0].ticket_type.description_en = null;
  });

  it('ouvre la modale de choix sans rien ajouter au panier, puis Price Lock avec minimum 0,50 €', async () => {
    render(<Shop onNavigate={vi.fn()} />);

    const cta = await screen.findByRole('button', { name: 'Acheter ou réserver' });
    fireEvent.click(cta);

    // Aucune mutation du panier au clic
    expect(addEventTicketToCart).not.toHaveBeenCalled();

    // Modale de choix affichée
    expect(await screen.findByText('Comment souhaites-tu réserver ton pass ?')).toBeInTheDocument();
    expect(screen.getByText('Acheter maintenant')).toBeInTheDocument();
    const priceLockOption = screen.getByRole('button', { name: /^Price Lock\s*Verse une partie aujourd/ });
    expect(priceLockOption).toBeInTheDocument();

    // Choix Price Lock : montant du versement sélectionnable, minimum 0,50 € (is_test)
    fireEvent.click(priceLockOption);
    const depositInput = await screen.findByLabelText('Montant du dépôt pour Full Pass Test');
    expect(depositInput).toHaveAttribute('min', '0.5');
    expect(depositInput.getAttribute('placeholder')?.replace(/[\u202f\u00a0]/g, ' ')).toBe('Autre montant · min. 0,50 €');
    fireEvent.change(depositInput, { target: { value: '0.60' } });
    expect(depositInput).toHaveValue('0.60');

    // Toujours rien dans le panier tant que l'utilisateur n'a pas validé
    await waitFor(() => expect(addEventTicketToCart).not.toHaveBeenCalled());
  });
});

describe('Shop — description du billet selon la langue', () => {
  beforeEach(() => {
    lang.current = 'fr';
    testEvent.event_ticket_types[0].ticket_type.description_en = null;
  });

  // Libellés selon la langue active (le parcours est traduit depuis le LOT 3).
  const openChoice = async () => {
    const en = lang.current === 'en';
    render(<Shop onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: en ? 'Buy or reserve' : 'Acheter ou réserver' }));
    await screen.findByText(en ? 'How would you like to book your pass?' : 'Comment souhaites-tu réserver ton pass ?');
  };

  it('EN renseigné : description anglaise ; nom commercial inchangé', async () => {
    lang.current = 'en';
    testEvent.event_ticket_types[0].ticket_type.description_en = 'Access to all parties';
    await openChoice();
    expect(screen.getAllByText('Access to all parties').length).toBeGreaterThan(0);
    expect(screen.queryByText('Accès à toutes les soirées')).not.toBeInTheDocument();
    expect(screen.getAllByText('Full Pass Test').length).toBeGreaterThan(0);
  });

  it('EN absent : repli sur la description française', async () => {
    lang.current = 'en';
    await openChoice();
    expect(screen.getAllByText('Accès à toutes les soirées').length).toBeGreaterThan(0);
  });
});
