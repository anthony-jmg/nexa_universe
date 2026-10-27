/*
  # Contenus bilingues FR / EN (i18n LOT 2)

  Les colonnes existantes restent la version française (langue par défaut).
  Les nouvelles colonnes *_en sont facultatives : vides → repli sur le français
  côté front (helper `localized`). Aucune donnée existante n'est modifiée.
*/

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.ticket_types ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.professors ADD COLUMN IF NOT EXISTS bio_en text;

-- professors est lu via des GRANT par colonne : bio_en suit bio.
GRANT SELECT (bio_en) ON public.professors TO anon, authenticated;
