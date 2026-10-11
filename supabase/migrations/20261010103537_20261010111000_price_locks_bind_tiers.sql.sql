/*
# Rattachement des Price Locks aux paliers (règles V1 inchangées)

1. `enforce_price_lock_rules` : conserve TOUTES les règles V1 validées
   (fenêtre d'ouverture, fin de ventes, quota atomique, 1 lock par festival,
   1 lock par utilisateur+billet+palier, max 2 actifs). La seule évolution :
   le palier actif est lu depuis `event_ticket_price_tiers` (source de vérité
   unique) et NEW.price_tier_id est figé à sa création. Si aucun palier
   n'existe pour le billet, repli sur les champs legacy dérivés (comportement
   antérieur) pour ne jamais bloquer un événement non migré.
2. `record_price_lock_payment`, `cancel_price_lock`, fonctions de remboursement,
   crédit et solde : inchangées (règles métier déjà validées).
3. Aucune donnée modifiée ; les verrous et snapshots existants sont préservés.
*/

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

  -- Palier actif (source de vérité : event_ticket_price_tiers)
  SELECT t.id, t.price INTO NEW.price_tier_id, NEW.locked_price
    FROM event_ticket_price_tiers t
   WHERE t.event_ticket_type_id = NEW.event_ticket_type_id
     AND t.starts_at <= now()
     AND (t.ends_at IS NULL OR t.ends_at > now())
   ORDER BY t.starts_at DESC
   LIMIT 1;
  -- Repli legacy si le billet n'a aucun palier configuré
  IF NEW.price_tier_id IS NULL THEN
    NEW.locked_price := cfg.price;
  END IF;

  NEW.event_id := cfg.event_id;
  NEW.deposit_amount := cfg.price_lock_deposit_amount;
  NEW.total_paid := cfg.price_lock_deposit_amount;
  -- Expiration : hausse + garantie, plafonnée à la fin des ventes du billet
  NEW.expires_at := LEAST(
    cfg.price_increase_date + make_interval(days => cfg.price_lock_guarantee_days),
    COALESCE(cfg.sale_end_date, 'infinity'::timestamptz)
  );
  NEW.remaining_amount := NEW.locked_price - cfg.price_lock_deposit_amount;
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

-- Protection des termes figés : le palier d'origine ne change jamais
CREATE OR REPLACE FUNCTION protect_price_lock_terms()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.price_tier_id IS DISTINCT FROM OLD.price_tier_id THEN
    RAISE EXCEPTION 'Le palier d''un Price Lock est immuable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_price_locks_protect_tier ON price_locks;
CREATE TRIGGER trg_price_locks_protect_tier
  BEFORE UPDATE ON price_locks
  FOR EACH ROW EXECUTE FUNCTION protect_price_lock_terms();
