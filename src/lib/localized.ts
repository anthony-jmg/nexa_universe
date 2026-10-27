import type { Language } from '../i18n/translations';

const filled = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim() !== '';

/**
 * Contenu dynamique bilingue : la colonne historique est le français, la
 * colonne *_en est facultative. EN demandé et renseigné → anglais ; sinon
 * français. Ne renvoie jamais undefined ni null (chaîne vide si rien).
 */
export function localized(
  fr: string | null | undefined,
  en: string | null | undefined,
  language: Language
): string {
  if (language === 'en' && filled(en)) return en;
  return filled(fr) ? fr : '';
}

export type TranslationStatus = 'complete' | 'missing_en' | 'empty';

/** Complétude d'un champ traduisible (indicateur Admin, jamais bloquant). */
export function translationStatus(fr: string | null | undefined, en: string | null | undefined): TranslationStatus {
  if (!filled(fr) && !filled(en)) return 'empty';
  return filled(fr) && filled(en) ? 'complete' : 'missing_en';
}

/** Valeur à enregistrer en base : texte vide → NULL (repli FR). */
export const optionalText = (value: string): string | null => (value.trim() === '' ? null : value);
