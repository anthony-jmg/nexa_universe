/*
# Audit Price Lock — corrections V1

Audit des 6 points demandés. Points déjà corrects (inchangés) :
1. `expires_at` est bien calculé depuis `price_increase_date + price_lock_guarantee_days`
   (hausse 20 nov + 30 jours = 20 déc pour tous, quelle que soit la date de création) — conservé.
2. Expiration : statut `expired`, paiements conservés, aucune recréditation,
   reste à payer recalculé sur le prix public courant, unité de quota libérée
   (disponibilité = quantity_available - quantity_sold - locks actifs) — conservé.

Corrections apportées :
## 1. Plafond fin des ventes (point 2 de l'audit)
`expires_at` est désormais plafonné à la date de fin de vente existante
`event_ticket_types.sale_end_date` (réutilisée, aucun champ ajouté) :
`expires_at = LEAST(hausse + garantie, sale_end_date)`.
La création d'un Price Lock est aussi refusée après la fin des ventes.

## 2. Concurrence / quota (point 4 de l'audit)
- Le trigger de création verrouille maintenant la ligne du billet (`FOR UPDATE`) :
  deux créations simultanées sur le même billet sont sérialisées au niveau base.
- Verrou consultatif par utilisateur (`pg_advisory_xact_lock`) : la limite de
  2 Price Locks actifs simultanés ne peut plus être dépassée par courses concurrentes.
- Correction du calcul de quota : on comptabilise désormais TOUS les locks actifs
  du billet (tous utilisateurs confondus), pas seulement ceux de l'utilisateur.
  Disponibilité réelle = quantity_available - quantity_sold - locks actifs.

## 3. Idempotence des paiements (point 5 de l'audit)
`record_price_lock_payment(lock_id, montant, stripe_payment_intent_id)` :
- s'appuie sur l'identifiant Stripe unique déjà stocké (colonne UNIQUE
  `stripe_payments.stripe_payment_intent_id`) ;
- rattache le paiement au Price Lock de façon atomique (claim `price_lock_id IS NULL`) ;
- un rejeu du même webhook (même identifiant Stripe) retourne l'état courant
  sans augmenter `total_paid` une seconde fois ;
- un paiement déjà rattaché à un autre lock est refusé.

## 4. Passage de palier 75 € -> 90 € (point 3 de l'audit)
Aucun mécanisme automatique n'existait. Fonction admin manuelle V1
`apply_price_increase(ticket_type_id)` : bascule `price = next_price`, puis
efface `next_price` / `price_increase_date` (les locks actifs déjà créés gardent
leur `locked_price` photographié ; les nouveaux locks restent fermés jusqu'à ce
que l'admin renseigne le prochain palier 90 € -> 110 €, etc.).
Exécution réservée au rôle service (admin) — révoquée à anon/authenticated/PUBLIC.

Aucune table ni colonne supprimée ; interface non modifiée.
*/

-- ============================================================
-- 1. Trigger de création : verrous + quota correct + plafond fin des ventes
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_price_lock_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg record;
  locks_for_type integer;
  active_user_locks integer;
  same_type_lock integer;
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

  -- Sérialise les créations concurrentes du même utilisateur (limite à 2 locks actifs)
  PERFORM pg_advisory_xact_lock(hashtext('price_lock_user_' || NEW.user_id::text));

  -- Max 1 Price Lock actif par utilisateur et par type de billet
  SELECT count(*) INTO same_type_lock FROM price_locks pl
   WHERE pl.user_id = NEW.user_id AND pl.event_ticket_type_id = NEW.event_ticket_type_id
     AND pl.status = 'active';
  IF same_type_lock > 0 THEN
    RAISE EXCEPTION 'Un seul Price Lock actif par billet et par utilisateur';
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
-- 2. Paiements idempotents (identifiant Stripe unique déjà stocké)
-- ============================================================
CREATE OR REPLACE FUNCTION record_price_lock_payment(
  p_lock_id uuid,
  p_amount numeric,
  p_stripe_payment_intent_id text DEFAULT NULL
) RETURNS price_locks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pl price_locks;
  public_price numeric;
  price_to_pay numeric;
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

REVOKE EXECUTE ON FUNCTION record_price_lock_payment(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_price_lock_payment(uuid, numeric, text) TO authenticated;

-- ============================================================
-- 3. Passage de palier : 75 € -> 90 € (admin manuel V1)
--    Bascule price = next_price ; les locks actifs gardent leur prix photographié
-- ============================================================
CREATE OR REPLACE FUNCTION apply_price_increase(p_event_ticket_type_id uuid)
RETURNS event_ticket_types
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated event_ticket_types;
BEGIN
  UPDATE event_ticket_types
     SET price = next_price,
         next_price = NULL,
         price_increase_date = NULL,
         price_lock_opens_at = NULL,
         updated_at = now()
   WHERE id = p_event_ticket_type_id
     AND next_price IS NOT NULL
     AND price_increase_date IS NOT NULL
   RETURNING * INTO updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucun prochain palier programmé pour ce billet';
  END IF;

  RETURN updated;
END $$;

REVOKE EXECUTE ON FUNCTION apply_price_increase(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_price_increase(uuid) TO service_role;