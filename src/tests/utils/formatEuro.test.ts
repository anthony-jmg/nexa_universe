import { describe, it, expect } from 'vitest';
import { formatEuro } from '../../lib/formatEuro';

// Intl insère des espaces insécables : on les normalise pour comparer.
const fmt = (v: number | string) => formatEuro(v).replace(/[\u202f\u00a0]/g, ' ');

describe('formatEuro', () => {
  it('conserve les centimes sans arrondir à l’euro', () => {
    expect(fmt(0.5)).toBe('0,50 €');
    expect(fmt('0.50')).toBe('0,50 €');
    expect(fmt(20.5)).toBe('20,50 €');
  });

  it('affiche les montants entiers avec deux décimales', () => {
    expect(fmt(1)).toBe('1,00 €');
    expect(fmt('1.00')).toBe('1,00 €');
    expect(fmt(65)).toBe('65,00 €');
  });
});
