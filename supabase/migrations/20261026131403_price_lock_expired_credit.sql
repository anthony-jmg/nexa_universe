/*
# Price Lock — crédit après expiration et rachat au prix public

Règle produit (validée) :
- un Price Lock EXPIRÉ perd son tarif bloqué et sa place réservée ;
- le versement déjà payé n'est pas remboursé mais reste déductible, UNE seule
  fois, du prix public actuel du MÊME billet (même événement, même type) ;
- jamais pour un lock `cancelled` (statut réservé à l'historique / l'admin) ;
- `completed` = pass réellement payé ; un lock expiré ne passe jamais `completed`.

## Changements
1. Colonnes de consommation du crédit sur `price_locks` (+ index unique).
2. `protect_price_lock_terms` : crédit consommé non modifiable, et aucune
   transition vers `completed` depuis un autre statut que `active`.
3. `price_lock_public_price` : prix public = palier actif (repli sur
   `event_ticket_types.price` uniquement si le billet n'a aucun palier,
   comme le parcours d'achat normal).
4. `expire_price_lock_if_due` + `expire_stale_price_locks` réécrite : toujours
   `expired`, reste à payer recalculé sur le palier actif.
5. `record_price_lock_payment` : solde refusé dès que `now() >= expires_at`
   (sauf débit automatique déjà lancé AVANT la date limite).
6. `claim_price_lock_auto_debit` : aucun débit automatique après la date limite.
7. `get_price_lock_repurchase_quote` : offre de rachat (propriétaire uniquement).
8. `consume_price_lock_credit` : consommation atomique et idempotente du crédit,
   création du billet et décompte du stock (serveur uniquement).
*/

-- 1. Consommation du crédit -------------------------------------------------
ALTER TABLE public.price_locks
  ADD COLUMN IF NOT EXISTS credit_consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS credit_consumed_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS credit_attendee_id uuid REFERENCES public.event_attendees(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS price_locks_credit_payment_intent_unique
  ON public.price_locks (credit_consumed_payment_intent_id)
  WHERE credit_consumed_payment_intent_id IS NOT NULL;

-- 2. Protection des termes ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_price_lock_terms()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.event_ticket_type_id IS DISTINCT FROM OLD.event_ticket_type_id
     OR NEW.price_tier_id IS DISTINCT FROM OLD.price_tier_id
     OR NEW.locked_price IS DISTINCT FROM OLD.locked_price
     OR NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount
     OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.price_increase_date IS DISTINCT FROM OLD.price_increase_date THEN
    RAISE EXCEPTION 'Les termes d''un Price Lock ne peuvent pas être modifiés';
  END IF;
  -- completed = pass réellement payé : uniquement depuis un lock actif.
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND OLD.status <> 'active' THEN
    RAISE EXCEPTION 'Un Price Lock % ne peut pas devenir completed', OLD.status;
  END IF;
  -- Crédit après expiration : consommé une seule fois, jamais réinitialisé.
  IF OLD.credit_consumed_at IS NOT NULL AND (
       NEW.credit_consumed_at IS DISTINCT FROM OLD.credit_consumed_at
       OR NEW.credit_consumed_payment_intent_id IS DISTINCT FROM OLD.credit_consumed_payment_intent_id
       OR NEW.credit_attendee_id IS DISTINCT FROM OLD.credit_attendee_id) THEN
    RAISE EXCEPTION 'Le crédit de ce Price Lock a déjà été utilisé';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- 3. Prix public actuel ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.price_lock_public_price(p_event_ticket_type_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT p.current_price FROM get_event_ticket_pricing(p_event_ticket_type_id) p),
    -- Billet sans palier : même repli que validate-and-create-order.
    (SELECT ett.price FROM event_ticket_types ett
      WHERE ett.id = p_event_ticket_type_id
        AND NOT EXISTS (SELECT 1 FROM event_ticket_price_tiers t WHERE t.event_ticket_type_id = ett.id))
  );
$$;

-- 4. Expiration ----------------------------------------------------------------
-- Un débit automatique lancé avant la date limite (< 2 h) peut se terminer.
CREATE OR REPLACE FUNCTION public.expire_price_lock_if_due(p_lock_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE price_locks pl
     SET status = 'expired',
         remaining_amount = GREATEST(0, COALESCE(price_lock_public_price(pl.event_ticket_type_id), pl.locked_price) - pl.total_paid),
         updated_at = now()
   WHERE pl.id = p_lock_id
     AND pl.status = 'active'
     AND pl.expires_at <= now()
     AND NOT (pl.auto_balance_payment_status = 'processing'
              AND pl.auto_balance_debit_attempted_at > now() - interval '2 hours');
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.expire_stale_price_locks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  expired_count integer := 0;
BEGIN
  FOR rec IN
    SELECT pl.id FROM price_locks pl
     WHERE pl.status = 'active' AND pl.expires_at <= now()
     FOR UPDATE OF pl SKIP LOCKED
  LOOP
    -- Toujours `expired` : jamais `completed` sans paiement réel.
    IF expire_price_lock_if_due(rec.id) THEN
      expired_count := expired_count + 1;
    END IF;
  END LOOP;
  RETURN expired_count;
END $$;

-- 5. Solde refusé après la date limite ------------------------------------------
CREATE OR REPLACE FUNCTION public.record_price_lock_payment(p_lock_id uuid, p_amount numeric, p_stripe_payment_intent_id text DEFAULT NULL::text, p_auto_debit boolean DEFAULT false)
 RETURNS price_locks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
    END IF;
  END IF;

  SELECT * INTO pl FROM price_locks WHERE id = p_lock_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Price Lock introuvable';
  END IF;
  IF pl.status <> 'active' THEN
    RAISE EXCEPTION 'Price Lock non actif (statut : %)', pl.status;
  END IF;
  -- Date limite dépassée : l'ancien tarif n'est plus garanti, même si le cron
  -- d'expiration n'est pas encore passé. Seul un débit automatique lancé AVANT
  -- la date limite peut encore être appliqué.
  IF pl.expires_at IS NOT NULL AND now() >= pl.expires_at
     AND NOT (p_auto_debit
              AND pl.auto_balance_debit_attempted_at IS NOT NULL
              AND pl.auto_balance_debit_attempted_at < pl.expires_at) THEN
    RAISE EXCEPTION 'Price Lock expiré : le tarif bloqué n''est plus garanti';
  END IF;
  -- Un débit automatique en cours bloque uniquement le paiement MANUEL :
  -- un seul des deux chemins peut solder le lock.
  IF NOT p_auto_debit
     AND pl.auto_balance_payment_status = 'processing'
     AND pl.auto_balance_debit_attempted_at > now() - interval '2 hours' THEN
    RAISE EXCEPTION 'Un débit automatique est en cours, réessaie dans quelques minutes';
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
         auto_balance_canceled_at = CASE
           WHEN balance_payment_mode = 'automatic' AND NOT p_auto_debit AND auto_balance_canceled_at IS NULL
           THEN now()
           ELSE auto_balance_canceled_at
         END,
         updated_at = now()
   WHERE id = p_lock_id
   RETURNING * INTO pl;

  RETURN pl;
END $$;

-- 6. Pas de débit automatique après la date limite -------------------------------
CREATE OR REPLACE FUNCTION public.claim_price_lock_auto_debit(p_lock_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
v_remaining numeric;
BEGIN
SELECT remaining_amount INTO v_remaining
FROM price_locks
WHERE id = p_lock_id
FOR UPDATE;

IF NOT FOUND THEN
RETURN NULL;
END IF;

UPDATE price_locks
SET auto_balance_payment_status = 'processing',
auto_balance_debit_attempted_at = now(),
auto_balance_failure_reason = NULL,
updated_at = now()
WHERE id = p_lock_id
AND status = 'active'
AND expires_at > now()
AND balance_payment_mode = 'automatic'
AND auto_balance_payment_at IS NOT NULL
AND auto_balance_payment_at <= now()
AND remaining_amount > 0
AND auto_balance_canceled_at IS NULL
AND (auto_balance_payment_status IS NULL
OR (auto_balance_payment_status = 'processing'
AND auto_balance_debit_attempted_at < now() - interval '2 hours'));

IF NOT FOUND THEN
RETURN NULL;
END IF;

RETURN v_remaining;
END;
$$;

-- 7. Offre de rachat ---------------------------------------------------------------
-- status : available | contact_us | sold_out | sales_closed | unavailable
--          | consumed | refunded | not_expired
CREATE OR REPLACE FUNCTION public.get_price_lock_repurchase_quote(p_lock_id uuid, p_user_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid;
  pl price_locks;
  ett event_ticket_types;
  ev events;
  v_price numeric;
  v_active_locks integer;
  v_status text;
BEGIN
  -- Client : toujours lui-même. Serveur (service_role) : utilisateur explicite.
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    v_user := auth.uid();
  ELSE
    v_user := p_user_id;
  END IF;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  PERFORM expire_price_lock_if_due(p_lock_id);

  SELECT * INTO pl FROM price_locks WHERE id = p_lock_id;
  IF NOT FOUND OR pl.user_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Price Lock introuvable' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO ett FROM event_ticket_types WHERE id = pl.event_ticket_type_id;
  SELECT * INTO ev FROM events WHERE id = pl.event_id;
  v_price := price_lock_public_price(pl.event_ticket_type_id);

  IF pl.status <> 'expired' THEN
    v_status := 'not_expired';
  ELSIF pl.credit_consumed_at IS NOT NULL THEN
    v_status := 'consumed';
  ELSIF pl.refund_processed_at IS NOT NULL THEN
    v_status := 'refunded';
  ELSIF ett.id IS NULL OR NOT COALESCE(ett.is_active, false)
        OR ev.id IS NULL OR NOT COALESCE(ev.is_active, false)
        OR COALESCE(ev.event_status, '') <> 'published'
        OR COALESCE(ev.end_date, ev.start_date, now()) <= now()
        OR COALESCE(v_price, 0) <= 0 THEN
    v_status := 'unavailable';
  ELSIF ett.sale_end_date IS NOT NULL AND now() >= ett.sale_end_date THEN
    v_status := 'sales_closed';
  ELSE
    SELECT count(*) INTO v_active_locks FROM price_locks
     WHERE event_ticket_type_id = ett.id AND status = 'active';
    IF ett.quantity_available IS NOT NULL
       AND ett.quantity_sold + v_active_locks >= ett.quantity_available THEN
      v_status := 'sold_out';
    ELSIF v_price <= pl.total_paid THEN
      v_status := 'contact_us';
    ELSE
      v_status := 'available';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'lock_id', pl.id,
    'event_id', pl.event_id,
    'event_ticket_type_id', pl.event_ticket_type_id,
    'current_price', v_price,
    'credit', pl.total_paid,
    'amount_due', CASE WHEN v_status = 'available' THEN round(v_price - pl.total_paid, 2) END
  );
END $$;

-- 8. Consommation atomique du crédit (serveur uniquement) -----------------------------
CREATE OR REPLACE FUNCTION public.consume_price_lock_credit(p_lock_id uuid, p_user_id uuid, p_payment_intent_id text, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  pl price_locks;
  ett event_ticket_types;
  ev events;
  v_existing price_locks;
  v_price numeric;
  v_active_locks integer;
  v_source event_attendees;
  v_email text;
  v_attendee uuid;
BEGIN
  IF p_payment_intent_id IS NULL OR p_payment_intent_id = '' THEN
    RAISE EXCEPTION 'Paiement Stripe manquant';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de paiement invalide';
  END IF;

  -- Idempotence : ce paiement a déjà consommé un crédit ?
  SELECT * INTO v_existing FROM price_locks WHERE credit_consumed_payment_intent_id = p_payment_intent_id;
  IF FOUND THEN
    IF v_existing.id <> p_lock_id THEN
      RAISE EXCEPTION 'Paiement déjà rattaché à un autre Price Lock';
    END IF;
    RETURN jsonb_build_object('ok', true, 'already', true, 'attendee_id', v_existing.credit_attendee_id);
  END IF;

  PERFORM expire_price_lock_if_due(p_lock_id);

  SELECT * INTO pl FROM price_locks WHERE id = p_lock_id FOR UPDATE;
  IF NOT FOUND OR pl.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Price Lock introuvable';
  END IF;
  -- Même paiement traité en parallèle (webhook + verify) : réponse idempotente.
  IF pl.credit_consumed_payment_intent_id = p_payment_intent_id THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'attendee_id', pl.credit_attendee_id);
  END IF;
  IF pl.status <> 'expired' THEN
    RAISE EXCEPTION 'Crédit disponible uniquement pour un Price Lock expiré (statut : %)', pl.status;
  END IF;
  IF pl.credit_consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Le crédit de ce Price Lock a déjà été utilisé';
  END IF;
  IF pl.refund_processed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Versement déjà remboursé : aucun crédit disponible';
  END IF;

  -- Stock et disponibilité revérifiés sous verrou au moment du paiement.
  SELECT * INTO ett FROM event_ticket_types WHERE id = pl.event_ticket_type_id FOR UPDATE;
  SELECT * INTO ev FROM events WHERE id = pl.event_id;
  v_price := price_lock_public_price(pl.event_ticket_type_id);
  IF ett.id IS NULL OR NOT COALESCE(ett.is_active, false)
     OR ev.id IS NULL OR NOT COALESCE(ev.is_active, false)
     OR COALESCE(ev.event_status, '') <> 'published'
     OR COALESCE(ev.end_date, ev.start_date, now()) <= now()
     OR COALESCE(v_price, 0) <= 0 THEN
    RAISE EXCEPTION 'Ce pass n''est plus disponible à la vente';
  END IF;
  IF ett.sale_end_date IS NOT NULL AND now() >= ett.sale_end_date THEN
    RAISE EXCEPTION 'Les ventes de ce pass sont terminées';
  END IF;
  SELECT count(*) INTO v_active_locks FROM price_locks
   WHERE event_ticket_type_id = ett.id AND status = 'active';
  IF ett.quantity_available IS NOT NULL
     AND ett.quantity_sold + v_active_locks >= ett.quantity_available THEN
    RAISE EXCEPTION 'Ce pass est complet';
  END IF;

  -- Participant : repris du billet annulé à l'expiration du lock.
  SELECT * INTO v_source FROM event_attendees
   WHERE user_id = pl.user_id AND event_ticket_type_id = pl.event_ticket_type_id
     AND check_in_status = 'cancelled'
   ORDER BY created_at DESC LIMIT 1;
  SELECT email INTO v_email FROM profiles WHERE id = pl.user_id;

  INSERT INTO event_attendees (
    event_id, user_id, event_ticket_type_id, qr_code, check_in_status,
    purchased_at, created_at,
    attendee_first_name, attendee_last_name, attendee_email, attendee_phone
  ) VALUES (
    pl.event_id, pl.user_id, pl.event_ticket_type_id, 'PLR-' || pl.id::text, 'not_checked_in',
    now(), now(),
    v_source.attendee_first_name, v_source.attendee_last_name,
    COALESCE(v_source.attendee_email, v_email), v_source.attendee_phone
  )
  ON CONFLICT (qr_code) DO NOTHING
  RETURNING id INTO v_attendee;
  IF v_attendee IS NULL THEN
    SELECT id INTO v_attendee FROM event_attendees WHERE qr_code = 'PLR-' || pl.id::text;
  END IF;

  UPDATE event_ticket_types SET quantity_sold = quantity_sold + 1 WHERE id = ett.id;

  UPDATE price_locks
     SET credit_consumed_at = now(),
         credit_consumed_payment_intent_id = p_payment_intent_id,
         credit_attendee_id = v_attendee
   WHERE id = pl.id;

  UPDATE stripe_payments SET price_lock_id = pl.id
   WHERE stripe_payment_intent_id = p_payment_intent_id AND price_lock_id IS NULL;

  RETURN jsonb_build_object('ok', true, 'already', false, 'attendee_id', v_attendee,
                            'public_price', v_price, 'credit', pl.total_paid, 'amount_paid', p_amount);
END $$;

-- 9. Droits ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.price_lock_public_price(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_price_lock_if_due(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_price_lock_credit(uuid, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_price_lock_repurchase_quote(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.price_lock_public_price(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_price_lock_if_due(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_price_lock_credit(uuid, uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_price_lock_repurchase_quote(uuid, uuid) TO authenticated, service_role;
-- Droits existants inchangés : expire_stale_price_locks, record_price_lock_payment,
-- claim_price_lock_auto_debit (postgres/service_role uniquement).
