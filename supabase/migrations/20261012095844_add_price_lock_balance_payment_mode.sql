/*
# Balance payment mode (manual / automatic) for Price Locks

1. New columns on `cart_event_tickets` (additive only):
   - `balance_payment_mode` (text, nullable, default NULL) — how the user will pay the remaining balance of a Price Lock: 'manual' (they pay themselves from Nexa) or 'automatic' (auto-debit at the deadline if not paid before). Only meaningful for `purchase_type = 'price_lock_deposit'` rows; NULL otherwise.

2. New columns on `price_locks` (additive only):
   - `balance_payment_mode` (text, default 'manual', CHECK in manual/automatic) — definitive mode, written at lock creation from the validated checkout metadata (the cart is NOT the source of truth after payment).
   - `auto_balance_payment_at` (timestamptz, nullable) — planned auto-debit date (the lock deadline when mode = automatic).
   - `auto_balance_consent_at` (timestamptz, nullable) — when the user consented to the automatic debit.
   - `stripe_customer_id` (text, nullable) — Stripe Customer to reuse for the future off-session charge.
   - `stripe_payment_method_id` (text, nullable) — Stripe PaymentMethod saved via `setup_future_usage: 'off_session'` on the deposit payment. No bank data is ever stored in Nexa: only Stripe identifiers.
   - `auto_balance_canceled_at` (timestamptz, nullable) — set when the automatic debit is cancelled (balance paid early, manual switch, admin cancellation).
   Existing rows default to `balance_payment_mode = 'manual'` — no behavior change for historical locks.

3. Security: RLS is unchanged (these columns are managed by the server / webhook via service role; users keep their existing row-level access to their own locks and cart).

4. Business rules preserved: early manual payment (via existing `record_price_lock_payment`) sets remaining_amount = 0 and status = completed, so any future automatic debit is naturally skipped; the auto-payment worker (to be added separately) must also honor `auto_balance_canceled_at` and `balance_payment_mode = 'manual'`.
*/

-- 1. Cart item: chosen mode before add-to-cart
ALTER TABLE cart_event_tickets
  ADD COLUMN IF NOT EXISTS balance_payment_mode text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_event_tickets_balance_mode_check') THEN
    ALTER TABLE cart_event_tickets
      ADD CONSTRAINT cart_event_tickets_balance_mode_check
      CHECK (balance_payment_mode IS NULL OR balance_payment_mode IN ('manual', 'automatic'));
  END IF;
END $$;

COMMENT ON COLUMN cart_event_tickets.balance_payment_mode IS 'Price Lock only: how the remaining balance will be paid (manual | automatic). Chosen before add-to-cart.';

-- 2. Price lock: definitive configuration after deposit payment
ALTER TABLE price_locks
  ADD COLUMN IF NOT EXISTS balance_payment_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS auto_balance_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_balance_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS auto_balance_canceled_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_locks_balance_mode_check') THEN
    ALTER TABLE price_locks
      ADD CONSTRAINT price_locks_balance_mode_check
      CHECK (balance_payment_mode IN ('manual', 'automatic'));
  END IF;
END $$;

COMMENT ON COLUMN price_locks.balance_payment_mode IS 'Definitive mode set at lock creation from validated checkout metadata (manual | automatic).';
COMMENT ON COLUMN price_locks.stripe_payment_method_id IS 'Stripe PaymentMethod id saved with setup_future_usage=off_session on the deposit payment. No bank data stored here.';
