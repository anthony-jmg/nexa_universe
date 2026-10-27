import { getActiveLocale } from './locale';

// Montant en euros selon la langue active, centimes conservés
// (fr : 0,50 € · en : €0.50 — jamais arrondi à 1 €).
export const formatEuro = (value: number | string): string =>
  new Intl.NumberFormat(getActiveLocale(), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
