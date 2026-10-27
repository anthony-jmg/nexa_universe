import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import type { ReactElement } from 'react';

// i18n LOT 3 : parcours public d'achat (accueil, Nexa Pass, page festival,
// panier, retour de paiement) en français puis en anglais, avec le vrai
// LanguageProvider et le vrai dictionnaire.

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (days: number) => new Date(now + days * DAY).toISOString();

const ticketType = {
  id: 'tt-1',
  name: 'FULL PASS HOMME',
  description: 'Accès à toutes les soirées',
  description_en: 'Access to all parties' as string | null,
};

const ett = {
  id: 'ett-1',
  event_id: 'evt-1',
  ticket_type_id: 'tt-1',
  price: 80,
  quantity_available: 100,
  quantity_sold: 0,
  max_per_order: 4,
  sale_start_date: iso(-10),
  sale_end_date: iso(40),
  is_active: true,
  display_order: 0,
  features: [],
  next_price: 95,
  price_increase_date: iso(20),
  price_lock_enabled: true,
  price_lock_deposit_amount: 20,
  price_lock_guarantee_days: 30,
  price_lock_opens_at: iso(-1),
  ticket_type: ticketType,
  price_tiers: [
    { label: 'Early', price: 80, starts_at: iso(-10), ends_at: iso(20) },
    { label: 'Regular', price: 95, starts_at: iso(20), ends_at: null },
  ],
};

const event = {
  id: 'evt-1',
  title: 'Lisbon Kizomba Festival',
  description: 'Trois jours de danse au bord du Tage.',
  description_en: 'Three days of dancing by the Tagus.' as string | null,
  location: 'Lisboa',
  start_date: iso(60),
  end_date: iso(62),
  thumbnail_url: null,
  is_active: true,
  is_test: false,
  event_status: 'published',
  event_ticket_types: [ett],
};

const cartTicket = {
  eventTicketType: { ...ett, event },
  quantity: 2,
  purchaseType: 'full_purchase',
  priceSnapshot: 80,
};
const cartState = { eventTickets: [] as unknown[] };

vi.mock('../../contexts/AuthContext', () => {
  const value = { user: { id: 'user-1' }, profile: { id: 'user-1', role: 'student', full_name: 'Ana Test', email: 'ana@example.com' }, signOut: vi.fn() };
  return { useAuth: () => value };
});
vi.mock('../../contexts/CartContext', () => ({
  useCart: () => ({
    cart: [],
    eventTickets: cartState.eventTickets,
    addToCart: vi.fn(),
    addEventTicketToCart: vi.fn(),
    getCartCount: () => 0,
    clearCart: vi.fn(),
    updateQuantity: vi.fn(),
    updateEventTicketQuantity: vi.fn(),
    updateEventTicketPricing: vi.fn(),
    updateEventTicketBalanceMode: vi.fn(),
    removeFromCart: vi.fn(),
    removeEventTicketFromCart: vi.fn(),
  }),
}));
vi.mock('../../lib/supabase', () => {
  const rows = (table: string) => (table === 'events' ? [event] : []);
  // Requête Supabase factice : chaînable et « thenable » comme le vrai client.
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gte', 'or', 'order', 'range', 'neq', 'is', 'not', 'limit', 'update']) {
      b[m] = () => b;
    }
    b.maybeSingle = () => Promise.resolve({ data: rows(table)[0] ?? null, error: null });
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows(table), error: null, count: rows(table).length }).then(resolve, reject);
    return b;
  };
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: () => Promise.resolve({ data: [], error: null }),
      auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'token' } } }) },
    },
  };
});

import { LanguageProvider } from '../../contexts/LanguageContext';
import { LanguageSelector } from '../../components/LanguageSelector';
import { Landing } from '../../pages/Landing';
import { Shop } from '../../pages/Shop';
import { EventDetail } from '../../pages/EventDetail';
import { Cart } from '../../pages/Cart';
import { MyPurchases } from '../../pages/MyPurchases';
import { setActiveLanguage } from '../../lib/locale';
import { purchaseErrorMessage } from '../../lib/purchaseErrors';
import { translate } from '../../i18n/translations';

// Langue mémorisée (localStorage neutralisé par le setup global) : stockage en mémoire.
const store = new Map<string, string>();
vi.mocked(localStorage.getItem).mockImplementation((k: string) => store.get(k) ?? null);
vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => void store.set(k, String(v)));

const renderIn = (language: 'fr' | 'en', ui: ReactElement) => {
  store.clear();
  store.set('language', language);
  setActiveLanguage(language);
  return render(
    <LanguageProvider>
      <LanguageSelector />
      {ui}
    </LanguageProvider>
  );
};

// Espaces insécables d'Intl normalisés pour comparer les montants.
const text = () => (document.body.textContent ?? '').replace(/[\u202f\u00a0]/g, ' ');

const switchToEnglish = () => {
  fireEvent.click(screen.getByRole('button', { name: '🇫🇷' }));
  fireEvent.click(screen.getByText('English'));
};

beforeEach(() => {
  cleanup();
  ticketType.description_en = 'Access to all parties';
  event.description_en = 'Three days of dancing by the Tagus.';
  cartState.eventTickets = [];
});

describe('A/B — Accueil', () => {
  it('FR : textes français', async () => {
    renderIn('fr', <Landing onNavigate={vi.fn()} />);
    expect(screen.getByText('Apprenez. Réservez.')).toBeInTheDocument();
    expect(screen.getAllByText('Découvrir Nexa Pass').length).toBeGreaterThan(0);
    expect(screen.getByText('Qu’est-ce qu’un Price Lock ?')).toBeInTheDocument();
    expect(screen.getByText('Mentions légales')).toBeInTheDocument();
    expect((await screen.findAllByText('À partir de 80 €')).length).toBeGreaterThan(0);
  });

  it('EN : textes anglais, noms de marque inchangés', async () => {
    renderIn('en', <Landing onNavigate={vi.fn()} />);
    expect(screen.getByText('Learn. Book.')).toBeInTheDocument();
    expect(screen.getAllByText('Discover Nexa Pass').length).toBeGreaterThan(0);
    expect(screen.getByText('What is a Price Lock?')).toBeInTheDocument();
    expect(screen.getByText('Legal notice')).toBeInTheDocument();
    expect(screen.getByText('© 2024 NEXA UNIVERSE. All rights reserved.')).toBeInTheDocument();
    expect((await screen.findAllByText('From €80')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Apprenez. Réservez.')).not.toBeInTheDocument();
  });
});

describe('C — Nexa Pass (Shop)', () => {
  it('FR', async () => {
    renderIn('fr', <Shop onNavigate={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Acheter ou réserver' })).toBeInTheDocument();
    expect(screen.getByText('Réserve tes festivals avant que les prix augmentent.')).toBeInTheDocument();
    expect(screen.getByText('Prix actuel')).toBeInTheDocument();
    expect(text()).toContain('Verse 20 € pour bloquer ce tarif');
  });

  it('EN : carte, détails et choix de réservation', async () => {
    renderIn('en', <Shop onNavigate={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Buy or reserve' })).toBeInTheDocument();
    expect(screen.getByText('Book your festivals before prices go up.')).toBeInTheDocument();
    expect(screen.getByText('Current price')).toBeInTheDocument();
    expect(screen.getByText('Price Lock available')).toBeInTheDocument();
    expect(text()).toContain('Pay €20 to lock in this price');
    expect(screen.getByPlaceholderText('Search for a festival...')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(screen.getByText('Three days of dancing by the Tagus.')).toBeInTheDocument();
    expect(screen.getByText('Prices')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Buy or reserve' }));
    expect(screen.getByText('How would you like to book your pass?')).toBeInTheDocument();
    expect(screen.getByText('Buy now')).toBeInTheDocument();
    expect(screen.getByText('Access to all parties')).toBeInTheDocument();
    expect(screen.getByText('FULL PASS HOMME')).toBeInTheDocument();
  });
});

describe('D/G/H — Page festival (EventDetail)', () => {
  it('FR', async () => {
    renderIn('fr', <EventDetail eventId="evt-1" onNavigate={vi.fn()} />);
    expect(await screen.findByText('À propos du festival')).toBeInTheDocument();
    expect(screen.getByText('Trois jours de danse au bord du Tage.')).toBeInTheDocument();
    expect(screen.getByText('Choisis ton Full Pass')).toBeInTheDocument();
    expect(text()).toContain('Acheter maintenant — 80 €');
    expect(screen.getByText('Informations pratiques')).toBeInTheDocument();
  });

  it('EN + description EN renseignée → anglais', async () => {
    renderIn('en', <EventDetail eventId="evt-1" onNavigate={vi.fn()} />);
    expect(await screen.findByText('About the festival')).toBeInTheDocument();
    expect(screen.getByText('Three days of dancing by the Tagus.')).toBeInTheDocument();
    expect(screen.getByText('Access to all parties')).toBeInTheDocument();
    expect(screen.getByText('Choose your Full Pass')).toBeInTheDocument();
    expect(text()).toContain('Buy now — €80');
    expect(text()).toContain('Lock my price — €20');
    expect(screen.getByText('Practical information')).toBeInTheDocument();
    expect(screen.getByText('10:00 — Welcome and Full Pass collection')).toBeInTheDocument();
    // Nom officiel et nom commercial communs aux deux langues
    expect(screen.getByText('Lisbon Kizomba Festival')).toBeInTheDocument();
    expect(screen.getByText('FULL PASS HOMME')).toBeInTheDocument();
  });

  it('EN + description EN absente → repli sur le français', async () => {
    event.description_en = null;
    ticketType.description_en = '';
    renderIn('en', <EventDetail eventId="evt-1" onNavigate={vi.fn()} />);
    expect(await screen.findByText('About the festival')).toBeInTheDocument();
    expect(screen.getByText('Trois jours de danse au bord du Tage.')).toBeInTheDocument();
    expect(screen.getByText('Accès à toutes les soirées')).toBeInTheDocument();
  });
});

describe('E — Panier', () => {
  it('FR', () => {
    cartState.eventTickets = [cartTicket];
    renderIn('fr', <Cart onNavigate={vi.fn()} />);
    expect(screen.getByText('Billet d\'événement')).toBeInTheDocument();
    expect(screen.getByText('Achat comptant')).toBeInTheDocument();
    expect(screen.getByText('Continuer')).toBeInTheDocument();
    expect(text()).toContain('Total160 €');
  });

  it('EN : panier, étape participants et récapitulatif', () => {
    cartState.eventTickets = [cartTicket];
    renderIn('en', <Cart onNavigate={vi.fn()} />);
    expect(screen.getByText('Event ticket')).toBeInTheDocument();
    expect(screen.getByText('Full payment')).toBeInTheDocument();
    expect(text()).toContain('Total€160');

    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('Passes are personal. Enter the details of the holder of each ticket.')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('First name')).toHaveLength(2);
    fireEvent.click(screen.getByText('Continue'));
    // Validation traduite
    expect(screen.getByText('Please enter the first and last name of participant 1')).toBeInTheDocument();
  });

  it('EN : panier vide', () => {
    renderIn('en', <Cart onNavigate={vi.fn()} />);
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByText('View Nexa Pass')).toBeInTheDocument();
  });
});

describe('F — Retour de paiement', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  const returnFromStripe = (language: 'fr' | 'en') => {
    // Vérification en cours : la réponse du serveur n'arrive pas pendant le test.
    fetchSpy.mockImplementation(() => new Promise(() => {}));
    window.history.replaceState({}, '', '/my-purchases?payment=success&session_id=cs_test_1');
    renderIn(language, <MyPurchases onNavigate={vi.fn()} />);
  };

  it('FR', async () => {
    returnFromStripe('fr');
    expect(await screen.findByText('Confirmation du paiement en cours...')).toBeInTheDocument();
  });

  it('EN', async () => {
    returnFromStripe('en');
    expect(await screen.findByText('Confirming your payment...')).toBeInTheDocument();
  });
});

describe('I/J — changement de langue', () => {
  it('sans rechargement : les textes visibles changent immédiatement', async () => {
    renderIn('fr', <Shop onNavigate={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Acheter ou réserver' })).toBeInTheDocument();
    switchToEnglish();
    expect(screen.getByRole('button', { name: 'Buy or reserve' })).toBeInTheDocument();
    expect(screen.getByText('Book your festivals before prices go up.')).toBeInTheDocument();
    expect(text()).toContain('€80');
    expect(screen.queryByText('Prix actuel')).not.toBeInTheDocument();
  });

  it('accueil : bascule immédiate, dates et prix compris', async () => {
    renderIn('fr', <Landing onNavigate={vi.fn()} />);
    expect((await screen.findAllByText('À partir de 80 €')).length).toBeGreaterThan(0);
    switchToEnglish();
    expect(screen.getByText('Learn. Book.')).toBeInTheDocument();
    expect(screen.getAllByText('From €80').length).toBeGreaterThan(0);
    expect(text()).toContain('in 20 days');
  });

  it('rechargement en EN : reste en anglais', async () => {
    const first = renderIn('fr', <EventDetail eventId="evt-1" onNavigate={vi.fn()} />);
    await screen.findByText('À propos du festival');
    switchToEnglish();
    expect(store.get('language')).toBe('en');
    first.unmount();

    // Nouvelle instance de l'application avec la langue mémorisée
    setActiveLanguage('fr');
    render(
      <LanguageProvider>
        <EventDetail eventId="evt-1" onNavigate={vi.fn()} />
      </LanguageProvider>
    );
    expect(await screen.findByText('About the festival')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('Erreurs serveur du parcours d’achat', () => {
  const en = (key: string, params?: Record<string, string | number>) => translate('en', key, params);
  const fr = (key: string, params?: Record<string, string | number>) => translate('fr', key, params);

  it('messages connus traduits, apostrophes typographiques comprises', () => {
    expect(purchaseErrorMessage(new Error('Ce billet n’est plus disponible à la vente.'), en)).toBe('This ticket is no longer on sale.');
    expect(purchaseErrorMessage(new Error('Ventes closes pour ce billet.'), en)).toBe('Sales are closed for this ticket.');
    expect(purchaseErrorMessage(new Error('Insufficient tickets available. Only 3 left.'), en)).toBe('Not enough places left: 3 remaining.');
    expect(purchaseErrorMessage(new Error('Insufficient tickets available. Only 3 left.'), fr)).toBe('Plus assez de places : 3 restante(s).');
    expect(purchaseErrorMessage(new Error('Tu as déjà un Price Lock actif pour ce festival.'), en)).toBe('You already have an active Price Lock for this festival.');
  });

  it('message inconnu ou technique → message générique traduit', () => {
    expect(purchaseErrorMessage(new Error('duplicate key value violates unique constraint'), en)).toBe('Something went wrong. Please try again.');
    expect(purchaseErrorMessage(undefined, fr)).toBe('Une erreur est survenue. Réessaie.');
  });
});

describe('K — aucun texte français codé en dur dans les écrans actifs du LOT 3', () => {
  const src = join(__dirname, '../..');
  const FILES = [
    'pages/Landing.tsx',
    'components/Header.tsx',
    'pages/Shop.tsx',
    'pages/EventDetail.tsx',
    'pages/Events.tsx',
    'pages/Cart.tsx',
    'components/OfflineBanner.tsx',
    'components/ErrorBoundary.tsx',
    'pages/NotFound.tsx',
  ];

  // Exceptions justifiées : blocs de Shop.tsx jamais affichés, retirés avant
  // l'analyse — onglet Merchandise supprimé de l'interface, modale / sélecteur /
  // retour Price Lock sans point d'entrée (openPriceLockModal n'est plus appelé).
  // À traiter avec le LOT 4 ou à supprimer avec le code historique.
  const INACTIVE_SHOP_BLOCKS: [string, string][] = [
    ['  const openPriceLockModal = async', '  const closePriceLockModal = '],
    ['        ) : filteredProducts.length === 0 ? (', '      {lightboxImage && ('],
    ['      {selectedProduct && (', '      {lightbox && ('],
    ['      {priceLockResult && (() => {', '    </div>\n  );\n}\n'],
  ];

  const activeCode = (file: string): string => {
    let code = readFileSync(join(src, file), 'utf8');
    if (file !== 'pages/Shop.tsx') return code;
    for (const [start, end] of INACTIVE_SHOP_BLOCKS) {
      const from = code.indexOf(start);
      const to = code.indexOf(end, from + start.length);
      expect(from, start).toBeGreaterThan(-1);
      expect(to, end).toBeGreaterThan(from);
      code = code.slice(0, from) + code.slice(to);
    }
    return code;
  };

  const FRENCH = /[À-ÿ’]|\b(Voir|Aucun|Retour|Réserver|Prix|Payer|Annuler|Fermer|Paiement|Billet|billets?|Complet|Suivant|Précédent|le|la|les|du|des|pour|avec|sur|ton|ta|tes|votre|vos)\b/;

  const frenchStrings = (code: string): string[] => {
    const lines = code
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .split('\n')
      .map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'));
    const found: string[] = [];
    for (const line of lines) {
      const clean = line.replace(/\bt\(\s*'[^']*'/g, '').replace(/className=("[^"]*"|\{`[^`]*`\})/g, '');
      const jsxText = [...clean.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim());
      if (/^\s*[A-Za-zÀ-ÿ][^<>{}=;()]*$/.test(clean) && !/^\s*(import|export|const|let|return|if|else|type|interface|case|default)\b/.test(clean)) {
        jsxText.push(clean.trim());
      }
      const literals = [...clean.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
      for (const s of [...jsxText, ...literals]) {
        if (FRENCH.test(s) && /[a-zA-Z]{2}/.test(s)) found.push(s);
      }
    }
    return found;
  };

  it('chaque texte visible passe par t(…), hors exceptions justifiées', () => {
    const offenders = FILES.flatMap((file) => frenchStrings(activeCode(file)).map((s) => `${file}: ${s}`));
    expect(offenders).toEqual([]);
  });

  it('plus de fr-FR, de toFixed ni de « € » concaténé dans ces écrans', () => {
    for (const file of FILES) {
      const code = activeCode(file);
      expect(code, file).not.toMatch(/'fr-FR'|getActiveLocale\(\)/);
      expect(code, file).not.toMatch(/\.toFixed\([0-9]\)\s*\}?\s*(&nbsp;)?\s*€|\}\s*€/);
    }
  });

  it('le détecteur repère bien un texte français codé en dur', () => {
    expect(frenchStrings('<p>Voir les détails</p>')).toEqual(['Voir les détails']);
    expect(frenchStrings("<p>{t('pass.card.details')}</p>")).toEqual([]);
  });

  it('les nouvelles clés existent en français et en anglais', async () => {
    const { translations } = await import('../../i18n/translations');
    const prefixes = ['home.', 'footer.', 'pass.', 'event.', 'events.', 'checkout.', 'payment.', 'purchaseError.', 'errorPage.', 'notFound.'];
    const keys = Object.keys(translations.fr).filter((k) => prefixes.some((p) => k.startsWith(p)));
    expect(keys.length).toBeGreaterThan(250);
    expect(keys.filter((k) => !translations.en[k])).toEqual([]);
  });

  it('aucune clé brute ni paramètre non remplacé sur une carte', async () => {
    renderIn('en', <Shop onNavigate={vi.fn()} />);
    const card = (await screen.findByRole('button', { name: 'Buy or reserve' })).closest('div[id^="event-card-"]') as HTMLElement;
    expect(within(card).queryByText(/\bpass\.|\{\{/)).not.toBeInTheDocument();
  });
});
