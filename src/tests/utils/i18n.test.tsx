import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { translations, translate, PUBLIC_LANGUAGES } from '../../i18n/translations';
import { LanguageProvider, useLanguage } from '../../contexts/LanguageContext';
import { LanguageSelector } from '../../components/LanguageSelector';
import { formatEuro } from '../../lib/formatEuro';
import { formatDate, formatNumber, getActiveLanguage, setActiveLanguage } from '../../lib/locale';

// Toutes les clés t('…') du code doivent exister en français (langue de repli).
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'tests' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });

describe('dictionnaire', () => {
  it('chaque clé t("…") utilisée dans le code existe en français', () => {
    const missing: string[] = [];
    for (const file of sourceFiles(join(__dirname, '../..'))) {
      const code = readFileSync(file, 'utf8');
      for (const [, key] of code.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
        if (!translations.fr[key]) missing.push(`${key} (${file.split('/src/')[1]})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('PT et ES sont conservés mais seuls FR et EN sont publics', () => {
    expect(Object.keys(translations).sort()).toEqual(['en', 'es', 'fr', 'pt']);
    expect(PUBLIC_LANGUAGES).toEqual(['fr', 'en']);
  });
});

describe('translate : repli sur le français', () => {
  it('EN présent → anglais ; EN absent → français ; jamais la clé si le FR existe', () => {
    const enKey = Object.keys(translations.en).find((k) => translations.en[k] && translations.en[k] !== translations.fr[k])!;
    expect(translate('en', enKey)).toBe(translations.en[enKey]);
    const frOnly = Object.keys(translations.fr).find((k) => !translations.en[k])!;
    expect(frOnly).toBeTruthy();
    expect(translate('en', frOnly)).toBe(translations.fr[frOnly]);
    expect(translate('fr', 'cle.inexistante')).toBe('cle.inexistante');
  });

  it('remplace les paramètres', () => {
    const key = Object.keys(translations.fr).find((k) => translations.fr[k].includes('{{'));
    if (key) expect(translate('fr', key, { x: '1' })).not.toBe('');
  });
});

describe('formats selon la langue', () => {
  beforeEach(() => setActiveLanguage('fr'));

  it('montants, nombres et dates', () => {
    expect(formatEuro(0.5)).toBe('0,50 €');
    expect(formatNumber(1234.5)).toBe('1 234,5');
    expect(formatDate('2027-08-15T12:00:00Z', { day: 'numeric', month: 'long', year: 'numeric' })).toBe('15 août 2027');
    setActiveLanguage('en');
    expect(formatEuro(0.5)).toBe('€0.50');
    expect(formatNumber(1234.5)).toBe('1,234.5');
    expect(formatDate('2027-08-15T12:00:00Z', { day: 'numeric', month: 'long', year: 'numeric' })).toBe('15 August 2027');
  });
});

function Probe() {
  const { language, t } = useLanguage();
  return <p data-testid="probe">{language}|{t('nav.academy')}</p>;
}

const renderApp = () =>
  render(
    <LanguageProvider>
      <LanguageSelector />
      <Probe />
    </LanguageProvider>
  );

// Le setup global neutralise localStorage : stockage réel en mémoire pour ces tests.
const store = new Map<string, string>();
vi.mocked(localStorage.getItem).mockImplementation((k: string) => store.get(k) ?? null);
vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => void store.set(k, String(v)));
vi.mocked(localStorage.clear).mockImplementation(() => store.clear());

describe('LanguageProvider : persistance et html lang', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'fr';
    setActiveLanguage('fr');
  });

  it('français par défaut, sans détection du navigateur', () => {
    renderApp();
    expect(screen.getByTestId('probe').textContent).toMatch(/^fr\|/);
    expect(document.documentElement.lang).toBe('fr');
  });

  it('le choix EN est mémorisé et rétabli au rechargement (et au retour Stripe)', () => {
    const { unmount } = renderApp();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('English'));
    expect(screen.getByTestId('probe').textContent).toMatch(/^en\|/);
    expect(localStorage.getItem('language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(getActiveLanguage()).toBe('en');
    unmount();

    // Rechargement de page / retour de Stripe : nouvelle instance de l'application
    act(() => setActiveLanguage('fr'));
    renderApp();
    expect(screen.getByTestId('probe').textContent).toMatch(/^en\|/);
    expect(getActiveLanguage()).toBe('en');
  });

  it('le sélecteur ne propose que Français et English', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Français')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.queryByText('Español')).not.toBeInTheDocument();
    expect(screen.queryByText('Português')).not.toBeInTheDocument();
  });

  it('une ancienne préférence PT/ES revient au français tant qu’elles sont masquées', () => {
    localStorage.setItem('language', 'pt');
    renderApp();
    expect(screen.getByTestId('probe').textContent).toMatch(/^fr\|/);
  });
});
