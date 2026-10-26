/*
# Price Lock expiré — fin de validité du montant déjà versé

Règle (validée) :
- fin de validité = MIN(event_ticket_types.sale_end_date, events.start_date)
  (sale_end_date NULL → events.start_date) ; end_date n'est jamais utilisée ;
- après cette date : montant définitivement inutilisable (statut credit_lapsed) ;
- contrôle strict au moment où le paiement est confirmé : refus → remboursement
  automatique (mécanisme existant), aucune exception liée à la session Stripe ;
- événement annulé : statut event_cancelled, distinct de credit_lapsed, aucun
  rachat, montant non déclaré perdu (traitement séparé, hors automatisation) ;
- pass complet / désactivé / événement dépublié : indisponibilité temporaire,
  montant conservé.

Aucun changement sur le stock, les Price Locks actifs, le prélèvement
automatique ou les autres paiements.
*/

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
  v_valid_until timestamptz;
  v_lapsed_reason text;
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
  -- Fin de validité : la plus proche entre fin des ventes et début de l'événement.
  v_valid_until := LEAST(ett.sale_end_date, ev.start_date);
  IF v_valid_until IS NOT NULL AND now() >= v_valid_until THEN
    v_lapsed_reason := CASE
      WHEN ett.sale_end_date IS NOT NULL AND ett.sale_end_date < ev.start_date THEN 'sales_closed'
      ELSE 'event_started'
    END;
  END IF;

  IF pl.status <> 'expired' THEN
    v_status := 'not_expired';
  ELSIF pl.credit_consumed_at IS NOT NULL THEN
    v_status := 'consumed';
  ELSIF pl.refund_processed_at IS NOT NULL THEN
    v_status := 'refunded';
  ELSIF ev.event_status = 'cancelled' THEN
    -- Cas séparé : ni rachat, ni perte automatique du montant.
    v_status := 'event_cancelled';
  ELSIF v_lapsed_reason IS NOT NULL THEN
    v_status := 'credit_lapsed';
  ELSIF ett.id IS NULL OR NOT COALESCE(ett.is_active, false)
        OR ev.id IS NULL OR NOT COALESCE(ev.is_active, false)
        OR COALESCE(ev.event_status, '') <> 'published'
        OR COALESCE(v_price, 0) <= 0 THEN
    -- Indisponibilité temporaire : le montant reste conservé.
    v_status := 'unavailable';
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
    'event_title', ev.title,
    'current_price', v_price,
    'credit', pl.total_paid,
    'credit_valid_until', v_valid_until,
    'lapsed_reason', CASE WHEN v_status = 'credit_lapsed' THEN v_lapsed_reason END,
    'amount_due', CASE WHEN v_status = 'available' THEN round(v_price - pl.total_paid, 2) END
  );
END $$;

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
  v_valid_until timestamptz;
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

  -- Contrôles revérifiés sous verrou au moment où le paiement est confirmé
  -- (règle stricte : aucune exception liée à l'ouverture de la session).
  SELECT * INTO ett FROM event_ticket_types WHERE id = pl.event_ticket_type_id FOR UPDATE;
  SELECT * INTO ev FROM events WHERE id = pl.event_id;
  IF ev.event_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cet événement a été annulé';
  END IF;
  v_valid_until := LEAST(ett.sale_end_date, ev.start_date);
  IF v_valid_until IS NOT NULL AND now() >= v_valid_until THEN
    IF ett.sale_end_date IS NOT NULL AND ett.sale_end_date < ev.start_date THEN
      RAISE EXCEPTION 'Les ventes de ce pass sont terminées';
    END IF;
    RAISE EXCEPTION 'L''événement a commencé';
  END IF;
  v_price := price_lock_public_price(pl.event_ticket_type_id);
  IF ett.id IS NULL OR NOT COALESCE(ett.is_active, false)
     OR ev.id IS NULL OR NOT COALESCE(ev.is_active, false)
     OR COALESCE(ev.event_status, '') <> 'published'
     OR COALESCE(v_price, 0) <= 0 THEN
    RAISE EXCEPTION 'Ce pass n''est pas disponible à la vente pour le moment';
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
-- Droits inchangés (CREATE OR REPLACE conserve les GRANT existants).
