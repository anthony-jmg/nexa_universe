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
// Offres de rachat renvoyées par get_price_lock_repurchase_quote, par lock.
const quotes: Record<string, unknown> = {};
const rpcCalls: { fn: string; args: unknown }[] = [];
// Réservations annulées d'un Price Lock expiré, renvoyées par la base.
const hiddenReservations: string[] = [];
const queries: { table: string; method: string; args: unknown[] }[] = [];

// Objets stables : MyPurchases recharge ses données à chaque changement de `user`.
const authValue = { user: { id: 'user-1' }, profile: { id: 'user-1', role: 'student' } };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authValue,
}));
vi.mock('../../contexts/CartContext', () => ({
  useCart: () => ({ clearCart: vi.fn() }),
}));
// Vrai dictionnaire français (Mes Pass est traduit depuis le LOT 4).
vi.mock('../../contexts/LanguageContext', async () => {
  const { translate } = await import('../../i18n/translations');
  return {
    useLanguage: () => ({
      t: (key: string, params?: Record<string, string | number>) => translate('fr', key, params),
      language: 'fr',
    }),
  };
});
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
      rpc: (fn: string, args: { p_lock_id?: string }) => {
        rpcCalls.push({ fn, args });
        if (fn === 'get_my_expired_price_lock_reservation_ids') {
          return Promise.resolve({ data: [...hiddenReservations], error: null });
        }
        return Promise.resolve({ data: (args?.p_lock_id && quotes[args.p_lock_id]) ?? null, error: null });
      },
      auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'token' } } }) },
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
    rpcCalls.length = 0;
    hiddenReservations.length = 0;
    for (const key of Object.keys(quotes)) delete quotes[key];
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

  it('affiche les états vides et renvoie vers Nexa Pass', async () => {
    const onNavigate = vi.fn();
    render(<MyPurchases onNavigate={onNavigate} />);
    await screen.findByText('Price Locks actifs');

    expect(screen.getByText('Aucun Price Lock actif')).toBeInTheDocument();
    expect(screen.getByText('Vous n’avez pas encore de billet de festival.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Découvrir les événements'));
    expect(onNavigate).toHaveBeenCalledWith('shop');
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

  it('ne propose plus l’ancien PDF Nexa et reste neutre pour skipped', async () => {
    data.event_attendees = [
      ticket('p', 'Festival PDF Nexa', 'not_checked_in', 'pending', 'available'),
      ticket('s', 'Festival sans Weezevent', 'not_checked_in', 'skipped'),
    ];
    await renderPage();

    // PDF disponible mais Weezevent pending : toujours « en attente d’émission »
    expect(screen.getByText('Billet officiel en attente d’émission')).toBeInTheDocument();
    expect(screen.queryByText('Billet officiel disponible')).not.toBeInTheDocument();
    expect(screen.getByText('Achat confirmé')).toBeInTheDocument();
    expect(screen.getAllByText(/Billet officiel/)).toHaveLength(1);

    // Détail : l'ancien PDF Nexa n'est plus proposé (seul le billet Weezevent fait foi)
    fireEvent.click(screen.getByText('Billet officiel en attente d’émission'));
    expect(await screen.findByText('Votre achat est confirmé. Votre billet officiel sera émis prochainement.')).toBeInTheDocument();
    expect(screen.queryByText('Voir mon pass')).not.toBeInTheDocument();
    expect(screen.queryByText('Document PDF ajouté par l’équipe Nexa.')).not.toBeInTheDocument();
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

  describe('Price Lock expiré : achat au prix actuel, versement déduit', () => {
    const expiredLock = (id: string) => ({
      ...baseLock,
      id,
      locked_price: 80,
      deposit_amount: 20,
      total_paid: 20,
      remaining_amount: 75,
      status: 'expired',
      expires_at: future(-2),
      events: { id: `evt-${id}`, title: `Festival ${id}`, start_date: future(30) },
    });
    const quote = (id: string, status: string, current: number | null, due: number | null) => ({
      status, lock_id: id, current_price: current, credit: 20, amount_due: due,
    });

    it('affiche le crédit et propose « Acheter au prix actuel » (95 € − 20 € = 75 €)', async () => {
      data.price_locks = [expiredLock('x1')];
      quotes.x1 = quote('x1', 'available', 95, 75);
      await renderPage();

      expect(await screen.findByText('Price Lock expiré')).toBeInTheDocument();
      expect(screen.getByText('Ton ancien tarif n’est plus garanti.')).toBeInTheDocument();
      expect(screen.getByText(/Les 20\s€ déjà versés restent déductibles du prix actuel\./)).toBeInTheDocument();
      expect(screen.getByText(/95\s€/)).toBeInTheDocument();
      expect(screen.getByText('Reste à payer :')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Acheter au prix actuel — 75\s€$/ })).toBeInTheDocument();
      // Ce n'est plus le solde du lock d'origine
      expect(screen.queryByText(/Payer le solde|Payer le nouveau solde/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Prix bloqué/)).not.toBeInTheDocument();
      expect(rpcCalls).toContainEqual({ fn: 'get_price_lock_repurchase_quote', args: { p_lock_id: 'x1' } });
    });

    it('lance un checkout price_lock_repurchase pour ce lock uniquement', async () => {
      data.price_locks = [expiredLock('x1')];
      quotes.x1 = quote('x1', 'available', 95, 75);
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'Ce pass est complet pour le moment.' }) });
      vi.stubGlobal('fetch', fetchMock);
      await renderPage();

      fireEvent.click(await screen.findByRole('button', { name: /^Acheter au prix actuel/ }));

      expect(await screen.findByText('Ce pass est complet pour le moment.')).toBeInTheDocument();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/functions\/v1\/create-stripe-checkout$/);
      const body = JSON.parse(init.body);
      expect(body.payment_type).toBe('price_lock_repurchase');
      expect(body.metadata.price_lock_id).toBe('x1');
      vi.unstubAllGlobals();
    });

    it.each([
      ['contact_us', 'Contacte-nous pour finaliser ton pass.', 10],
      ['sold_out', 'Ce pass est complet pour le moment.', 95],
      ['unavailable', 'Ce pass n’est pas disponible à la vente pour le moment.', 95],
    ])('%s : montant conservé, message clair et aucun bouton d’achat', async (status, message, price) => {
      data.price_locks = [expiredLock('x2')];
      quotes.x2 = quote('x2', status, price, null);
      await renderPage();

      expect(await screen.findByText(message)).toBeInTheDocument();
      // Indisponibilité temporaire : le montant reste déductible
      expect(screen.getByText(/déjà versés restent déductibles du prix actuel/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Acheter au prix actuel/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Payer le/)).not.toBeInTheDocument();
    });

    it.each([
      ['sales_closed', 'les ventes de ce pass sont terminées'],
      ['event_started', 'l’événement a commencé'],
    ])('credit_lapsed (%s) : montant définitivement inutilisable, aucun bouton', async (reason, cause) => {
      data.price_locks = [expiredLock('x4')];
      quotes.x4 = { ...quote('x4', 'credit_lapsed', 95, null), lapsed_reason: reason };
      await renderPage();

      expect(await screen.findByText('Price Lock expiré')).toBeInTheDocument();
      expect(
        screen.getByText(new RegExp(`Le montant de 20\\s€ que tu avais versé n’est plus utilisable car ${cause}\\.`))
      ).toBeInTheDocument();
      expect(screen.queryByText(/restent déductibles|reste déductible/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Reste à payer/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Acheter au prix actuel|Payer le/ })).not.toBeInTheDocument();
    });

    it('event_cancelled : traitement séparé, montant non déclaré perdu, aucun bouton', async () => {
      // Événement annulé : masqué au client par RLS, le titre vient du devis serveur
      data.price_locks = [{ ...expiredLock('x5'), events: null }];
      quotes.x5 = { ...quote('x5', 'event_cancelled', 95, null), event_title: 'Festival annulé' };
      await renderPage();

      expect(await screen.findByText('Festival annulé')).toBeInTheDocument();
      expect(
        screen.getByText('Cet événement a été annulé. Ton versement est en cours de traitement selon les conditions applicables.')
      ).toBeInTheDocument();
      expect(screen.queryByText(/n’est plus utilisable/)).not.toBeInTheDocument();
      expect(screen.queryByText(/restent déductibles/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Acheter au prix actuel|Payer le/ })).not.toBeInTheDocument();
    });

    it('un lock actif dont la date limite est passée n’est plus soldable à l’ancien prix', async () => {
      data.price_locks = [{ ...expiredLock('x3'), status: 'active' }];
      quotes.x3 = quote('x3', 'available', 95, 75);
      await renderPage();

      expect(await screen.findByText('Price Lock expiré')).toBeInTheDocument();
      expect(screen.queryByText(/Payer le solde/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Acheter au prix actuel/ })).toBeInTheDocument();
    });

    it('requêtes Supabase bien formées (pas de virgule avant une parenthèse)', async () => {
      await renderPage();
      const selects = queries.filter((q) => q.method === 'select').map((q) => String(q.args[0]));
      expect(selects.length).toBeGreaterThan(0);
      for (const select of selects) expect(select).not.toMatch(/,\s*\)/);
    });

    it('n’affiche plus un lock dont le crédit a déjà été utilisé', async () => {
      await renderPage();
      expect(queries).toContainEqual({ table: 'price_locks', method: 'is', args: ['credit_consumed_at', null] });
    });
  });

  describe('Mes billets après rachat d’un Price Lock expiré', () => {
    it('masque uniquement la réservation annulée du Price Lock expiré', async () => {
      data.event_attendees = [
        ticket('valide', 'Festival F', 'not_checked_in', 'pending'),
        ticket('reservation', 'Festival F', 'cancelled', 'pending'),
        ticket('autre-annule', 'Festival G', 'cancelled', 'pending'),
      ];
      hiddenReservations.push('reservation');
      await renderPage();

      expect(screen.getByText('Festival F')).toBeInTheDocument();
      expect(screen.getAllByText('Festival F')).toHaveLength(1);
      expect(screen.getByText('Billet officiel en attente d’émission')).toBeInTheDocument();
      // Un billet annulé sans lien avec un Price Lock expiré reste visible
      expect(screen.getByText('Festival G')).toBeInTheDocument();
      expect(rpcCalls.map((c) => c.fn)).toContain('get_my_expired_price_lock_reservation_ids');
    });

    it('sans réponse de la base, ne masque aucun billet', async () => {
      data.event_attendees = [ticket('reservation', 'Festival F', 'cancelled', 'pending')];
      await renderPage();
      expect(screen.getByText('Festival F')).toBeInTheDocument();
    });
  });
});
