// Spécialités des professeurs Academy Discovery : codes système stockés en
// base, libellés via les clés i18n `specialty.<code>`.
export const SPECIALTY_CODES = [
  'kizomba',
  'urban_kiz',
  'semba',
  'tarraxinha',
  'tarraxo',
  'bachata',
  'salsa',
  'zouk',
  'afro_house',
] as const;

export type SpecialtyCode = (typeof SPECIALTY_CODES)[number];

export const isSpecialtyCode = (value: string): value is SpecialtyCode =>
  (SPECIALTY_CODES as readonly string[]).includes(value);

/** Libellé affiché ; une ancienne valeur libre (hors codes) est affichée telle quelle. */
export const specialtyLabel = (value: string, t: (key: string) => string): string =>
  isSpecialtyCode(value) ? t(`specialty.${value}`) : value;
