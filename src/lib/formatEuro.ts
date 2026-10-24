const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Montant en euros au format français, centimes conservés (0,50 € — jamais arrondi à 1 €).
export const formatEuro = (value: number | string): string => euroFormatter.format(Number(value));
