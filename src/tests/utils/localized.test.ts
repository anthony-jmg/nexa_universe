import { describe, it, expect } from 'vitest';
import { localized, optionalText, translationStatus } from '../../lib/localized';
import { SPECIALTY_CODES, isSpecialtyCode, specialtyLabel } from '../../lib/specialties';
import { translate, translations } from '../../i18n/translations';

describe('localized : contenu dynamique FR / EN', () => {
  it('FR → toujours le français', () => {
    expect(localized('Bonjour', 'Hello', 'fr')).toBe('Bonjour');
  });

  it('EN présent → anglais ; EN absent, vide ou blanc → français', () => {
    expect(localized('Bonjour', 'Hello', 'en')).toBe('Hello');
    expect(localized('Bonjour', null, 'en')).toBe('Bonjour');
    expect(localized('Bonjour', undefined, 'en')).toBe('Bonjour');
    expect(localized('Bonjour', '', 'en')).toBe('Bonjour');
    expect(localized('Bonjour', '   ', 'en')).toBe('Bonjour');
  });

  it('PT / ES (masqués) → français', () => {
    expect(localized('Bonjour', 'Hello', 'pt')).toBe('Bonjour');
    expect(localized('Bonjour', 'Hello', 'es')).toBe('Bonjour');
  });

  it('jamais undefined ni null', () => {
    expect(localized(null, null, 'en')).toBe('');
    expect(localized(undefined, undefined, 'fr')).toBe('');
  });

  it('indicateur de complétude', () => {
    expect(translationStatus('Texte', 'Text')).toBe('complete');
    expect(translationStatus('Texte', '')).toBe('missing_en');
    expect(translationStatus('Texte', null)).toBe('missing_en');
    expect(translationStatus('', ' ')).toBe('empty');
    expect(translationStatus(null, null)).toBe('empty');
  });

  it('texte EN vide enregistré à NULL', () => {
    expect(optionalText('')).toBeNull();
    expect(optionalText('  ')).toBeNull();
    expect(optionalText('Text')).toBe('Text');
  });
});

describe('spécialités : codes système', () => {
  it('liste validée', () => {
    expect(SPECIALTY_CODES).toEqual([
      'kizomba', 'urban_kiz', 'semba', 'tarraxinha', 'tarraxo', 'bachata', 'salsa', 'zouk', 'afro_house',
    ]);
  });

  it('chaque code a un libellé FR et EN', () => {
    for (const code of SPECIALTY_CODES) {
      expect(translations.fr[`specialty.${code}`]).toBeTruthy();
      expect(translations.en[`specialty.${code}`]).toBeTruthy();
    }
  });

  it('libellé traduit ; ancienne valeur libre affichée telle quelle', () => {
    const t = (key: string) => translate('en', key);
    expect(specialtyLabel('urban_kiz', t)).toBe('Urban Kiz');
    expect(specialtyLabel('afro_house', t)).toBe('Afro House');
    expect(specialtyLabel('Kuduro', t)).toBe('Kuduro');
    expect(isSpecialtyCode('Kizomba')).toBe(false);
  });
});
