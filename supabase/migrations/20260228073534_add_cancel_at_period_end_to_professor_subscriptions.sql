/*
  # Add cancel_at_period_end and related cancellation fields to professor_subscriptions

  ## Summary
  The manage-subscription edge function tries to update `cancel_at_period_end`,
  `cancellation_reason`, `cancellation_feedback`, and `cancelled_at` on the
  `professor_subscriptions` table, but these columns did not exist.
  This caused silent failures when cancelling a professor subscription.

  ## Changes
  - `professor_subscriptions`
    - Add `cancel_at_period_end` (boolean, default false) — tracks pending cancellation
    - Add `cancellation_reason` (text, nullable) — reason provided by user
    - Add `cancellation_feedback` (text, nullable) — free-text feedback
    - Add `cancelled_at` (timestamptz, nullable) — timestamp of cancellation request
    - Add `withdrawal_right_waived` (boolean, default false) — EU withdrawal waiver flag
    - Add `withdrawal_waiver_reason` (text, nullable) — reason waiver was applied
    - Add `subscription_created_at` (timestamptz, nullable) — for withdrawal period calc
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'cancel_at_period_end'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN cancellation_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'cancellation_feedback'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN cancellation_feedback text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN cancelled_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'withdrawal_right_waived'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN withdrawal_right_waived boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'withdrawal_waiver_reason'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN withdrawal_waiver_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'subscription_created_at'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN subscription_created_at timestamptz DEFAULT now();
  END IF;
END $$;
