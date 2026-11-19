-- Lot de corrections avant le premier festival.
-- 1. Coût négocié (nexa_cost) réservé à l'Admin : déplacé dans une table dédiée.
-- 2. Achat comptant : places revérifiées sous verrou au paiement (pas de survente).
-- 3. Le client ne peut plus annuler lui-même un billet.
-- 4. Remboursement intégral fait dans Stripe : billets annulés dans Nexa.

-- 1. Coût négocié -------------------------------------------------------------
-- La lecture publique de event_ticket_types exposait nexa_cost à tout visiteur.
-- Aucune valeur n'est renseignée aujourd'hui ; elles sont recopiées par
-- précaution avant le retrait de la colonne.
CREATE TABLE public.event_ticket_type_costs (
  event_ticket_type_id uuid PRIMARY KEY REFERENCES public.event_ticket_types(id) ON DELETE CASCADE,
  nexa_cost numeric CHECK (nexa_cost IS NULL OR nexa_cost >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_ticket_type_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ticket type costs"
  ON public.event_ticket_type_costs
  FOR ALL
  TO authenticated
  USING (nexa_caller_is_admin())
  WITH CHECK (nexa_caller_is_admin());

REVOKE ALL ON public.event_ticket_type_costs FROM anon;

INSERT INTO public.event_ticket_type_costs (event_ticket_type_id, nexa_cost)
SELECT id, nexa_cost FROM public.event_ticket_types WHERE nexa_cost IS NOT NULL;

ALTER TABLE public.event_ticket_types DROP COLUMN nexa_cost;

-- 2. Pas de survente à l'achat comptant ---------------------------------------
-- Les places sont revérifiées au paiement, sous verrou du type de billet.
-- Pass complet entre-temps : commande annulée, paiement remboursé par
-- fulfillPaidOrder (code 'sold_out'), jamais livrée ensuite ('already_refunded').
CREATE OR REPLACE FUNCTION public.claim_paid_order(p_order_id uuid, p_user_id uuid, p_amount_paid numeric, p_payment_intent_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o orders;
  v_status text;
  r record;
  v_locks integer;
  v_claimed integer;
  v_sold_out boolean := false;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.user_id IS DISTINCT FROM p_user_id THEN
    RETURN 'not_found';
  END IF;
  -- Une commande annulée (abandon, expiration) puis payée reste livrable.
  IF o.status NOT IN ('pending', 'cancelled') THEN
    RETURN 'already_processed';
  END IF;
  -- Sauf si ce paiement a déjà été remboursé faute de place : jamais livrée.
  IF o.status = 'cancelled' AND p_payment_intent_id IS NOT NULL
     AND o.stripe_payment_intent_id IS NOT DISTINCT FROM p_payment_intent_id THEN
    RETURN 'already_refunded';
  END IF;
  IF p_amount_paid IS NULL OR abs(p_amount_paid - o.total_amount) >= 0.01 THEN
    RETURN 'amount_mismatch';
  END IF;

  -- Achat comptant : places revérifiées sous verrou au moment du paiement
  -- (vendus + Price Locks actifs + commandes payées en cours de livraison).
  FOR r IN
    SELECT ett.id, ett.quantity_available, ett.quantity_sold, x.qty
      FROM (
        SELECT oi.event_ticket_type_id, sum(oi.quantity)::integer AS qty
          FROM order_items oi
         WHERE oi.order_id = p_order_id
           AND oi.item_type = 'event_ticket'
           AND oi.event_ticket_type_id IS NOT NULL
           AND oi.purchase_type IS DISTINCT FROM 'price_lock_deposit'
         GROUP BY oi.event_ticket_type_id
      ) x
      JOIN event_ticket_types ett ON ett.id = x.event_ticket_type_id
     ORDER BY ett.id
       FOR UPDATE OF ett
  LOOP
    CONTINUE WHEN r.quantity_available IS NULL;
    SELECT count(*) INTO v_locks
      FROM price_locks
     WHERE event_ticket_type_id = r.id AND status = 'active';
    SELECT count(*) INTO v_claimed
      FROM pending_event_attendees pa
      JOIN orders o2 ON o2.id = pa.reservation_id
     WHERE pa.event_ticket_type_id = r.id
       AND pa.reservation_id <> p_order_id
       AND pa.purchase_type IS DISTINCT FROM 'price_lock_deposit'
       AND o2.status IN ('processing', 'completed');
    IF r.quantity_sold + v_locks + v_claimed + r.qty > r.quantity_available THEN
      v_sold_out := true;
      EXIT;
    END IF;
  END LOOP;

  IF v_sold_out THEN
    UPDATE orders
       SET status = 'cancelled',
           stripe_payment_intent_id = p_payment_intent_id,
           updated_at = now()
     WHERE id = p_order_id;
    DELETE FROM stock_reservations WHERE reservation_id = p_order_id;
    DELETE FROM pending_event_attendees WHERE reservation_id = p_order_id;
    INSERT INTO order_audit_log (order_id, action, old_status, new_status, details)
    VALUES (p_order_id, 'sold_out_refund', o.status, 'cancelled',
            jsonb_build_object('payment_intent', p_payment_intent_id, 'amount', p_amount_paid));
    RETURN 'sold_out';
  END IF;

  v_status := CASE
    WHEN EXISTS (
      SELECT 1 FROM order_items
       WHERE order_id = p_order_id AND item_type = 'product' AND product_id IS NOT NULL
    ) THEN 'processing'
    ELSE 'completed'
  END;

  UPDATE orders
     SET status = v_status,
         stripe_payment_intent_id = p_payment_intent_id,
         updated_at = now()
   WHERE id = p_order_id;

  UPDATE product_sizes ps
     SET stock_quantity = GREATEST(ps.stock_quantity - oi.qty, 0)
    FROM (
      SELECT product_id, selected_size, sum(quantity) AS qty
        FROM order_items
       WHERE order_id = p_order_id
         AND item_type = 'product'
         AND product_id IS NOT NULL
         AND selected_size IS NOT NULL
       GROUP BY product_id, selected_size
    ) oi
   WHERE ps.product_id = oi.product_id
     AND ps.name = oi.selected_size;

  DELETE FROM stock_reservations WHERE reservation_id = p_order_id;

  RETURN v_status;
END $function$;

-- 3. Le client ne peut plus annuler lui-même un billet ------------------------
-- (annulation sans remboursement ni libération de place). Seuls nom, e-mail
-- et téléphone du participant restent modifiables par le client.
CREATE OR REPLACE FUNCTION public.guard_event_attendees_client_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  editable text[] := ARRAY[
    'attendee_first_name', 'attendee_last_name', 'attendee_email',
    'attendee_phone', 'check_in_status', 'updated_at'
  ];
BEGIN
  IF NOT nexa_is_client_role() OR nexa_caller_is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Les billets sont créés uniquement après paiement confirmé';
  END IF;

  IF (to_jsonb(NEW) - editable) IS DISTINCT FROM (to_jsonb(OLD) - editable) THEN
    RAISE EXCEPTION 'Modification non autorisée de ce billet';
  END IF;

  IF NEW.check_in_status IS DISTINCT FROM OLD.check_in_status THEN
    RAISE EXCEPTION 'Changement de statut du billet non autorisé';
  END IF;

  RETURN NEW;
END $function$;

-- 4. Remboursement intégral fait dans Stripe -----------------------------------
-- Appelée par le webhook (charge.refunded, remboursement total uniquement).
-- Annule les billets produits par ce paiement (jamais un billet déjà scanné),
-- libère les places et les Price Locks concernés. Idempotente.
CREATE OR REPLACE FUNCTION public.apply_full_stripe_refund(p_payment_intent_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sp stripe_payments;
  pl price_locks;
  v_lock_order uuid;
  v_attendee_ids uuid[] := '{}';
  v_lock_ids uuid[] := '{}';
  a event_attendees;
  v_cancelled integer := 0;
  v_kept integer := 0;
  v_locks integer := 0;
BEGIN
  IF p_payment_intent_id IS NULL OR p_payment_intent_id = '' THEN
    RAISE EXCEPTION 'Paiement Stripe manquant';
  END IF;

  SELECT * INTO sp FROM stripe_payments WHERE stripe_payment_intent_id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'unknown_payment');
  END IF;

  UPDATE stripe_payments
     SET status = 'refunded', updated_at = now()
   WHERE id = sp.id AND status IS DISTINCT FROM 'refunded';

  IF sp.order_id IS NOT NULL THEN
    -- Commande panier : ses billets et les Price Locks nés de ses versements.
    SELECT coalesce(array_agg(id), '{}') INTO v_attendee_ids
      FROM event_attendees WHERE qr_code LIKE 'EVT-' || sp.order_id::text || '-%';
    SELECT coalesce(array_agg(id), '{}') INTO v_lock_ids
      FROM price_locks
     WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = sp.order_id);
  ELSIF sp.price_lock_id IS NOT NULL THEN
    SELECT * INTO pl FROM price_locks WHERE id = sp.price_lock_id;
    IF sp.payment_type = 'price_lock_repurchase' THEN
      -- Rachat après expiration : le billet créé par ce paiement.
      IF pl.credit_consumed_payment_intent_id = p_payment_intent_id AND pl.credit_attendee_id IS NOT NULL THEN
        v_attendee_ids := ARRAY[pl.credit_attendee_id];
      END IF;
    ELSE
      -- Versement direct ou solde : le billet du Price Lock.
      SELECT oi.order_id INTO v_lock_order FROM order_items oi WHERE oi.id = pl.order_item_id;
      SELECT coalesce(array_agg(id), '{}') INTO v_attendee_ids
        FROM event_attendees
       WHERE qr_code = 'PL-' || pl.id::text
          OR (v_lock_order IS NOT NULL
              AND qr_code LIKE 'EVT-' || v_lock_order::text || '-' || pl.event_ticket_type_id::text || '-%');
      IF sp.payment_type = 'price_lock_deposit' THEN
        v_lock_ids := ARRAY[pl.id];
      END IF;
    END IF;
  END IF;

  FOR a IN SELECT * FROM event_attendees WHERE id = ANY (v_attendee_ids) FOR UPDATE LOOP
    IF a.check_in_status = 'checked_in' THEN
      v_kept := v_kept + 1;
    ELSIF a.check_in_status IN ('not_checked_in', 'awaiting_balance') THEN
      UPDATE event_attendees SET check_in_status = 'cancelled' WHERE id = a.id;
      -- Billet vendu (achat comptant ou Price Lock soldé) : la place est libérée.
      -- En attente du solde : la place était tenue par le Price Lock (ci-dessous).
      IF a.check_in_status = 'not_checked_in' THEN
        UPDATE event_ticket_types
           SET quantity_sold = GREATEST(quantity_sold - 1, 0)
         WHERE id = a.event_ticket_type_id;
      END IF;
      v_cancelled := v_cancelled + 1;
    END IF;
  END LOOP;

  -- Versement remboursé : Price Lock actif annulé (place libérée), crédit
  -- d'un Price Lock expiré neutralisé.
  UPDATE price_locks
     SET status = CASE WHEN status = 'active' THEN 'cancelled' ELSE status END,
         cancelled_at = CASE WHEN status = 'active' THEN now() ELSE cancelled_at END,
         refund_processed_at = coalesce(refund_processed_at, now())
   WHERE id = ANY (v_lock_ids)
     AND (status = 'active' OR (status = 'expired' AND credit_consumed_at IS NULL AND refund_processed_at IS NULL));
  GET DIAGNOSTICS v_locks = ROW_COUNT;

  IF sp.order_id IS NOT NULL THEN
    UPDATE orders SET status = 'cancelled', updated_at = now()
     WHERE id = sp.order_id AND status IN ('pending', 'processing', 'completed');
    IF FOUND THEN
      INSERT INTO order_audit_log (order_id, action, new_status, details)
      VALUES (sp.order_id, 'stripe_refund', 'cancelled',
              jsonb_build_object('payment_intent', p_payment_intent_id,
                                 'cancelled_tickets', v_cancelled, 'kept_checked_in', v_kept));
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'applied', 'cancelled_tickets', v_cancelled,
                            'kept_checked_in', v_kept, 'released_price_locks', v_locks);
END $function$;

REVOKE ALL ON FUNCTION public.apply_full_stripe_refund(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_full_stripe_refund(text) TO service_role;
