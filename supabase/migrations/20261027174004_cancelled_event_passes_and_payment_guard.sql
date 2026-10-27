-- Événement annulé : les pass restent visibles dans Mes Pass et plus aucun
-- paiement du solde (manuel ou automatique) ne peut être enregistré.
-- Aucune donnée existante modifiée ni supprimée.

-- 1. Mes Pass : événements liés à l'utilisateur connecté (billet ou Price Lock).
-- La RLS publique de `events` reste inchangée (published / upcoming actifs) :
-- cette fonction ne renvoie que les événements de l'utilisateur, et parmi
-- eux seulement ceux déjà visibles publiquement ou annulés.
CREATE OR REPLACE FUNCTION public.get_my_pass_events()
RETURNS TABLE (
  event_id uuid,
  title text,
  location text,
  start_date timestamptz,
  end_date timestamptz,
  thumbnail_url text,
  event_status text,
  is_active boolean,
  attendee_amounts jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH linked AS (
    SELECT a.event_id FROM event_attendees a WHERE a.user_id = auth.uid()
    UNION
    SELECT pl.event_id FROM price_locks pl WHERE pl.user_id = auth.uid()
  ),
  amounts AS (
    -- Montant réellement payé par billet (jamais le prix public actuel).
    SELECT a.event_id, a.id AS attendee_id,
      COALESCE(
        -- Pass Price Lock (PL-<lock>) : total versé sur le lock.
        (SELECT pl.total_paid FROM price_locks pl
          WHERE pl.user_id = a.user_id AND a.qr_code = 'PL-' || pl.id::text),
        -- Rachat après expiration (PLR-<lock>) : versement + paiement du rachat.
        (SELECT pl.total_paid + sp.amount FROM price_locks pl
           JOIN stripe_payments sp ON sp.stripe_payment_intent_id = pl.credit_consumed_payment_intent_id
          WHERE pl.user_id = a.user_id AND a.qr_code = 'PLR-' || pl.id::text),
        -- Commande (EVT-<commande>-…) : total versé sur le Price Lock lié à la
        -- ligne, sinon prix unitaire payé (order_items).
        (SELECT COALESCE(pl.total_paid, oi.unit_price)
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id AND oi.event_ticket_type_id = a.event_ticket_type_id
           LEFT JOIN price_locks pl ON pl.order_item_id = oi.id
          WHERE o.user_id = a.user_id
            AND o.status = 'completed'
            AND a.qr_code LIKE 'EVT-' || o.id::text || '-%'
          ORDER BY oi.created_at
          LIMIT 1)
      ) AS amount_paid
      FROM event_attendees a
     WHERE a.user_id = auth.uid()
  )
  SELECT e.id, e.title, e.location, e.start_date, e.end_date, e.thumbnail_url,
         e.event_status, e.is_active,
         COALESCE(
           (SELECT jsonb_object_agg(am.attendee_id, am.amount_paid)
              FROM amounts am
             WHERE am.event_id = e.id AND am.amount_paid IS NOT NULL),
           '{}'::jsonb)
    FROM events e
    JOIN linked l ON l.event_id = e.id
   WHERE (e.event_status IN ('published', 'upcoming') AND e.is_active)
      OR e.event_status = 'cancelled';
$function$;

REVOKE ALL ON FUNCTION public.get_my_pass_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pass_events() TO authenticated;

-- 2. Débit automatique : jamais réservé si l'événement est annulé.
CREATE OR REPLACE FUNCTION public.claim_price_lock_auto_debit(p_lock_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
-- Événement annulé : aucun prélèvement automatique.
AND NOT EXISTS (
  SELECT 1 FROM events e
   WHERE e.id = price_locks.event_id AND e.event_status = 'cancelled'
)
AND (auto_balance_payment_status IS NULL
OR (auto_balance_payment_status = 'processing'
AND auto_balance_debit_attempted_at < now() - interval '2 hours'));

IF NOT FOUND THEN
RETURN NULL;
END IF;

RETURN v_remaining;
END;
$function$;

-- 3. Paiement du solde : refusé si l'événement est annulé. Un paiement déjà
-- encaissé par Stripe (course) est alors remboursé par applyBalancePayment.
CREATE OR REPLACE FUNCTION public.record_price_lock_payment(p_lock_id uuid, p_amount numeric, p_stripe_payment_intent_id text DEFAULT NULL::text, p_auto_debit boolean DEFAULT false)
 RETURNS price_locks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Événement annulé : aucun solde ne peut être enregistré (manuel ou automatique).
  IF EXISTS (SELECT 1 FROM events e WHERE e.id = pl.event_id AND e.event_status = 'cancelled') THEN
    RAISE EXCEPTION 'Cet événement a été annulé : aucun paiement ne peut être enregistré';
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
END $function$;
