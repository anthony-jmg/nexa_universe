/*
# Price Lock early balance payment cancels automatic debit

Rule (absolute): when the user pays the remaining balance manually BEFORE the
auto-debit deadline, the automatic payment is cancelled / ignored — no further
debit will ever occur.

The existing `record_price_lock_payment` already sets status = 'completed' and
remaining_amount = 0 when the full balance is paid. This migration extends it to
also stamp `auto_balance_canceled_at` for automatic-mode locks, so the future
auto-debit worker can skip any lock that was paid early. No other rules touched.
*/

CREATE OR REPLACE FUNCTION record_price_lock_payment(
  p_lock_id uuid,
  p_amount numeric,
  p_stripe_payment_intent_id text DEFAULT NULL
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
auto_balance_canceled_at = CASE
  WHEN balance_payment_mode = 'automatic' AND auto_balance_canceled_at IS NULL
  THEN now()
  ELSE auto_balance_canceled_at
END,
updated_at = now()
WHERE id = p_lock_id
RETURNING * INTO pl;

RETURN pl;
END $$;
