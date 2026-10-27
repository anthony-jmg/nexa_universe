import type { Language } from '../i18n/translations';

// Langue active pour les formats (dates, nombres, montants). Mise à jour par
// LanguageProvider avant chaque rendu ; français par défaut.
const LOCALES: Record<Language, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  pt: 'pt-PT',
  es: 'es-ES',
};

let activeLanguage: Language = 'fr';

export const setActiveLanguage = (language: Language): void => {
  activeLanguage = language;
};

export const getActiveLanguage = (): Language => activeLanguage;

export const getActiveLocale = (): string => LOCALES[activeLanguage];

const toDate = (value: Date | string | number): Date => (value instanceof Date ? value : new Date(value));

export const formatDate = (value: Date | string | number, options?: Intl.DateTimeFormatOptions): string =>
  toDate(value).toLocaleDateString(getActiveLocale(), options);

export const formatTime = (value: Date | string | number, options?: Intl.DateTimeFormatOptions): string =>
  toDate(value).toLocaleTimeString(getActiveLocale(), options);

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(getActiveLocale(), options).format(value);

/** Date longue : « 15 août 2027 » / « 15 August 2027 ». */
export const formatLongDate = (value: Date | string | number): string =>
  formatDate(value, { day: 'numeric', month: 'long', year: 'numeric' });
