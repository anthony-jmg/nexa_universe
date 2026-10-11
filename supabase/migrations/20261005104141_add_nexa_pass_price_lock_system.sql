/*
# Nexa Pass — Price Lock backend integration (V1)

## Objectif
Adapter le backend existant au fonctionnement Nexa Pass / Price Lock sans dupliquer la structure.

## Tables existantes réutilisées
1. `events` — festivals (inchangée).
2. `event_ticket_types` — prix, stock et quota par type de billet (Full Pass, etc.). Colonnes ajoutées :
   - `next_price` : prochain prix public après la hausse.
   - `price_increase_date` : date de la prochaine hausse tarifaire.
   - `nexa_cost` : coût négocié Nexa auprès de l'organisateur.
   - `price_lock_enabled` : active/désactive le Price Lock pour ce billet (défaut : désactivé).
   - `price_lock_deposit_amount` : premier versement Price Lock (défaut : 20 €).
   - `price_lock_guarantee_days` : durée de garantie du prix bloqué APRÈS la hausse (défaut : 30 jours).
   - `price_lock_opens_at` : date d'ouverture du Price Lock (défaut calculé : 10 jours avant la hausse).
   - Le quota Nexa et les ventes réutilisent les colonnes existantes `quantity_available` / `quantity_sold`.
3. `orders` / `order_items` — achat direct inchangé (`item_type = 'event_ticket'` = achat complet).
4. `stripe_payments` — colonne ajoutée :
   - `price_lock_id` : relie un paiement à un Price Lock.
   - Identification par `payment_type` (valeur libre existante) : `price_lock_deposit` (premier versement), `price_lock_balance` (paiement du solde / partiel), achat complet inchangé.
5. `stock_reservations` — logique de réservation conservée ; un Price Lock actif réserve une unité du quota via le comptage des locks actifs.

## Nouvelle table `price_locks` (nécessaire : aucune table existante ne peut accueillir cette logique)
- `user_id` : propriétaire (défaut `auth.uid()`).
- `event_id` / `event_ticket_type_id` : festival et type de billet concernés.
- `locked_price` : prix bloqué, enregistré (photographié) au moment de la création, JAMAIS recalculé tant que le lock est actif.
- `deposit_amount` : premier versement (défaut 20 €).
- `total_paid` : cumul des sommes versées (jamais remis à zéro, même à l'expiration).
- `remaining_amount` : solde restant.
- `locked_at` / `expires_at` : création et date limite réelle (hausse + garantie).
- `status` : `active` / `completed` / `expired` / `cancelled`.
- Contrainte : 1 seul Price Lock actif par utilisateur et par type de billet (index unique partiel).

## Règles métier intégrées (triggers + fonctions SECURITY DEFINER)
1. Trigger `enforce_price_lock_rules` (avant insertion) :
   - photographie `locked_price` depuis le prix public du billet au moment de la création ;
   - applique le versement initial (défaut 20 €) : `total_paid = deposit`, `remaining_amount = locked_price - deposit` ;
   - calcule `expires_at = price_increase_date + guarantee_days` (prix garanti jusqu'à 30 jours après la hausse) ;
   - n'autorise la création qu'entre l'ouverture du lock (ou 10 jours avant la hausse) et la hausse ;
   - vérifie le quota : `quantity_sold + locks actifs < quantity_available` (un lock actif réserve une unité, une expiration la libère) ;
   - limite à 2 Price Locks actifs simultanément par utilisateur (les achats directs restent autorisés).
2. Trigger `protect_price_lock_terms` (avant mise à jour) : interdit de modifier les termes (`locked_price`, `deposit_amount`, `locked_at`, `expires_at`) d'un lock actif.
3. `record_price_lock_payment(lock_id, montant)` : enregistre un paiement (versement initial, partiel ou solde) ;
   met à jour `total_paid` / `remaining_amount` ; confirme le Full Pass (`status = 'completed`) quand `total_paid >= prix à payer` (tarif bloqué si lock garanti, tarif public sinon).
4. `expire_stale_price_locks()` : fait expirer les locks actifs dont la date limite est passée ;
   `remaining_amount = prix public actuel - total_paid` (jamais de perte des sommes versées, aucun paiement supprimé, historique conservé) ;
   complète automatiquement le lock si les sommes déjà versées couvrent le prix public.
   Planifiée chaque heure via pg_cron (si l'extension est active).

## Sécurité
- RLS activée sur `price_locks` ; 4 politiques distinctes (SELECT/INSERT/UPDATE/DELETE) limitées au propriétaire (`auth.uid() = user_id`), rôle `authenticated` (l'application a une connexion).
- Fonctions SECURITY DEFINER avec `search_path = public`, exécution révoquée à `anon`/PUBLIC, accordée à `authenticated`.
- Aucune table ou colonne existante supprimée ; aucune relation du frontend modifiée.
*/

-- ============================================================
-- 1. Évolution de event_ticket_types (config Price Lock par billet)
-- ============================================================
ALTER TABLE event_ticket_types
  ADD COLUMN IF NOT EXISTS next_price numeric,
  ADD COLUMN IF NOT EXISTS price_increase_date timestamptz,
  ADD COLUMN IF NOT EXISTS nexa_cost numeric,
  ADD COLUMN IF NOT EXISTS price_lock_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_lock_deposit_amount numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS price_lock_guarantee_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS price_lock_opens_at timestamptz;

-- ============================================================
-- 2. Table dédiée price_locks (aucune table existante équivalente)
-- ============================================================
CREATE TABLE IF NOT EXISTS price_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_ticket_type_id uuid NOT NULL REFERENCES event_ticket_types(id) ON DELETE CASCADE,
  locked_price numeric NOT NULL,
  deposit_amount numeric NOT NULL DEFAULT 20,
  total_paid numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_locks_ticket_type ON price_locks (event_ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_price_locks_user_status ON price_locks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_price_locks_event ON price_locks (event_id);
CREATE UNIQUE INDEX IF NOT EXISTS price_locks_one_active_per_user_type
  ON price_locks (user_id, event_ticket_type_id) WHERE status = 'active';

-- ============================================================
-- 3. Lien paiements -> Price Lock (stripe_payments)
-- ============================================================
ALTER TABLE stripe_payments
  ADD COLUMN IF NOT EXISTS price_lock_id uuid REFERENCES price_locks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stripe_payments_price_lock ON stripe_payments (price_lock_id);

-- ============================================================
-- 4. Trigger : règles de création (snapshot du prix, fenêtre, quota, limites)
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_price_lock_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg record;
  active_same_type integer;
  active_other_types integer;
BEGIN
  SELECT ett.price, ett.price_lock_enabled, ett.price_lock_deposit_amount,
         ett.price_lock_guarantee_days, ett.price_increase_date,
         ett.price_lock_opens_at, ett.quantity_available, ett.quantity_sold,
         ett.event_id
    INTO cfg
    FROM event_ticket_types ett
   WHERE ett.id = NEW.event_ticket_type_id AND ett.is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Type de billet introuvable ou inactif';
  END IF;
  IF NOT cfg.price_lock_enabled THEN
    RAISE EXCEPTION 'Price Lock non disponible pour ce billet';
  END IF;
  IF cfg.price_increase_date IS NULL THEN
    RAISE EXCEPTION 'Aucune hausse tarifaire programmée pour ce billet';
  END IF;

  -- Fenêtre d'ouverture : entre l'ouverture du lock (ou 10 jours avant la hausse) et la hausse
  IF now() < COALESCE(cfg.price_lock_opens_at, cfg.price_increase_date - interval '10 day')
     OR now() >= cfg.price_increase_date THEN
    RAISE EXCEPTION 'Price Lock fermé pour ce billet';
  END IF;

  -- Snapshot des termes : jamais recalculés tant que le lock est actif
  NEW.event_id := cfg.event_id;
  NEW.locked_price := cfg.price;
  NEW.deposit_amount := cfg.price_lock_deposit_amount;
  NEW.total_paid := cfg.price_lock_deposit_amount;
  NEW.remaining_amount := cfg.price - cfg.price_lock_deposit_amount;
  NEW.expires_at := cfg.price_increase_date + (cfg.price_lock_guarantee_days * interval '1 day');
  NEW.locked_at := now();
  NEW.status := 'active';

  -- Max 1 Price Lock actif par utilisateur et par type de billet
  SELECT count(*) INTO active_same_type FROM price_locks pl
   WHERE pl.user_id = NEW.user_id AND pl.event_ticket_type_id = NEW.event_ticket_type_id
     AND pl.status = 'active';
  IF active_same_type > 0 THEN
    RAISE EXCEPTION 'Un seul Price Lock actif par billet et par utilisateur';
  END IF;

  -- Max 2 Price Locks actifs simultanément par utilisateur (achats directs non concernés)
  SELECT count(*) INTO active_other_types FROM price_locks pl
   WHERE pl.user_id = NEW.user_id AND pl.status = 'active'
     AND pl.event_ticket_type_id <> NEW.event_ticket_type_id;
  IF active_other_types >= 2 THEN
    RAISE EXCEPTION 'Maximum 2 Price Locks actifs simultanément';
  END IF;

  -- Quota Nexa : un lock actif réserve une unité ; quantity_sold + locks actifs < quota
  IF cfg.quantity_available IS NOT NULL THEN
    IF cfg.quantity_sold + active_same_type >= cfg.quantity_available THEN
      RAISE EXCEPTION 'Quota Nexa épuisé pour ce billet';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_price_locks_enforce_rules ON price_locks;
CREATE TRIGGER trg_price_locks_enforce_rules
  BEFORE INSERT ON price_locks
  FOR EACH ROW EXECUTE FUNCTION enforce_price_lock_rules();

-- ============================================================
-- 5. Trigger : protection des termes d'un lock actif
-- ============================================================
CREATE OR REPLACE FUNCTION protect_price_lock_terms() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'active' AND (
       NEW.locked_price <> OLD.locked_price
       OR NEW.deposit_amount <> OLD.deposit_amount
       OR NEW.locked_at <> OLD.locked_at
       OR NEW.expires_at <> OLD.expires_at
     ) THEN
    RAISE EXCEPTION 'Les termes d''un Price Lock actif ne peuvent pas être modifiés';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_price_locks_protect_terms ON price_locks;
CREATE TRIGGER trg_price_locks_protect_terms
  BEFORE UPDATE ON price_locks
  FOR EACH ROW EXECUTE FUNCTION protect_price_lock_terms();

-- ============================================================
-- 6. Enregistrement d'un paiement (versement initial, partiel ou solde)
--    total_paid / remaining_amount ; confirmation quand total_paid >= prix à payer
-- ============================================================
CREATE OR REPLACE FUNCTION record_price_lock_payment(p_lock_id uuid, p_amount numeric)
RETURNS price_locks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pl price_locks;
  public_price numeric;
  price_to_pay numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de paiement invalide';
  END IF;

  SELECT * INTO pl FROM price_locks WHERE id = p_lock_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Price Lock introuvable';
  END IF;
  IF pl.status <> 'active' THEN
    RAISE EXCEPTION 'Price Lock non actif (statut : %)', pl.status;
  END IF;

  public_price := (SELECT price FROM event_ticket_types WHERE id = pl.event_ticket_type_id);
  -- Prix à payer : tarif bloqué tant que la garantie court, sinon tarif public en vigueur
  price_to_pay := CASE WHEN pl.expires_at >= now() THEN pl.locked_price ELSE public_price END;

  UPDATE price_locks
     SET total_paid = pl.total_paid + p_amount,
         remaining_amount = GREATEST(0, price_to_pay - (pl.total_paid + p_amount)),
         status = CASE WHEN pl.total_paid + p_amount >= price_to_pay THEN 'completed' ELSE 'active' END,
         updated_at = now()
   WHERE id = p_lock_id
   RETURNING * INTO pl;

  RETURN pl;
END $$;

-- ============================================================
-- 7. Expiration : les sommes versées restent acquises, seul le tarif tombe
--    remaining_amount = prix public actuel - total_paid
-- ============================================================
CREATE OR REPLACE FUNCTION expire_stale_price_locks() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec record;
  new_status text;
  new_remaining numeric;
  expired_count integer := 0;
BEGIN
  FOR rec IN
    SELECT pl.id, pl.total_paid, ett.price AS public_price
      FROM price_locks pl
      JOIN event_ticket_types ett ON ett.id = pl.event_ticket_type_id
     WHERE pl.status = 'active' AND pl.expires_at < now()
       FOR UPDATE OF pl SKIP LOCKED
  LOOP
    IF rec.total_paid >= rec.public_price THEN
      new_status := 'completed';
      new_remaining := 0;
    ELSE
      new_status := 'expired';
      new_remaining := rec.public_price - rec.total_paid;
    END IF;
    UPDATE price_locks
       SET status = new_status, remaining_amount = new_remaining, updated_at = now()
     WHERE id = rec.id;
    expired_count := expired_count + 1;
  END LOOP;
  RETURN expired_count;
END $$;

REVOKE EXECUTE ON FUNCTION record_price_lock_payment(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION expire_stale_price_locks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_price_lock_payment(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION expire_stale_price_locks() TO authenticated;

-- ============================================================
-- 8. Expiration automatique horaire (pg_cron si actif)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-price-locks') THEN
      PERFORM cron.unschedule('expire-price-locks');
    END IF;
    PERFORM cron.schedule('expire-price-locks', '0 * * * *', 'SELECT expire_stale_price_locks()');
  END IF;
END $$;

-- ============================================================
-- 9. RLS : propriétaire uniquement (application avec connexion)
-- ============================================================
ALTER TABLE price_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own price locks" ON price_locks;
CREATE POLICY "Users can view own price locks"
  ON price_locks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own price locks" ON price_locks;
CREATE POLICY "Users can create own price locks"
  ON price_locks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own price locks" ON price_locks;
CREATE POLICY "Users can update own price locks"
  ON price_locks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own price locks" ON price_locks;
CREATE POLICY "Users can delete own price locks"
  ON price_locks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);