/*
# Price Lock automatic balance debit — tracking columns

1. Plain-English summary
   Adds the server-side bookkeeping needed for the scheduled job that charges
   the remaining balance of Price Locks configured with the "automatic" payment
   mode. The actual Stripe charge is created by a scheduled Edge Function
   (debit-price-lock-balances); the existing Stripe webhook finalizes the
   payment. These columns let the job:
   - claim a lock atomically while a charge is in flight (status 'processing'),
   - record the final outcome ('paid' / 'failed') and the Stripe attempt,
   - avoid double-charging (unique attempt reference per lock).

2. New columns on `price_locks`
   - `auto_balance_payment_status` (text, nullable): lifecycle of the automatic
     debit — 'processing' (claimed, charge in flight), 'paid' (settled),
     'failed' (Stripe refused / authentication required). NULL = never attempted.
   - `auto_balance_debit_attempted_at` (timestamptz, nullable): when the last
     automatic debit attempt started.
   - `auto_balance_failure_reason` (text, nullable): why the last attempt failed.
   - `auto_balance_payment_intent_id` (text, nullable): Stripe PaymentIntent of
     the automatic debit. One attempt reference per lock, used for tracing and
     duplicate protection. No card data is ever stored — Stripe identifiers only.

3. Security
   - No RLS changes: the table's existing policies are untouched; the job runs
     server-side with the service role.
   - Check constraint guarantees the column only holds known states.

4. Notes
   - Purely additive migration; existing manual / automatic behavior unchanged.
   - Index added so the scheduled job's due-lock query stays fast.
*/

ALTER TABLE price_locks
  ADD COLUMN IF NOT EXISTS auto_balance_payment_status text,
  ADD COLUMN IF NOT EXISTS auto_balance_debit_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_balance_failure_reason text,
  ADD COLUMN IF NOT EXISTS auto_balance_payment_intent_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'price_locks_auto_balance_payment_status_check'
  ) THEN
    ALTER TABLE price_locks
      ADD CONSTRAINT price_locks_auto_balance_payment_status_check
      CHECK (auto_balance_payment_status IN ('processing', 'paid', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_price_locks_auto_debit_due
  ON price_locks (auto_balance_payment_at)
  WHERE status = 'active'
    AND balance_payment_mode = 'automatic'
    AND remaining_amount > 0;
