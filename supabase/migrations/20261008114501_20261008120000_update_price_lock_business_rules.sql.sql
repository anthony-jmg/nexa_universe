/*
# Mise à jour des règles métier Price Lock (V1 définitive)

Adapte les règles EXISTANTES du système Price Lock (tables `price_locks`,
`event_ticket_types`, `stripe_payments`) au fonctionnement définitif.
Aucune table supprimée, aucune donnée supprimée (la table est actuellement vide),
aucune relation modifiée.

## 1. Règles DÉJÀ conformes (inchangées)
- Photographie du prix : `locked_price` est snapshoté à la création et JAMAIS
  modifié tant que le lock est actif (trigger `protect_price_lock_terms`).
- Fenêtre d'ouverture : entre `price_lock_opens_at` (défaut : 10 jours avant la
  hausse) et `price_increase_date`.
- Durée de garantie : `expires_at = MIN(price_increase_date + price_lock_guarantee_days,
  sale_end_date)` — calculée depuis la date de hausse, PAS depuis `locked_at`.
- Expiration : statut `expired`, versements conservés, reste à payer recalculé
  sur le prix public courant, unité de quota libérée automatiquement
  (le quota est compté sur les locks ACTIFS uniquement).
- Idempotence Stripe : un même paiement n'est jamais comptabilisé deux fois.
- Un lock ne devient actif qu'après confirmation réelle du versement
  (création déclenchée par le webhook / verify-payment).
- L'achat direct complet reste indépendant du Price Lock.

## 2. Règles MODIFIÉES
### a) Un seul paiement du solde (fin des paiements fractionnés libres)
`record_price_lock_payment` n'accepte PLUS un montant quelconque : le paiement
doit couvrir la TOTALITÉ du solde (`locked_price - total_paid`) EN UNE SEULE
FOIS. Un montant inférieur est refusé. À la confirmation : `total_paid = locked_price`,
`remaining_amount = 0`, `status = 'completed'` (Full Pass confirmé).

### b) Un Price Lock par palier tarifaire
Nouvelle règle : 1 Price Lock maximum par utilisateur + billet + PALIER tarifaire
(identifié par `locked_price` + `price_increase_date`, tous statuts confondus).
Impossible de recréer un lock sur un palier déjà utilisé (même expiré/annulé) ;
un NOUVEAU palier ouvre un nouveau droit.

### c) Un seul lock actif par FESTIVAL (avant : par type de billet)
Le trigger limite désormais à 1 lock ACTIF par utilisateur et par FESTIVAL
(`event_id`), quel que soit le type de billet. La limite de 2 locks actifs
simultanés par utilisateur est conservée. L'achat direct n'est jamais concerné.

### d) Annulation volontaire (nouvelle fonction)
`cancel_price_lock(lock_id)` : réservée au propriétaire (ou service_role),
passe le statut à `cancelled`, horodate `cancelled_at`. Le tarif bloqué est perdu
immédiatement ; l'unité de quota est libérée automatiquement (statut plus actif).
Le versement reste rattaché au festival.

## 3. Colonnes ajoutées (table `price_locks`, aucune suppression)
- `price_increase_date timestamptz` : date de hausse du palier (photographiée),
  sert à identifier le palier tarifaire.
- `cancelled_at timestamptz` : horodatage de l'annulation volontaire.
- `refund_processed_at timestamptz` : rempli par l'admin si le versement a été
  remboursé (exclut alors le montant du crédit déductible).

## 4. Fonctions ajoutées (configuration & crédits, sans nouvelle table)
- `get_price_lock_refund_window_hours()` : fenêtre de remboursement V1
  (défaut 24 h), configurable via le paramètre base de données
  `app.price_lock_refund_window_hours` (ex. ALTER DATABASE ... SET).
- `price_lock_refund_eligible(lock_id)` : vrai si annulation volontaire dans la
  fenêtre et remboursement pas encore traité. Politique V1 à valider avec les CGV.
- `get_event_credit(user_id, event_id)` : crédit déductible pour un festival =
  somme des `total_paid` des locks `expired`/`cancelled` non remboursés de cet
  utilisateur sur ce festival. Aucun wallet : le crédit reste lié au festival.
- `get_price_lock_balance_due(lock_id)` : solde dû = `locked_price - total_paid`.

## 5. Index
- L'ancien index unique « 1 lock actif par utilisateur + type de billet » est
  remplacé par « 1 lock par utilisateur + billet + palier » (tous statuts),
  conforme à la nouvelle règle de palier. Table vide : aucun impact données.
- Les index de performance existants sont conservés.

## 6. Sécurité
- RLS inchangée (propriétaire uniquement, rôle `authenticated`).
- Nouvelles fonctions SECURITY DEFINER, `search_path = public`, exécution
  révoquée à PUBLIC/anon, accordée à `authenticated` (sauf `cancel_price_lock`
  qui vérifie en outre la propriété à l'intérieur de la fonction).
*/

-- ============================================================
-- 1. Colonnes ajoutées à price_locks
-- ============================================================
ALTER TABLE price_locks
  ADD COLUMN IF NOT EXISTS price_increase_date timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_processed_at timestamptz;

-- ============================================================
-- 2. Unicité : 1 Price Lock par utilisateur + billet + palier tarifaire
--    (remplace « 1 lock actif par utilisateur + type de billet »)
-- ============================================================
DROP INDEX IF EXISTS price_locks_one_active_per_user_type;

CREATE UNIQUE INDEX IF NOT EXISTS price_locks_one_per_user_tier
  ON price_locks (user_id, event_ticket_type_id, locked_price, price_increase_date);

-- ============================================================
-- 3. Trigger de création : règles mises à jour
--    - 1 lock actif max par utilisateur et par FESTIVAL
--    - 1 lock max par utilisateur + billet + palier (tous statuts)
--    - conserve : fenêtre, fin de ventes, quota atomique, limite 2 actifs
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_price_lock_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg record;
  locks_for_type integer;
  active_user_locks integer;
  active_same_event integer;
  prior_tier_locks integer;
BEGIN
  -- Sérialise les créations concurrentes sur le même billet (dernière unité incluse)
  SELECT ett.price, ett.price_lock_enabled, ett.price_lock_deposit_amount,
         ett.price_lock_guarantee_days, ett.price_increase_date,
         ett.price_lock_opens_at, ett.quantity_available, ett.quantity_sold,
         ett.event_id, ett.sale_end_date
    INTO cfg
    FROM event_ticket_types ett
   WHERE ett.id = NEW.event_ticket_type_id AND ett.is_active
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Type de billet introuvable ou inactif';
  END IF;
  IF NOT cfg.price_lock_enabled THEN
    RAISE EXCEPTION 'Price Lock non disponible pour ce billet';
  END IF;
  IF cfg.price_increase_date IS NULL THEN
    RAISE EXCEPTION 'Aucune hausse tarifaire programmée pour ce billet';
  END IF;
  IF cfg.sale_end_date IS NOT NULL AND now() >= cfg.sale_end_date THEN
    RAISE EXCEPTION 'Ventes closes pour ce billet';
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
  -- Expiration : hausse + garantie, plafonnée à la fin des ventes du billet
  NEW.expires_at := LEAST(
    cfg.price_increase_date + make_interval(days => cfg.price_lock_guarantee_days),
    COALESCE(cfg.sale_end_date, 'infinity'::timestamptz)
  );
  NEW.remaining_amount := cfg.price - cfg.price_lock_deposit_amount;
  NEW.locked_at := now();
  NEW.status := 'active';
  NEW.price_increase_date := cfg.price_increase_date;

  -- Sérialise les créations concurrentes du même utilisateur (limite à 2 locks actifs)
  PERFORM pg_advisory_xact_lock(hashtext('price_lock_user_' || NEW.user_id::text));

  -- 1 Price Lock maximum par utilisateur et par FESTIVAL
  SELECT count(*) INTO active_same_event FROM price_locks pl
   WHERE pl.user_id = NEW.user_id AND pl.event_id = NEW.event_id
     AND pl.status = 'active';
  IF active_same_event > 0 THEN
    RAISE EXCEPTION 'Un seul Price Lock actif par festival et par utilisateur';
  END IF;

  -- 1 Price Lock maximum par utilisateur + billet + PALIER tarifaire (tous statuts)
  SELECT count(*) INTO prior_tier_locks FROM price_locks pl
   WHERE pl.user_id = NEW.user_id
     AND pl.event_ticket_type_id = NEW.event_ticket_type_id
     AND pl.locked_price = NEW.locked_price
     AND pl.price_increase_date = NEW.price_increase_date;
  IF prior_tier_locks > 0 THEN
    RAISE EXCEPTION 'Un Price Lock a déjà été créé pour ce billet et ce palier tarifaire';
  END IF;

  -- Max 2 Price Locks actifs simultanément par utilisateur (achats directs non concernés)
  SELECT count(*) INTO active_user_locks FROM price_locks pl
   WHERE pl.user_id = NEW.user_id AND pl.status = 'active';
  IF active_user_locks >= 2 THEN
    RAISE EXCEPTION 'Maximum 2 Price Locks actifs simultanément';
  END IF;

  -- Quota Nexa : un lock actif réserve une unité, tous utilisateurs confondus
  IF cfg.quantity_available IS NOT NULL THEN
    SELECT count(*) INTO locks_for_type FROM price_locks pl
     WHERE pl.event_ticket_type_id = NEW.event_ticket_type_id
       AND pl.status = 'active';
    IF cfg.quantity_sold + locks_for_type >= cfg.quantity_available THEN
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
-- 4. Paiement : SOLDE UNIQUEMENT, en une seule fois
--    (supprime la possibilité de versements partiels intermédiaires)
-- ============================================================
CREATE OR REPLACE FUNCTION record_price_lock_payment(
  p_lock_id uuid,
  p_amount numeric,
  p_stripe_payment_intent_id text DEFAULT NULL
) RETURNS price_locks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pl price_locks;
  balance_due numeric;
  existing_lock_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de paiement invalide';
  END IF;

  -- Idempotence : rattache le paiement Stripe au lock exactement une fois
  IF p_stripe_payment_intent_id IS NOT NULL THEN
    UPDATE stripe_payments SET price_lock_id = p_lock_id
     WHERE stripe_payment_intent_id = p_stripe_payment_intent_id
       AND price_lock_id IS NULL;
    IF NOT FOUND THEN
      SELECT price_lock_id INTO existing_lock_id
        FROM stripe_payments WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;
      IF existing_lock_id IS NOT NULL THEN
        IF existing_lock_id <> p_lock_id THEN
          RAISE EXCEPTION 'Paiement déjà rattaché à un autre Price Lock';
        END IF;
        -- Déjà appliqué : réponse idempotente, total_paid non augmenté deux fois
        SELECT * INTO pl FROM price_locks WHERE id = p_lock_id;
        RETURN pl;
      END IF;
      -- Aucune ligne en base : le paiement sera enregistré par ailleurs, on applique
    END IF;
  END IF;

  SELECT * INTO pl FROM price_locks WHERE id = p_lock_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Price Lock introuvable';
  END IF;
  IF pl.status <> 'active' THEN
    RAISE EXCEPTION 'Price Lock non actif (statut : %)', pl.status;
  END IF;

  -- Solde dû : le paiement doit couvrir la TOTALITÉ en une seule fois
  balance_due := pl.locked_price - pl.total_paid;
  IF balance_due <= 0 THEN
    RAISE EXCEPTION 'Aucun solde restant sur ce Price Lock';
  END IF;
  IF abs(p_amount - balance_due) > 0.01 THEN
    RAISE EXCEPTION 'Le solde doit être payé en une seule fois (montant dû : % €)', balance_due;
  END IF;

  UPDATE price_locks
     SET total_paid = locked_price,
         remaining_amount = 0,
         status = 'completed',
         updated_at = now()
   WHERE id = p_lock_id
   RETURNING * INTO pl;

  RETURN pl;
END $$;

REVOKE EXECUTE ON FUNCTION record_price_lock_payment(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_price_lock_payment(uuid, numeric, text) TO authenticated;

-- ============================================================
-- 5. Annulation volontaire (distincte de l'expiration)
--    Statut cancelled, tarif perdu immédiatement, quota libéré
--    automatiquement (le quota ne compte que les locks actifs).
--    Le versement reste rattaché au festival (crédit déductible).
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_price_lock(p_lock_id uuid)
RETURNS price_locks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pl price_locks;
BEGIN
  SELECT * INTO pl FROM price_locks WHERE id = p_lock_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Price Lock introuvable';
  END IF;

  -- Propriétaire uniquement (service_role toléré pour l'administration)
  IF current_user <> 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> pl.user_id) THEN
    RAISE EXCEPTION 'Non autorisé : ce Price Lock n''appartient pas à cet utilisateur';
  END IF;

  IF pl.status <> 'active' THEN
    RAISE EXCEPTION 'Seul un Price Lock actif peut être annulé (statut : %)', pl.status;
  END IF;

  UPDATE price_locks
     SET status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   WHERE id = p_lock_id
   RETURNING * INTO pl;

  RETURN pl;
END $$;

REVOKE EXECUTE ON FUNCTION cancel_price_lock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_price_lock(uuid) TO authenticated;

-- ============================================================
-- 6. Politique de remboursement V1 (CONFIGURABLE, à aligner avec les CGV)
--    Fenêtre par défaut : 24 h après la création, ajustable via le paramètre
--    base de données app.price_lock_refund_window_hours (aucune table créée).
-- ============================================================
CREATE OR REPLACE FUNCTION get_price_lock_refund_window_hours()
RETURNS integer
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  raw text;
  hours integer;
BEGIN
  raw := current_setting('app.price_lock_refund_window_hours', true);
  IF raw IS NULL OR raw = '' THEN
    RETURN 24;
  END IF;
  BEGIN
    hours := raw::integer;
  EXCEPTION WHEN others THEN
    hours := 24;
  END;
  RETURN GREATEST(0, hours);
END $$;

-- Éligibilité au remboursement : annulation volontaire dans la fenêtre,
-- remboursement pas encore traité. Calculée depuis cancelled_at : résultat
-- déterministe après annulation, même si la configuration change ensuite.
CREATE OR REPLACE FUNCTION price_lock_refund_eligible(p_lock_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pl price_locks;
  window_hours integer;
BEGIN
  SELECT * INTO pl FROM price_locks WHERE id = p_lock_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF pl.status <> 'cancelled' OR pl.cancelled_at IS NULL OR pl.refund_processed_at IS NOT NULL THEN
    RETURN false;
  END IF;
  window_hours := get_price_lock_refund_window_hours();
  RETURN pl.cancelled_at - pl.locked_at <= make_interval(hours => window_hours);
END $$;

-- ============================================================
-- 7. Crédit déductible par festival (pas de wallet : lié au festival)
--    Somme des versements des locks expired/cancelled non remboursés.
--    Utilisé pour calculer : amount_due = prix public - crédit.
-- ============================================================
CREATE OR REPLACE FUNCTION get_event_credit(p_user_id uuid, p_event_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  credit numeric;
BEGIN
  SELECT COALESCE(SUM(pl.total_paid), 0) INTO credit
    FROM price_locks pl
   WHERE pl.user_id = p_user_id
     AND pl.event_id = p_event_id
     AND pl.status IN ('expired', 'cancelled')
     AND pl.refund_processed_at IS NULL;
  RETURN credit;
END $$;

-- ============================================================
-- 8. Solde dû d'un lock actif (le paiement du solde demande TOUJOURS ce montant)
-- ============================================================
CREATE OR REPLACE FUNCTION get_price_lock_balance_due(p_lock_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pl price_locks;
BEGIN
  SELECT * INTO pl FROM price_locks WHERE id = p_lock_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Price Lock introuvable';
  END IF;
  IF pl.status <> 'active' THEN
    RAISE EXCEPTION 'Price Lock non actif (statut : %)', pl.status;
  END IF;
  RETURN GREATEST(0, pl.locked_price - pl.total_paid);
END $$;

-- ============================================================
-- 9. Droits d'exécution des fonctions d'aide
-- ============================================================
REVOKE EXECUTE ON FUNCTION get_price_lock_refund_window_hours() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION price_lock_refund_eligible(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_event_credit(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_price_lock_balance_due(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_price_lock_refund_window_hours() TO authenticated;
GRANT EXECUTE ON FUNCTION price_lock_refund_eligible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_credit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_price_lock_balance_due(uuid) TO authenticated;
