import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';

// i18n LOT 4 : parcours Price Lock actif (explications, choix dans la Shop) et
// Mes Pass, en français puis en anglais, avec le vrai dictionnaire.

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (days: number) => new Date(now + days * DAY).toISOString();

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
  ticket_type: { id: 'tt-1', name: 'FULL PASS HOMME', description: null, description_en: null },
  price_tiers: [
    { label: 'Early', price: 80, starts_at: iso(-10), ends_at: iso(20) },
    { label: 'Regular', price: 95, starts_at: iso(20), ends_at: null },
  ],
};

const event = {
  id: 'evt-1',
  title: 'Lisbon Kizomba Festival',
  description: null,
  description_en: null,
  location: 'Lisboa',
  start_date: iso(60),
  end_date: iso(62),
  thumbnail_url: null,
  is_active: true,
  is_test: false,
  event_status: 'published',
  event_ticket_types: [ett],
};

const lock = (extra: Record<string, unknown> = {}) => ({
  id: 'lock-1',
  locked_price: 80,
  deposit_amount: 20,
  total_paid: 20,
  remaining_amount: 60,
  expires_at: iso(20),
  status: 'active',
  balance_payment_mode: 'manual',
  auto_balance_payment_at: null,
  auto_balance_payment_status: null,
  event_ticket_types: { id: 'ett-1', ticket_types: { name: 'FULL PASS HOMME' } },
  events: { id: 'evt-1', title: 'Lisbon Kizomba Festival', start_date: iso(60) },
  ...extra,
});

const attendee = (id: string, checkIn: string, weezevent: string) => ({
  id,
  event_id: 'evt-1',
  user_id: 'user-1',
  event_ticket_type_id: 'ett-1',
  qr_code: `qr-${id}`,
  check_in_status: checkIn,
  checked_in_at: null,
  purchased_at: iso(-2),
  created_at: iso(-2),
  pass_status: 'pending',
  pass_file_path: null,
  weezevent_sync_status: weezevent,
  attendee_first_name: 'Ana',
  attendee_last_name: id,
  attendee_email: null,
  attendee_phone: null,
  event_ticket_types: { id: 'ett-1', price: 80, ticket_types: { name: 'FULL PASS HOMME' } },
  events: { id: 'evt-1', title: 'Lisbon Kizomba Festival', location: 'Lisboa', start_date: iso(60), end_date: iso(62), thumbnail_url: null },
});

const db = {
  price_locks: [] as unknown[],
  event_attendees: [] as unknown[],
  quote: null as unknown,
};

const addEventTicketToCart = vi.fn().mockResolvedValue(undefined);

vi.mock('../../contexts/AuthContext', () => {
  const value = { user: { id: 'user-1' }, profile: { id: 'user-1', role: 'student', full_name: 'Ana Test', email: 'ana@example.com' } };
  return { useAuth: () => value };
});
vi.mock('../../contexts/CartContext', () => ({
  useCart: () => ({ addToCart: vi.fn(), addEventTicketToCart, getCartCount: () => 0, clearCart: vi.fn() }),
}));
vi.mock('../../lib/supabase', () => {
  const rows = (table: string) =>
    table === 'events' ? [event] : ((db as Record<string, unknown>)[table] as unknown[] | undefined) ?? [];
  // Requête Supabase factice : chaînable et « thenable » comme le vrai client.
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gte', 'or', 'order', 'range', 'neq', 'is', 'not', 'limit', 'update']) {
      b[m] = () => b;
    }
    b.maybeSingle = () => Promise.resolve({ data: rows(table)[0] ?? null, error: null });
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows(table), error: null, count: 0 }).then(resolve, reject);
    return b;
  };
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: (fn: string) =>
        Promise.resolve({ data: fn === 'get_price_lock_repurchase_quote' ? db.quote : [], error: null }),
      auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'token' } } }) },
    },
  };
});

import { LanguageProvider } from '../../contexts/LanguageContext';
import { LanguageSelector } from '../../components/LanguageSelector';
import { PriceLockExplainer } from '../../components/PriceLockExplainer';
import { Shop } from '../../pages/Shop';
import { MyPurchases } from '../../pages/MyPurchases';
import { setActiveLanguage, formatLongDate } from '../../lib/locale';
import { priceLockDeadline } from '../../lib/tierPricing';
import { priceLockErrorMessage } from '../../lib/purchaseErrors';
import { translate } from '../../i18n/translations';
import { frenchStrings } from '../utils/hardcodedFrench';

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

const text = () => (document.body.textContent ?? '').replace(/[\u202f\u00a0]/g, ' ');

// Une clé du dictionnaire ne doit jamais apparaître telle quelle à l'écran.
const RAW_KEY = /\b(home|footer|nav|pass|event|events|checkout|payment|myPasses|priceLock|purchaseError|common)\.[a-z][a-zA-Z]*/;

const switchToEnglish = () => {
  fireEvent.click(screen.getByRole('button', { name: '🇫🇷' }));
  fireEvent.click(screen.getByText('English'));
};

// Date limite du Price Lock telle que calculée par l'application, dans la langue active.
const deadlineLabel = (language: 'fr' | 'en') => {
  setActiveLanguage(language);
  return formatLongDate(priceLockDeadline(ett as never)!);
};

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  cleanup();
  addEventTicketToCart.mockClear();
  fetchSpy.mockReset();
  db.price_locks = [];
  db.event_attendees = [];
  db.quote = null;
  window.history.replaceState({}, '', '/');
});

describe('1 — PriceLockExplainer', () => {
  it('FR puis EN sans rechargement', () => {
    renderIn('fr', <PriceLockExplainer />);
    expect(screen.getByText('Choisis ton festival')).toBeInTheDocument();
    expect(screen.getByText('ÉTAPE 1')).toBeInTheDocument();
    expect(text()).toContain('Full Pass à 75 € → 20 € aujourd’hui → 55 € à régler plus tard.');
    expect(text()).toContain('Il peut être déduit une seule fois du prix public en vigueur');

    switchToEnglish();
    expect(screen.getByText('Choose your festival')).toBeInTheDocument();
    expect(screen.getByText('STEP 3')).toBeInTheDocument();
    expect(screen.getByText('Pay the balance later')).toBeInTheDocument();
    expect(text()).toContain('Full Pass at €75 → €20 today → €55 to pay later.');
    expect(text()).toContain('It can be deducted once from the public price in force');
    expect(screen.queryByText('Choisis ton festival')).not.toBeInTheDocument();
  });
});

describe('2 à 9 — choix Price Lock dans la Shop', () => {
  const openPriceLock = async (language: 'fr' | 'en') => {
    renderIn(language, <Shop onNavigate={vi.fn()} />);
    const en = language === 'en';
    fireEvent.click(await screen.findByRole('button', { name: en ? 'Buy or reserve' : 'Acheter ou réserver' }));
    // Le clic initial n'ajoute jamais le billet au panier
    expect(addEventTicketToCart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en ? /^Price Lock\s*Pay part of the price today/ : /^Price Lock\s*Verse une partie aujourd/ }));
    return screen.getByLabelText(en ? 'Payment amount for FULL PASS HOMME' : 'Montant du dépôt pour FULL PASS HOMME');
  };

  it('2/3 — choix FR → EN, versement minimum', async () => {
    const input = await openPriceLock('fr');
    expect(text()).toContain('Aujourd’hui : 20 €');
    expect(input.getAttribute('placeholder')?.replace(/[\u202f\u00a0]/g, ' ')).toBe('Autre montant · min. 20 €');

    switchToEnglish();
    expect(screen.getByText('How would you like to book your pass?')).toBeInTheDocument();
    expect(text()).toContain('Locked price');
    // La note explicative suit aussi la langue
    expect(text()).toContain('How does Price Lock work?');
    expect(text()).not.toContain('Comment fonctionne Price Lock');
    expect(text().match(RAW_KEY)?.[0]).toBeUndefined();
    expect(text()).toContain('Today: €20');
    expect(screen.getByLabelText('Payment amount for FULL PASS HOMME')).toHaveAttribute('placeholder', 'Other amount · min. €20');

    fireEvent.change(screen.getByLabelText('Payment amount for FULL PASS HOMME'), { target: { value: '10' } });
    expect(screen.getByText('The minimum payment for this Price Lock is €20.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Payment amount for FULL PASS HOMME'), { target: { value: '80' } });
    expect(screen.getByText('To pay for the whole pass, choose Buy now.')).toBeInTheDocument();
  });

  it('4/5/6 — montant personnalisé, reste à payer, date limite', async () => {
    const input = await openPriceLock('en');
    fireEvent.change(input, { target: { value: '30' } });
    expect(text()).toContain('Today: €30');
    expect(text()).toContain(`Remaining balance due by ${deadlineLabel('en')}: €50`);
    expect(text()).toContain(`Your price of €80 is guaranteed until ${deadlineLabel('en')}`);
  });

  it('reste à payer et date limite en français', async () => {
    await openPriceLock('fr');
    expect(text()).toContain('Prix bloqué');
    expect(text().match(RAW_KEY)?.[0]).toBeUndefined();
    expect(text()).toContain(`Reste à payer avant le ${deadlineLabel('fr')} : 60 €`);
    expect(text()).toContain(`Ton prix de 80 € est garanti jusqu’au ${deadlineLabel('fr')}`);
  });

  it('7/8/9 — paiement manuel, automatique et consentement', async () => {
    await openPriceLock('en');
    fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
    expect(screen.getByText('How do you want to pay the rest?')).toBeInTheDocument();

    // Mode manuel
    expect(text()).toContain(`You can pay the remaining amount from Nexa before ${deadlineLabel('en')}.`);
    const add = () => screen.getByRole('button', { name: /^Add the Price Lock to cart — €20$/ });
    expect(add()).toBeDisabled();
    fireEvent.click(screen.getByText('I will pay myself'));
    expect(add()).toBeEnabled();

    // Mode automatique : consentement obligatoire
    expect(text()).toContain(`The remaining €60 will be charged automatically on ${deadlineLabel('en')} if you have not paid it before.`);
    fireEvent.click(screen.getByText('Automatic payment'));
    expect(add()).toBeDisabled();
    const consent = screen.getByRole('checkbox');
    expect(screen.getByText(/^I authorise Nexa to automatically charge the remaining amount/)).toBeInTheDocument();
    fireEvent.click(consent);
    expect(add()).toBeEnabled();
    expect(text()).toContain('To pay today (payments)€20');
    expect(text().match(RAW_KEY)?.[0]).toBeUndefined();
    expect(addEventTicketToCart).not.toHaveBeenCalled();
  });
});

describe('10 à 15 — Mes Pass', () => {
  const renderPasses = async (language: 'fr' | 'en') => {
    renderIn(language, <MyPurchases onNavigate={vi.fn()} />);
    await screen.findByText(language === 'en' ? 'Active Price Locks' : 'Price Locks actifs');
  };

  it('10/11/12 — Price Lock actif, solde et bouton de paiement (FR)', async () => {
    db.price_locks = [lock()];
    await renderPasses('fr');
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(text()).toContain(`Prix garanti jusqu'au ${(setActiveLanguage('fr'), formatLongDate(iso(20)))}`);
    expect(text()).toContain('Solde : 60 €');
    expect(screen.getByRole('button', { name: /^Payer le solde — 60\s€$/ })).toBeInTheDocument();
  });

  it('10/11/12 — Price Lock actif, solde et bouton de paiement (EN)', async () => {
    db.price_locks = [lock()];
    await renderPasses('en');
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(text()).toContain(`Price guaranteed until ${(setActiveLanguage('en'), formatLongDate(iso(20)))}`);
    expect(text()).toContain('Locked price: €80');
    expect(text()).toContain('Already paid: €20');
    expect(text()).toContain('Balance: €60');
    expect(screen.getByRole('button', { name: 'Pay the balance — €60' })).toBeInTheDocument();
    expect(text().match(RAW_KEY)?.[0]).toBeUndefined();
  });

  it('13 — prélèvement programmé, prélèvement échoué', async () => {
    db.price_locks = [
      lock({ id: 'lock-auto', balance_payment_mode: 'automatic', auto_balance_payment_at: iso(19) }),
      lock({ id: 'lock-failed', balance_payment_mode: 'automatic', auto_balance_payment_at: iso(19), auto_balance_payment_status: 'failed' }),
    ];
    await renderPasses('en');
    setActiveLanguage('en');
    expect(text()).toContain(`Automatic balance payment scheduled for ${formatLongDate(iso(19))}`);
    expect(screen.getByText('The automatic payment did not go through. You can pay your balance manually.')).toBeInTheDocument();
  });

  it('13 — Price Lock expiré : rachat, montant inutilisable, événement annulé', async () => {
    db.price_locks = [lock({ status: 'expired', expires_at: iso(-1) })];
    db.quote = { status: 'available', current_price: 95, credit: 20, amount_due: 75, event_title: 'Lisbon Kizomba Festival' };
    await renderPasses('en');
    expect(screen.getByText('Expired Price Lock')).toBeInTheDocument();
    expect(screen.getByText('Your previous price is no longer guaranteed.')).toBeInTheDocument();
    expect(text()).toContain('The €20 already paid remains deductible from the current price.');
    expect(text()).toContain('Left to pay: €75');
    expect(screen.getByRole('button', { name: 'Buy at the current price — €75' })).toBeInTheDocument();

    cleanup();
    db.quote = { status: 'credit_lapsed', lapsed_reason: 'event_started', credit: 20 };
    await renderPasses('en');
    expect(text()).toContain('The €20 you paid can no longer be used because the event has started.');
    expect(screen.queryByRole('button', { name: /Buy at the current price/ })).not.toBeInTheDocument();

    cleanup();
    db.quote = { status: 'sold_out', current_price: 95, credit: 20 };
    await renderPasses('en');
    expect(screen.getByText('This pass is sold out for now.')).toBeInTheDocument();

    cleanup();
    db.quote = { status: 'event_cancelled', credit: 20 };
    await renderPasses('en');
    expect(screen.getByText('This event has been cancelled. Amounts collected by Nexa for this pass will be refunded to you.')).toBeInTheDocument();
    // Aucune promesse d'automatisation ni de délai, aucun bouton d'achat
    expect(text()).not.toMatch(/automatic(ally)? refund|refunded automatically|within \d+|\d+\s*(days|business days|weeks)/i);
    expect(screen.queryByRole('button', { name: /Buy at the current price/ })).not.toBeInTheDocument();
  });

  it('13 — statuts des billets (paiement du solde, émission, annulé, utilisé)', async () => {
    db.event_attendees = [
      attendee('a', 'awaiting_balance', 'pending'),
      attendee('b', 'not_checked_in', 'synced'),
      attendee('c', 'not_checked_in', 'skipped'),
      attendee('d', 'not_checked_in', 'pending'),
      attendee('e', 'not_checked_in', 'failed'),
      attendee('f', 'cancelled', 'pending'),
      attendee('g', 'checked_in', 'synced'),
    ];
    await renderPasses('en');
    expect(screen.getByText('My tickets')).toBeInTheDocument();
    expect(screen.getByText('No active Price Lock')).toBeInTheDocument();
    for (const label of [
      'Balance payment pending',
      'Official ticket sent',
      'Purchase confirmed',
      'Official ticket awaiting issue',
      'Problem issuing the ticket',
      'Cancelled',
      'Used',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByText('Ana a'));
    expect(screen.getByText('Your official ticket will be issued once the balance has been paid.')).toBeInTheDocument();
    expect(screen.getByText('Ticket type')).toBeInTheDocument();
  });

  it('14 — erreurs du paiement du solde traduites, jamais techniques', async () => {
    db.price_locks = [lock()];
    const reply = (error: string) =>
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ error }), { status: 400 }));
    await renderPasses('en');

    reply('Le prélèvement automatique de ce solde est en cours. Réessaie dans quelques minutes.');
    fireEvent.click(screen.getByRole('button', { name: 'Pay the balance — €60' }));
    expect(await screen.findByText('The automatic payment of this balance is in progress. Please try again in a few minutes.')).toBeInTheDocument();

    reply('StripeInvalidRequestError: No such customer: cus_123');
    fireEvent.click(screen.getByRole('button', { name: 'Pay the balance — €60' }));
    expect(await screen.findByText('The payment could not be started.')).toBeInTheDocument();
    expect(screen.queryByText(/cus_123/)).not.toBeInTheDocument();
  });

  it('14 — table des erreurs Price Lock', () => {
    const en = (key: string, params?: Record<string, string | number>) => translate('en', key, params);
    expect(priceLockErrorMessage(new Error('Ce Price Lock a expiré : ton ancien tarif n’est plus garanti.'), en))
      .toBe('This Price Lock has expired: your previous price is no longer guaranteed.');
    expect(priceLockErrorMessage(new Error('Aucun solde restant sur ce Price Lock.'), en)).toBe('There is no balance left on this Price Lock.');
    expect(priceLockErrorMessage(new Error('Le versement de ce Price Lock a déjà été utilisé.'), en)).toBe('The payment for this Price Lock has already been used.');
    expect(priceLockErrorMessage(new Error('Vous devez être connecté.'), en)).toBe('Sign in to complete your order.');
    expect(priceLockErrorMessage(new Error('relation "price_locks" does not exist'), en)).toBe('The payment could not be started.');
  });

  it('15 — persistance de l’anglais après rechargement', async () => {
    db.price_locks = [lock()];
    const first = renderIn('fr', <MyPurchases onNavigate={vi.fn()} />);
    await screen.findByText('Price Locks actifs');
    switchToEnglish();
    expect(screen.getByText('Active Price Locks')).toBeInTheDocument();
    first.unmount();

    setActiveLanguage('fr');
    render(
      <LanguageProvider>
        <MyPurchases onNavigate={vi.fn()} />
      </LanguageProvider>
    );
    expect(await screen.findByText('Active Price Locks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay the balance — €60' })).toBeInTheDocument();
  });
});

describe('16/17 — écrans actifs du LOT 4', () => {
  const FILES = ['components/PriceLockExplainer.tsx', 'pages/MyPurchases.tsx'];
  const read = (file: string) => readFileSync(join(__dirname, '../..', file), 'utf8');

  it('16 — aucun texte français codé en dur', () => {
    const offenders = FILES.flatMap((file) => frenchStrings(read(file)).map((s) => `${file}: ${s}`));
    expect(offenders).toEqual([]);
  });

  it('17 — aucun « € » ajouté à la main ni format fr-FR', () => {
    for (const file of FILES) {
      const code = read(file);
      expect(code, file).not.toMatch(/'fr-FR'|getActiveLocale\(\)|toLocaleDateString|\.toFixed\(/);
      expect(code, file).not.toMatch(/\}\s*€|€\s*\{|[0-9]\s*€/);
    }
  });

  it('nouvelles clés présentes en FR et en EN', async () => {
    const { translations } = await import('../../i18n/translations');
    const keys = Object.keys(translations.fr).filter((k) => /^(myPasses\.|priceLock\.|purchaseError\.)/.test(k));
    expect(keys.length).toBeGreaterThan(70);
    expect(keys.filter((k) => !translations.en[k])).toEqual([]);
  });
});
