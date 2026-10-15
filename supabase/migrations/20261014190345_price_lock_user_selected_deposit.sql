/*
# Price Lock : montant choisi par l'utilisateur (versement minimum configurable)

Règles V1 conservées à l'identique : 1 lock par festival, max 2 actifs, 1 seul
paiement du solde, locked_price et expires_at figés, pas de versements partiels.

1. `enforce_price_lock_rules` (réécriture, mêmes règles + évolution unique) :
   - lit `NEW.selected_deposit_amount` (montant choisi par l'utilisateur, en €) ;
   - si absent/null : repli exact sur l'ancien comportement (dépôt fixe du
     billet) — 100 % rétrocompatible avec les flux existants et les anciens
     locks, qui ne sont jamais recalculés ;
   - si présent : valide côté serveur que le montant est un nombre fini,
     >= au minimum autorisé et strictement < au prix bloqué. Le minimum
     autorisé = max(price_lock_deposit_amount du billet, 20 €), SAUF pour les
     événements explicitement marqués `is_test` (environnement de test, montants
     libres < 20 € tolérés ; jamais appliqué aux événements publics) ;
   - applique NEW.deposit_amount = NEW.total_paid = montant validé et
     NEW.remaining_amount = locked_price - montant (structure inchangée).
2. `create_stripe_price_lock_deposit(p_user_id, p_ticket_type_id, p_amount)` :
   NOUVELLE fonction SECURITY DEFINER qui revalide intégralement côté serveur
   (billet actif, Price Lock activé, fenêtre, prix du palier via la fonction
   existante, quota, limites utilisateur, montant choisi) et retourne le montant
   réellement facturable. Aucun montant navigateur n'est utilisé sans contrôle.
3. Aucune colonne renommée, aucune donnée existante modifiée. Migration strictement
   additive : seule la définition du trigger existant est remplacée (comportement
   identique quand aucun montant n'est transmis).
*/

-- Colonne technique éphémère : permet de transmettre le montant choisi à
-- l'INSERT sans changer la signature de la table. Le trigger la remet à NULL.
ALTER TABLE price_locks ADD COLUMN IF NOT EXISTS selected_deposit_amount numeric;

-- ═══ 1. Trigger : montant choisi (optionnel) + minimum 20 € ═══

CREATE OR REPLACE FUNCTION enforce_price_lock_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg record;
  locks_for_type integer;
  active_user_locks integer;
  active_same_event integer;
  prior_tier_locks integer;
  v_event_is_test boolean;
  v_min_deposit numeric;
  v_chosen numeric;
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

  -- ═══ Montant du versement : choisi par l'utilisateur OU dépôt fixe (repli) ═══
  v_chosen := NEW.selected_deposit_amount;
  IF v_chosen IS NULL THEN
    -- Comportement historique exact : dépôt fixe configuré sur le billet
    NEW.deposit_amount := cfg.price_lock_deposit_amount;
    NEW.total_paid := cfg.price_lock_deposit_amount;
    NEW.remaining_amount := NEW.locked_price - cfg.price_lock_deposit_amount;
  ELSE
    -- Validation serveur stricte du montant choisi
    IF NOT isfinite(v_chosen) OR v_chosen <= 0 THEN
      RAISE EXCEPTION 'Montant de versement invalide';
    END IF;
    IF v_chosen >= NEW.locked_price THEN
      RAISE EXCEPTION 'Pour payer la totalité du pass, utilise Acheter maintenant';
    END IF;

    SELECT e.is_test INTO v_event_is_test FROM events e WHERE e.id = cfg.event_id;

    IF v_event_is_test THEN
      -- Exception STRICTEMENT réservée aux événements marqués test :
      -- le minimum reste le montant configuré sur le billet (souvent < 20 €).
      v_min_deposit := cfg.price_lock_deposit_amount;
    ELSE
      -- Événements publics : minimum global fonctionnel de 20 €
      v_min_deposit := GREATEST(cfg.price_lock_deposit_amount, 20);
    END IF;

    IF v_chosen < v_min_deposit THEN
      RAISE EXCEPTION 'Le versement minimum pour ce Price Lock est de % €', v_min_deposit;
    END IF;

    NEW.deposit_amount := v_chosen;
    NEW.total_paid := v_chosen;
    NEW.remaining_amount := NEW.locked_price - v_chosen;
  END IF;
  NEW.selected_deposit_amount := NULL; -- colonne technique, jamais stockée

  -- Expiration : hausse + garantie, plafonnée à la fin des ventes du billet
  NEW.expires_at := LEAST(
    cfg.price_increase_date + make_interval(days => cfg.price_lock_guarantee_days),
    COALESCE(cfg.sale_end_date, 'infinity'::timestamptz)
  );
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

-- ═══ 2. Validation serveur complète avant création du paiement Stripe ═══

CREATE OR REPLACE FUNCTION create_stripe_price_lock_deposit(
  p_user_id uuid,
  p_ticket_type_id uuid,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ett record;
  v_pricing record;
  v_min_deposit numeric;
  v_event_is_test boolean;
  v_active_locks integer;
  v_locks_for_type integer;
  v_unit_price numeric;
  v_amount numeric;
BEGIN
  IF p_amount IS NULL OR NOT isfinite(p_amount) OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de versement invalide';
  END IF;
  v_amount := round(p_amount::numeric, 2);

  SELECT * INTO ett FROM event_ticket_types
   WHERE id = p_ticket_type_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billet introuvable pour le Price Lock.';
  END IF;
  IF NOT ett.price_lock_enabled THEN
    RAISE EXCEPTION 'Price Lock non disponible pour ce billet.';
  END IF;
  IF ett.price_increase_date IS NULL THEN
    RAISE EXCEPTION 'Aucune hausse tarifaire programmée pour ce billet.';
  END IF;

  SELECT current_price INTO v_pricing
    FROM get_event_ticket_pricing(p_ticket_type_id);
  IF v_pricing IS NULL OR v_pricing.current_price IS NULL THEN
    RAISE EXCEPTION 'Aucun tarif actif pour ce billet. Contacte le support.';
  END IF;
  v_unit_price := v_pricing.current_price;

  -- Fenêtre Price Lock (mêmes règles que le trigger)
  IF now() < COALESCE(ett.price_lock_opens_at, ett.price_increase_date - interval '10 day')
     OR now() >= ett.price_increase_date THEN
    RAISE EXCEPTION 'Price Lock fermé pour ce billet.';
  END IF;

  -- Un seul Price Lock actif par utilisateur et par billet
  SELECT count(*) INTO v_active_locks FROM price_locks
   WHERE user_id = p_user_id AND event_ticket_type_id = p_ticket_type_id AND status = 'active';
  IF v_active_locks > 0 THEN
    RAISE EXCEPTION 'Tu as déjà un Price Lock actif pour ce billet.';
  END IF;

  -- Max 2 Price Locks actifs simultanément
  SELECT count(*) INTO v_active_locks FROM price_locks
   WHERE user_id = p_user_id AND status = 'active';
  IF v_active_locks >= 2 THEN
    RAISE EXCEPTION 'Maximum 2 Price Locks actifs simultanément.';
  END IF;

  -- Quota
  IF ett.quantity_available IS NOT NULL THEN
    SELECT count(*) INTO v_locks_for_type FROM price_locks
     WHERE event_ticket_type_id = p_ticket_type_id AND status = 'active';
    IF ett.quantity_sold + v_locks_for_type >= ett.quantity_available THEN
      RAISE EXCEPTION 'Quota Price Lock épuisé pour ce billet.';
    END IF;
  END IF;

  -- Montant choisi : minimum autorisé et strictement inférieur au prix bloqué
  IF v_amount >= v_unit_price THEN
    RAISE EXCEPTION 'Pour payer la totalité du pass, utilise Acheter maintenant.';
  END IF;

  SELECT e.is_test INTO v_event_is_test FROM events e WHERE e.id = ett.event_id;

  IF v_event_is_test THEN
    v_min_deposit := ett.price_lock_deposit_amount;
  ELSE
    v_min_deposit := GREATEST(ett.price_lock_deposit_amount, 20);
  END IF;

  IF v_amount < v_min_deposit THEN
    RAISE EXCEPTION 'Le versement minimum pour ce Price Lock est de % €.', v_min_deposit;
  END IF;

  RETURN v_amount;
END $$;
