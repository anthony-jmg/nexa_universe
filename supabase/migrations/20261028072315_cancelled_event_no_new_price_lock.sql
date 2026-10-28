-- Événement annulé : aucun nouveau Price Lock, quel que soit le chemin
-- (filet de sécurité après paiement : un versement encaissé pendant
-- l'annulation est remboursé par le mécanisme existant, lock refusé).
-- Une seule vérification ajoutée ; règles, quotas, paliers et limites inchangés.
-- Trigger BEFORE INSERT uniquement : les Price Locks existants ne sont pas touchés.
CREATE OR REPLACE FUNCTION public.enforce_price_lock_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
-- Événement annulé : aucun nouveau Price Lock.
IF EXISTS (SELECT 1 FROM events e WHERE e.id = cfg.event_id AND e.event_status = 'cancelled') THEN
RAISE EXCEPTION 'Cet événement a été annulé. Aucun nouvel achat ou Price Lock n’est possible.';
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

IF now() < COALESCE(cfg.price_lock_opens_at, cfg.price_increase_date - interval '10 day')
OR now() >= cfg.price_increase_date THEN
RAISE EXCEPTION 'Price Lock fermé pour ce billet';
END IF;

SELECT t.id, t.price INTO NEW.price_tier_id, NEW.locked_price
FROM event_ticket_price_tiers t
WHERE t.event_ticket_type_id = NEW.event_ticket_type_id
AND t.starts_at <= now()
AND (t.ends_at IS NULL OR t.ends_at > now())
ORDER BY t.starts_at DESC
LIMIT 1;
IF NEW.price_tier_id IS NULL THEN
NEW.locked_price := cfg.price;
END IF;

NEW.event_id := cfg.event_id;

v_chosen := NEW.selected_deposit_amount;
IF v_chosen IS NULL THEN
NEW.deposit_amount := cfg.price_lock_deposit_amount;
NEW.total_paid := cfg.price_lock_deposit_amount;
NEW.remaining_amount := NEW.locked_price - cfg.price_lock_deposit_amount;
ELSE
IF v_chosen <= 0 OR v_chosen > 100000 THEN
RAISE EXCEPTION 'Montant de versement invalide';
END IF;
IF v_chosen >= NEW.locked_price THEN
RAISE EXCEPTION 'Pour payer la totalité du pass, utilise Acheter maintenant';
END IF;

SELECT e.is_test INTO v_event_is_test FROM events e WHERE e.id = cfg.event_id;

IF v_event_is_test THEN
v_min_deposit := cfg.price_lock_deposit_amount;
ELSE
v_min_deposit := GREATEST(cfg.price_lock_deposit_amount, 20);
END IF;

IF v_chosen < v_min_deposit THEN
RAISE EXCEPTION 'Le versement minimum pour ce Price Lock est de % €', v_min_deposit;
END IF;

NEW.deposit_amount := v_chosen;
NEW.total_paid := v_chosen;
NEW.remaining_amount := NEW.locked_price - v_chosen;
END IF;
NEW.selected_deposit_amount := NULL;

NEW.expires_at := LEAST(
cfg.price_increase_date + make_interval(days => cfg.price_lock_guarantee_days),
COALESCE(cfg.sale_end_date, 'infinity'::timestamptz)
);
NEW.locked_at := now();
NEW.status := 'active';
NEW.price_increase_date := cfg.price_increase_date;

PERFORM pg_advisory_xact_lock(hashtext('price_lock_user_' || NEW.user_id::text));

SELECT count(*) INTO active_same_event FROM price_locks pl
WHERE pl.user_id = NEW.user_id AND pl.event_id = NEW.event_id
AND pl.status = 'active';
IF active_same_event > 0 THEN
RAISE EXCEPTION 'Un seul Price Lock actif par festival et par utilisateur';
END IF;

SELECT count(*) INTO prior_tier_locks FROM price_locks pl
WHERE pl.user_id = NEW.user_id
AND pl.event_ticket_type_id = NEW.event_ticket_type_id
AND pl.locked_price = NEW.locked_price
AND pl.price_increase_date = NEW.price_increase_date;
IF prior_tier_locks > 0 THEN
RAISE EXCEPTION 'Un Price Lock a déjà été créé pour ce billet et ce palier tarifaire';
END IF;

SELECT count(*) INTO active_user_locks FROM price_locks pl
WHERE pl.user_id = NEW.user_id AND pl.status = 'active';
IF active_user_locks >= 2 THEN
RAISE EXCEPTION 'Maximum 2 Price Locks actifs simultanément';
END IF;

IF cfg.quantity_available IS NOT NULL THEN
SELECT count(*) INTO locks_for_type FROM price_locks pl
WHERE pl.event_ticket_type_id = NEW.event_ticket_type_id
AND pl.status = 'active';
IF cfg.quantity_sold + locks_for_type >= cfg.quantity_available THEN
RAISE EXCEPTION 'Quota Nexa épuisé pour ce billet';
END IF;
END IF;

RETURN NEW;
END $function$;
