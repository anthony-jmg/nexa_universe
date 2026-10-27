import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ComponentType, ReactElement } from 'react';

// LOT 7 : pages juridiques FR / EN alignées sur le fonctionnement réel
// (Nexa Pass, Price Lock, Academy Discovery ; aucun abonnement ni favori).

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'in', 'eq', 'gte', 'order', 'limit']) b[m] = () => b;
      b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
      return b;
    },
  },
}));

import TermsAndConditions from '../../pages/TermsAndConditions';
import RefundPolicy from '../../pages/RefundPolicy';
import LegalNotice from '../../pages/LegalNotice';
import PrivacyPolicy from '../../pages/PrivacyPolicy';
import { Landing } from '../../pages/Landing';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { LanguageSelector } from '../../components/LanguageSelector';
import { setActiveLanguage } from '../../lib/locale';
import { translations } from '../../i18n/translations';
import { frenchStrings } from '../utils/hardcodedFrench';

type Page = ComponentType<{ onNavigate: (page: string) => void }>;

const PAGES: [string, Page, string, string][] = [
  ['CGV', TermsAndConditions, 'Conditions générales de vente et d’utilisation', 'Terms and conditions of sale and use'],
  ['Remboursement', RefundPolicy, 'Politique de remboursement', 'Refund policy'],
  ['Mentions légales', LegalNotice, 'Mentions légales', 'Legal notice'],
  ['Confidentialité', PrivacyPolicy, 'Politique de confidentialité', 'Privacy policy'],
];

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

const text = () => document.body.textContent ?? '';
const RAW_KEY = /\b(legal|home|footer|common)\.[a-z][a-zA-Z]*/;

// Promesses que le système ne tient pas (FR et EN).
const FORBIDDEN = [
  /n’est pas perdu|ne sont pas perdues|ne signifie (donc )?pas perdu/i,
  /is not lost|are not lost/i,
  /indéfiniment|sans limite de durée|indefinitely|with no time limit/i,
  /avoir permanent|permanent credit/i,
  /place (reste|restera) réservée|place remains reserved/i,
  /remboursement automatique du (premier )?versement|automatically refunded/i,
  /merch|marchandis|Google Analytics|Meta Pixel|accès à vie/i,
  /favori|favourite|favorite/i,
  /abonnez-vous|abonnement (Academy|professeur)|subscribe|subscription plan/i,
];

beforeEach(() => cleanup());

describe('1-5 — pages juridiques FR et EN', () => {
  it.each(PAGES)('%s : FR puis EN, sans promesse non tenue ni clé brute', (_label, Page, fr, en) => {
    const onNavigate = vi.fn();
    renderIn('fr', <Page onNavigate={onNavigate} />);
    expect(screen.getByRole('heading', { level: 1, name: fr })).toBeInTheDocument();
    expect(text()).toMatch(/Dernière mise à jour : 27 octobre 2026/);
    for (const pattern of FORBIDDEN) expect(text()).not.toMatch(pattern);
    expect(text().match(RAW_KEY)?.[0]).toBeUndefined();

    fireEvent.click(screen.getByText('Retour à l’accueil'));
    expect(onNavigate).toHaveBeenCalledWith('landing');
    for (const [label, page] of [['Conditions générales de vente', 'terms'], ['Politique de confidentialité', 'privacy']] as const) {
      const buttons = screen.getAllByRole('button', { name: label });
      fireEvent.click(buttons[buttons.length - 1]);
      expect(onNavigate).toHaveBeenCalledWith(page);
    }

    // 15 — bascule sans rechargement
    fireEvent.click(screen.getByRole('button', { name: '🇫🇷' }));
    fireEvent.click(screen.getByText('English'));
    expect(screen.getByRole('heading', { level: 1, name: en })).toBeInTheDocument();
    expect(text()).toMatch(/Last updated: 27 October 2026/);
    expect(screen.getByText('Back to home')).toBeInTheDocument();
    for (const pattern of FORBIDDEN) expect(text()).not.toMatch(pattern);
    expect(text().match(RAW_KEY)?.[0]).toBeUndefined();
  });

  it('16 — persistance de l’anglais après rechargement', () => {
    const first = renderIn('fr', <TermsAndConditions onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '🇫🇷' }));
    fireEvent.click(screen.getByText('English'));
    first.unmount();
    setActiveLanguage('fr');
    render(
      <LanguageProvider>
        <TermsAndConditions onNavigate={vi.fn()} />
      </LanguageProvider>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Terms and conditions of sale and use' })).toBeInTheDocument();
  });

  it('3 — mentions légales : informations manquantes signalées, jamais inventées (FR / EN)', () => {
    renderIn('fr', <LegalNotice onNavigate={vi.fn()} />);
    expect(screen.getByText('[À COMPLÉTER : numéro d’immatriculation]')).toBeInTheDocument();
    expect(screen.getByText('[À COMPLÉTER : nom et coordonnées du médiateur de la consommation]')).toBeInTheDocument();
    expect(text()).not.toMatch(/SIREN\s*:?\s*\d|SIRET\s*:?\s*\d|capital social de \d/i);
    cleanup();
    renderIn('en', <LegalNotice onNavigate={vi.fn()} />);
    expect(screen.getByText('[TO BE COMPLETED: registration number]')).toBeInTheDocument();
  });

  it('5 — cookies : uniquement le stockage local nécessaire, aucun traceur publicitaire (FR / EN)', () => {
    renderIn('fr', <PrivacyPolicy onNavigate={vi.fn()} />);
    expect(screen.getByText('7. Cookies et stockage local')).toBeInTheDocument();
    expect(text()).toContain('Nexa ne dépose aucun cookie publicitaire ni de mesure d’audience');
    expect(text()).toContain('mémoriser la langue choisie');
    cleanup();
    renderIn('en', <PrivacyPolicy onNavigate={vi.fn()} />);
    expect(screen.getByText('7. Cookies and local storage')).toBeInTheDocument();
    expect(text()).toContain('Nexa does not set any advertising or audience measurement cookie');
  });
});

describe('6-12 — CGV : règles Price Lock du fonctionnement réel', () => {
  it('FR', () => {
    renderIn('fr', <TermsAndConditions onNavigate={vi.fn()} />);
    const t = text();
    // 6 — expiration
    expect(t).toContain(translations.fr['priceLock.expiryRule']);
    expect(t).toContain('la place n’est plus réservée');
    // montant initial et limites
    expect(t).toContain('Il ne peut pas être inférieur à 20 €, sauf pour les événements de test internes de Nexa');
    expect(t).toContain('qu’un seul Price Lock actif par événement, et au maximum deux Price Locks actifs au total');
    expect(t).toContain('Une fois le solde payé, le Price Lock devient un achat confirmé du pass');
    // 7/8 — ni remboursement automatique ni conservation illimitée
    expect(t).toContain('Le premier versement n’est pas remboursable');
    expect(t).toContain('devient définitivement inutilisable et n’est pas remboursé');
    expect(t).toContain('n’est ni un avoir, ni un portefeuille');
    // 10 — paiement automatique avec consentement explicite, sans garantie
    expect(t).toContain('consentement explicite en cochant la case prévue à cet effet');
    expect(t).toContain('Le prélèvement n’est pas garanti. S’il échoue, le solde n’est pas considéré comme payé');
    // 11 — billet officiel
    expect(t).toContain('Il peut être émis et envoyé via Weezevent');
    expect(t).toContain('Aucun délai d’émission n’est garanti');
    expect(t).toContain('tout autre document ou code fourni par Nexa ne valent pas billet');
    // annulation : rien d'inventé
    expect(t).toContain('[À COMPLÉTER : modalités de traitement des versements Price Lock en cas d’annulation]');
    // 12 — aucun abonnement proposé
    expect(t).toContain('Nexa ne vend aucun abonnement, aucune formation ni aucune vidéo payante sur le Site.');
    expect(t.match(/abonnement/gi)).toHaveLength(1);
  });

  it('EN', () => {
    renderIn('en', <TermsAndConditions onNavigate={vi.fn()} />);
    const t = text();
    expect(t).toContain(translations.en['priceLock.expiryRule']);
    expect(t).toContain('It cannot be lower than €20, except for Nexa’s internal test events.');
    expect(t).toContain('only one active Price Lock per event, and no more than two active Price Locks in total');
    expect(t).toContain('gives explicit consent by ticking the box provided');
    expect(t).toContain('The automatic payment is not guaranteed. If it fails, the balance is not considered paid');
    expect(t).toContain('It may be issued and sent through Weezevent');
    expect(t).toContain('No issuing time is guaranteed');
    expect(t).toContain('is not a credit note, a wallet balance or a transferable amount');
    expect(t).toContain('Price Lock');
    expect(t).toContain('NEXA UNIVERSE');
    expect(t).toContain('article L221-28, 12° of the French Consumer Code');
  });

  it('remboursement : seuls cas techniques réels, versement non remboursé', () => {
    renderIn('fr', <RefundPolicy onNavigate={vi.fn()} />);
    expect(text()).toContain('Le premier versement n’est pas remboursable');
    expect(text()).toContain('le paiement devenu inutile peut être remboursé');
    expect(text()).toContain(translations.fr['priceLock.expiryRule']);
    cleanup();
    renderIn('en', <RefundPolicy onNavigate={vi.fn()} />);
    expect(text()).toContain('The first payment is non-refundable');
  });
});

describe('13/14 — écrans actifs cohérents avec les CGV', () => {
  it('14 — Footer : navigation vers chaque page juridique (FR / EN)', () => {
    const onNavigate = vi.fn();
    renderIn('fr', <Landing onNavigate={onNavigate} />);
    for (const [label, page] of [['Mentions légales', 'legal-notice'], ['CGV', 'terms'], ['Remboursement', 'refund-policy'], ['Confidentialité', 'privacy']]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(onNavigate).toHaveBeenLastCalledWith(page);
    }
    cleanup();
    renderIn('en', <Landing onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Terms of sale' }));
    expect(onNavigate).toHaveBeenLastCalledWith('terms');
    fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    expect(onNavigate).toHaveBeenLastCalledWith('privacy');
  });

  it('même règle d’expiration partout (FAQ, explications, page festival, CGV, remboursement)', () => {
    for (const lang of ['fr', 'en'] as const) {
      const d = translations[lang];
      const rule = d['priceLock.expiryRule'];
      expect(d['event.lockTerms']).toContain(rule);
      expect(rule).toContain(d['home.faq.a4'].split(' ').slice(-12).join(' '));
      // La même phrase figure telle quelle dans les CGV (encadré 7.5) et la politique de remboursement
      const keysWithRule = Object.keys(d).filter((key) => key.startsWith('legal.') && d[key] === rule);
      expect(keysWithRule.some((key) => key.startsWith('legal.terms.s7.'))).toBe(true);
      expect(keysWithRule.some((key) => key.startsWith('legal.refund.s1.'))).toBe(true);
    }
  });

  it('13 — aucune promesse non tenue ni mention des favoris dans les textes actifs du dictionnaire', () => {
    const ACTIVE = /^(home|footer|nav\.(?!favorites)|pass|event|events|checkout|payment|myPasses|priceLock|purchaseError|academy\.(?!card|modal)|account\.(avatar|request|professor|billing|profile|header|tabs\.(profile|billing))|notifications|legal)\./;
    for (const lang of ['fr', 'en'] as const) {
      const offenders = Object.entries(translations[lang])
        .filter(([key]) => ACTIVE.test(key))
        .filter(([, value]) => FORBIDDEN.some((pattern) => pattern.test(value)))
        .map(([key]) => `${lang}:${key}`);
      expect(offenders).toEqual([]);
    }
  });

  it('FAQ : solde en une seule fois, limite réelle de Price Locks, aucune date fictive', () => {
    const fr = translations.fr;
    expect(fr['home.faq.a5']).toContain('le solde en une seule fois');
    expect(fr['home.faq.a6']).toContain('au maximum deux Price Locks actifs');
    expect(fr['home.steps.2.note']).not.toMatch(/XX/);
    expect(fr['event.lockModeHint']).not.toMatch(/caution/);
  });
});

describe('17/18 — code des pages juridiques', () => {
  const read = (file: string) => readFileSync(join(__dirname, '../..', file), 'utf8');
  const FILES = [
    'components/LegalPage.tsx',
    'pages/TermsAndConditions.tsx',
    'pages/RefundPolicy.tsx',
    'pages/LegalNotice.tsx',
    'pages/PrivacyPolicy.tsx',
  ];

  it('aucun texte juridique français codé en dur (hors commentaires « À VALIDER »)', () => {
    const offenders = FILES.flatMap((file) => frenchStrings(read(file)).map((s) => `${file}: ${s}`));
    expect(offenders).toEqual([]);
  });

  it('chaque clé legal.* existe en FR et en EN, et les annotations juriste sont conservées', () => {
    const keys = Object.keys(translations.fr).filter((k) => k.startsWith('legal.'));
    expect(keys.length).toBeGreaterThan(200);
    expect(keys.filter((k) => !translations.en[k])).toEqual([]);
    expect(read('pages/TermsAndConditions.tsx')).toContain('À VALIDER (juriste)');
    expect(read('pages/PrivacyPolicy.tsx')).toContain('À VALIDER (juriste)');
  });
});
