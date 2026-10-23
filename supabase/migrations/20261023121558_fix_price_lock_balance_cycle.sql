/*
# Price Lock : cycle du solde (débit automatique, paiement manuel, participant)

1. Problèmes
- record_price_lock_payment (version en production, modifiée hors migrations)
  refuse tout paiement tant que auto_balance_payment_status = 'processing'
  (< 2 h). Or le débit automatique pose lui-même ce statut (claim) avant de
  créer le PaymentIntent : quand le webhook payment_intent.succeeded appelle
  record_price_lock_payment, l'appel est refusé. Le client est débité et le
  lock n'est jamais soldé.
- Achat direct d'un Price Lock (modale, hors panier) : aucun participant
  n'était créé ; complete_price_lock_attendees n'avait donc rien à confirmer
  au paiement du solde.

2. Correctifs
- record_price_lock_payment : nouveau paramètre p_auto_debit (défaut false).
  Le blocage « débit automatique en cours » ne s'applique qu'aux paiements
  manuels ; le webhook du débit automatique passe p_auto_debit = true.
- ensure_price_lock_attendee(p_lock_id) : crée (une seule fois) le
  participant 'awaiting_balance' d'un lock acheté hors panier. Idempotent
  via un identifiant technique unique 'PL-<lock_id>' (colonne qr_code
  obligatoire et unique ; aucun QR Nexa n'est généré ni utilisé).
*/

-- ═══ 1. record_price_lock_payment ═══

DROP FUNCTION IF EXISTS public.record_price_lock_payment(uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.record_price_lock_payment(
  p_lock_id uuid,
  p_amount numeric,
  p_stripe_payment_intent_id text DEFAULT NULL,
  p_auto_debit boolean DEFAULT false
)
RETURNS price_locks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE EXECUTE ON FUNCTION public.record_price_lock_payment(uuid, numeric, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_price_lock_payment(uuid, numeric, text, boolean) TO service_role;

-- ═══ 2. Participant d'un lock acheté hors panier ═══

CREATE OR REPLACE FUNCTION public.ensure_price_lock_attendee(p_lock_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pl price_locks;
  v_id uuid;
BEGIN
  SELECT * INTO pl FROM price_locks WHERE id = p_lock_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Price Lock introuvable';
  END IF;

  INSERT INTO event_attendees (
    event_id, user_id, event_ticket_type_id, qr_code, check_in_status,
    purchased_at, created_at, attendee_email
  )
  SELECT pl.event_id, pl.user_id, pl.event_ticket_type_id, 'PL-' || pl.id::text,
         CASE WHEN pl.status = 'completed' THEN 'not_checked_in' ELSE 'awaiting_balance' END,
         now(), now(), p.email
    FROM profiles p
   WHERE p.id = pl.user_id
  ON CONFLICT (qr_code) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM event_attendees WHERE qr_code = 'PL-' || pl.id::text;
  END IF;
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.ensure_price_lock_attendee(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_price_lock_attendee(uuid) TO service_role;
