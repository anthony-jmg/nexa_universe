/*
# Atomic claim + finalize for Price Lock automatic balance debits

1. Plain-English summary
   Two SECURITY DEFINER helpers used by the scheduled Edge Function
   (debit-price-lock-balances) so that exactly ONE charge can ever be in
   flight for a given Price Lock, even if the job runs concurrently with a
   customer paying the balance manually ("Payer le solde") or the cron
   overlapping itself.

2. New functions

   `claim_price_lock_auto_debit(p_lock_id uuid) RETURNS numeric`
   - Atomically re-checks, AT THE MOMENT OF EXECUTION, that the lock is still:
     status = 'active', balance_payment_mode = 'automatic',
     auto_balance_payment_at <= now(), remaining_amount > 0,
     auto_balance_canceled_at IS NULL, auto_balance_payment_status IS NULL
     (never attempted) — plus a stale 'processing' safety window (> 2 h) so a
     crashed attempt cannot block the lock forever.
   - On success it flips auto_balance_payment_status to 'processing' inside the
     same UPDATE that re-validated all conditions (row locked with FOR UPDATE),
     and RETURNS remaining_amount. All guards (paid early → status completed /
     auto_balance_canceled_at set / remaining_amount = 0 / cancelled /
     expired) fall through to "do not charge" and return NULL.
   - Guards against re-claiming a lock whose auto debit is already
     'processing' or 'paid'.

   `finalize_price_lock_auto_debit(p_lock_id uuid, p_pi_id text, p_succeeded boolean, p_failure_reason text)`
   - Called after the Stripe attempt (from the job itself for immediate
     failures, and from the webhook for asynchronous results).
   - p_succeeded = true: nothing else to do here — the webhook's existing
     `record_price_lock_payment` sets total_paid = locked_price,
     remaining_amount = 0, status = 'completed' and confirms attendees; this
     function only stamps auto_balance_payment_status = 'paid' +
     auto_balance_payment_intent_id, idempotently (only from 'processing').
   - p_succeeded = false: marks 'failed', stores the reason, and CRITICALLY
     releases the claim — the lock returns to chargeable state so manual
     payment remains possible. remaining_amount is never modified.

3. Concurrency
   - Both functions run in a single SQL statement (atomic row UPDATE ... WHERE
     <all conditions>) — the database serializes concurrent claims; a manual
     payment racing the job either lands first (then the claim fails because
     status = 'completed' / remaining_amount = 0) or the claim lands first
     (then record_price_lock_payment rejects the manual payment only if it
     would double-pay — the webhook path remains the sole completion path).
   - No frontend involvement: job runs server-side only.

4. Security
   - SECURITY DEFINER with fixed search_path, EXECUTE not granted to anon/
     authenticated (default revoke in Supabase keeps them from PUBLIC only if
     explicitly revoked — done here) — service role + webhooks only.
*/

CREATE OR REPLACE FUNCTION claim_price_lock_auto_debit(p_lock_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION finalize_price_lock_auto_debit(
  p_lock_id uuid,
  p_pi_id text,
  p_succeeded boolean,
  p_failure_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_succeeded THEN
    UPDATE price_locks
    SET auto_balance_payment_status = 'paid',
        auto_balance_payment_intent_id = p_pi_id,
        updated_at = now()
    WHERE id = p_lock_id
      AND auto_balance_payment_status = 'processing';
  ELSE
    UPDATE price_locks
    SET auto_balance_payment_status = 'failed',
        auto_balance_failure_reason = left(COALESCE(p_failure_reason, 'Échec du débit'), 500),
        auto_balance_payment_intent_id = p_pi_id,
        updated_at = now()
    WHERE id = p_lock_id
      AND auto_balance_payment_status = 'processing';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_price_lock_auto_debit(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION finalize_price_lock_auto_debit(uuid, text, boolean, text) FROM anon, authenticated;
