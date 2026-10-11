/*
# Paliers tarifaires événement (source de vérité unique des prix)

1. Nouvelle table `event_ticket_price_tiers`
   - `id` (uuid, primary key)
   - `event_ticket_type_id` (uuid, lien vers event_ticket_types)
   - `label` (text, ex. "Early Bird", "Standard", "Last Call")
   - `price` (numeric, prix du palier, > 0)
   - `starts_at` (timestamptz, début du palier)
   - `ends_at` (timestamptz nullable, fin optionnelle)
   - `display_order` (integer), `created_at` / `updated_at`
   Contraintes : prix strictement positif ; unicité (event_ticket_type_id, starts_at).
   Index (event_ticket_type_id, starts_at).

2. Fonction centrale `get_event_ticket_pricing(p_event_ticket_type_id)`
   - palier actif (dernier starts_at <= now, non terminé), prix courant
   - prochain palier / prochain prix / prochaine date de hausse (null si aucun)
   - flags et montants Price Lock, base d'expiration
     LEAST(prochain palier + garantie, fin de vente)
   STABLE, SECURITY DEFINER, EXECUTE à anon + authenticated.

3. Vue `event_ticket_pricing_view` : mêmes champs pour les listes de cartes.

4. Rétrocompatibilité SANS suppression de données :
   - colonnes legacy price / next_price / price_increase_date dérivées du
     palier actif par trigger (avant insert/update) ;
   - price_locks.price_tier_id ajouté pour rattacher chaque lock à son palier.

5. Sécurité : RLS sur les paliers (lecture publique, écriture admin
   role = 'admin'), aucune colonne supprimée, aucune donnée modifiée.

6. Backfill : migration séparée.
*/

-- 1. Table des paliers
CREATE TABLE IF NOT EXISTS event_ticket_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_ticket_type_id uuid NOT NULL REFERENCES event_ticket_types(id) ON DELETE CASCADE,
  label text NOT NULL,
  price numeric NOT NULL CHECK (price > 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_ticket_type_id, starts_at)
);

CREATE INDEX IF NOT EXISTS idx_price_tiers_type_starts
  ON event_ticket_price_tiers(event_ticket_type_id, starts_at);

ALTER TABLE event_ticket_price_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view price tiers" ON event_ticket_price_tiers;
CREATE POLICY "Public can view price tiers"
  ON event_ticket_price_tiers FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert price tiers" ON event_ticket_price_tiers;
CREATE POLICY "Admins can insert price tiers"
  ON event_ticket_price_tiers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update price tiers" ON event_ticket_price_tiers;
CREATE POLICY "Admins can update price tiers"
  ON event_ticket_price_tiers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete price tiers" ON event_ticket_price_tiers;
CREATE POLICY "Admins can delete price tiers"
  ON event_ticket_price_tiers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 2. Fonction centrale de prix
CREATE OR REPLACE FUNCTION get_event_ticket_pricing(p_event_ticket_type_id uuid)
RETURNS TABLE (
  current_tier_id uuid,
  current_tier_label text,
  current_price numeric,
  next_tier_id uuid,
  next_price numeric,
  next_price_change_at timestamptz,
  price_lock_enabled boolean,
  price_lock_deposit_amount numeric,
  price_lock_opens_at timestamptz,
  price_lock_guarantee_days integer,
  sale_end_date timestamptz,
  price_lock_expiration_basis timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH tiers AS (
    SELECT t.id, t.label, t.price, t.starts_at, t.ends_at
      FROM event_ticket_price_tiers t
     WHERE t.event_ticket_type_id = p_event_ticket_type_id
  ),
  active AS (
    SELECT id, label, price, starts_at
      FROM tiers
     WHERE starts_at <= now()
       AND (ends_at IS NULL OR ends_at > now())
     ORDER BY starts_at DESC
     LIMIT 1
  ),
  upcoming AS (
    SELECT id, price, starts_at
      FROM tiers
     WHERE starts_at > now()
     ORDER BY starts_at ASC
     LIMIT 1
  ),
  cfg AS (
    SELECT ett.price_lock_enabled,
           ett.price_lock_deposit_amount,
           ett.price_lock_guarantee_days,
           ett.sale_end_date
      FROM event_ticket_types ett
     WHERE ett.id = p_event_ticket_type_id
  )
  SELECT
    a.id,
    a.label,
    a.price,
    u.id,
    u.price,
    u.starts_at,
    COALESCE(c.price_lock_enabled, false) AND u.id IS NOT NULL,
    c.price_lock_deposit_amount,
    -- Ouverture : 10 jours avant la hausse (cohérent avec les règles V1)
    CASE WHEN u.id IS NOT NULL THEN u.starts_at - interval '10 day' END,
    c.price_lock_guarantee_days,
    c.sale_end_date,
    -- Base d'expiration : prochain palier + garantie, plafonnée fin de vente
    CASE WHEN u.id IS NOT NULL THEN
      LEAST(
        u.starts_at + make_interval(days => c.price_lock_guarantee_days),
        COALESCE(c.sale_end_date, 'infinity'::timestamptz)
      )
    END
  FROM active a
  CROSS JOIN cfg c
  LEFT JOIN upcoming u ON true;
$$;

REVOKE EXECUTE ON FUNCTION get_event_ticket_pricing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_event_ticket_pricing(uuid) TO anon, authenticated;

-- 3. Vue pour les listes de cartes
CREATE OR REPLACE VIEW event_ticket_pricing_view AS
SELECT
  ett.event_id,
  ett.id AS event_ticket_type_id,
  tt.name AS ticket_type_name,
  ett.is_active,
  a.id AS current_tier_id,
  a.label AS current_tier_label,
  a.price AS current_price,
  u.id AS next_tier_id,
  u.price AS next_price,
  u.starts_at AS next_price_change_at,
  ett.price_lock_enabled,
  ett.price_lock_deposit_amount,
  ett.price_lock_guarantee_days,
  ett.sale_end_date,
  CASE WHEN u.id IS NOT NULL THEN
    LEAST(
      u.starts_at + make_interval(days => ett.price_lock_guarantee_days),
      COALESCE(ett.sale_end_date, 'infinity'::timestamptz)
    )
  END AS price_lock_expiration_basis
FROM event_ticket_types ett
LEFT JOIN ticket_types tt ON tt.id = ett.ticket_type_id
LEFT JOIN LATERAL (
  SELECT t.id, t.label, t.price
    FROM event_ticket_price_tiers t
   WHERE t.event_ticket_type_id = ett.id
     AND t.starts_at <= now()
     AND (t.ends_at IS NULL OR t.ends_at > now())
   ORDER BY t.starts_at DESC
   LIMIT 1
) a ON true
LEFT JOIN LATERAL (
  SELECT t.id, t.price, t.starts_at
    FROM event_ticket_price_tiers t
   WHERE t.event_ticket_type_id = ett.id
     AND t.starts_at > now()
   ORDER BY t.starts_at ASC
   LIMIT 1
) u ON true;

-- 4a. Rattachement des locks aux paliers
ALTER TABLE price_locks ADD COLUMN IF NOT EXISTS price_tier_id uuid
  REFERENCES event_ticket_price_tiers(id);

-- 4b. Trigger de dérivation : les champs legacy reflètent le palier actif
CREATE OR REPLACE FUNCTION derive_legacy_price_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  active_tier record;
  upcoming_tier record;
BEGIN
  SELECT t.price, t.id INTO active_tier
    FROM event_ticket_price_tiers t
   WHERE t.event_ticket_type_id = COALESCE(NEW.id, OLD.id)
     AND t.starts_at <= now()
     AND (t.ends_at IS NULL OR t.ends_at > now())
   ORDER BY t.starts_at DESC
   LIMIT 1;

  SELECT t.price, t.starts_at INTO upcoming_tier
    FROM event_ticket_price_tiers t
   WHERE t.event_ticket_type_id = COALESCE(NEW.id, OLD.id)
     AND t.starts_at > now()
   ORDER BY t.starts_at ASC
   LIMIT 1;

  IF active_tier IS NOT NULL THEN
    NEW.price := active_tier.price;
  END IF;
  IF upcoming_tier IS NOT NULL THEN
    NEW.next_price := upcoming_tier.price;
    NEW.price_increase_date := upcoming_tier.starts_at;
  ELSE
    NEW.next_price := NULL;
    NEW.price_increase_date := NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_derive_legacy_price ON event_ticket_types;
CREATE TRIGGER trg_derive_legacy_price
  BEFORE INSERT OR UPDATE ON event_ticket_types
  FOR EACH ROW EXECUTE FUNCTION derive_legacy_price_fields();

-- Droits d'écriture sur la table (anon n'a jamais accès aux écritures via la clé anon)
REVOKE INSERT, UPDATE, DELETE ON event_ticket_price_tiers FROM anon;
