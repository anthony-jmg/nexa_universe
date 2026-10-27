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

// Prix affiché : montant entier sans décimales (80 € · €80), sinon centimes
// conservés (0,50 € · €0.50). Même règle dans tous les écrans.
export const formatPrice = (value: number | string): string => {
  const amount = Number(value);
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(getActiveLocale(), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
};
