/*
  # Add Withdrawal Right Waiver Tracking

  ## Overview
  This migration adds tracking for withdrawal right waiver to prevent abuse of the 14-day withdrawal period.
  
  ## EU Consumer Rights Compliance
  According to EU Directive 2011/83/EU Article 16(m):
  "The consumer shall lose the right of withdrawal if they have expressly requested to begin 
  the performance of services before the end of the 14-day withdrawal period and have 
  acknowledged that they will thereby lose their right of withdrawal."
  
  When a user uses benefits from their subscription (e.g., discount on purchases), they waive 
  their right to withdraw and receive a refund.

  ## Anti-Abuse Protection
  - Platform subscription: If user accesses exclusive content during withdrawal period → waiver
  - Professor subscription: If user uses professor discount during withdrawal period → waiver
  
  ## Changes
  1. Add waiver tracking fields to subscription tables
  2. Add function to automatically mark waiver when benefits are used
  3. Update refund calculation to respect waiver

  ## New Columns
  - `profiles.platform_withdrawal_right_waived` - Boolean flag
  - `profiles.platform_withdrawal_waived_at` - Timestamp when waived
  - `profiles.platform_withdrawal_waiver_reason` - Why it was waived
  - `professor_subscriptions.withdrawal_right_waived` - Boolean flag
  - `professor_subscriptions.withdrawal_waived_at` - Timestamp
  - `professor_subscriptions.withdrawal_waiver_reason` - Why it was waived
*/

-- ========================================
-- 1. ADD WAIVER TRACKING TO PROFILES (PLATFORM SUBSCRIPTION)
-- ========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'platform_withdrawal_right_waived'
  ) THEN
    ALTER TABLE profiles ADD COLUMN platform_withdrawal_right_waived boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'platform_withdrawal_waived_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN platform_withdrawal_waived_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'platform_withdrawal_waiver_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN platform_withdrawal_waiver_reason text;
  END IF;
END $$;

-- ========================================
-- 2. ADD WAIVER TRACKING TO PROFESSOR_SUBSCRIPTIONS
-- ========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'withdrawal_right_waived'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN withdrawal_right_waived boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'withdrawal_waived_at'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN withdrawal_waived_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'withdrawal_waiver_reason'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN withdrawal_waiver_reason text;
  END IF;
END $$;

-- ========================================
-- 3. CREATE FUNCTION TO CHECK IF WITHIN WITHDRAWAL PERIOD
-- ========================================

CREATE OR REPLACE FUNCTION check_and_waive_platform_withdrawal_right(
  user_id_param uuid,
  waiver_reason_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_created timestamptz;
  already_waived boolean;
  within_period boolean;
BEGIN
  -- Get subscription info
  SELECT 
    platform_subscription_created_at,
    platform_withdrawal_right_waived
  INTO subscription_created, already_waived
  FROM profiles
  WHERE id = user_id_param;

  -- If no subscription or already waived, return false
  IF subscription_created IS NULL OR already_waived THEN
    RETURN false;
  END IF;

  -- Check if within 14-day period
  within_period := is_within_withdrawal_period(subscription_created);

  -- If within period, waive the right
  IF within_period THEN
    UPDATE profiles
    SET 
      platform_withdrawal_right_waived = true,
      platform_withdrawal_waived_at = now(),
      platform_withdrawal_waiver_reason = waiver_reason_param
    WHERE id = user_id_param;
    
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ========================================
-- 4. CREATE FUNCTION FOR PROFESSOR SUBSCRIPTION WAIVER
-- ========================================

CREATE OR REPLACE FUNCTION check_and_waive_professor_withdrawal_right(
  user_id_param uuid,
  professor_id_param uuid,
  waiver_reason_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_created timestamptz;
  already_waived boolean;
  within_period boolean;
  sub_id uuid;
BEGIN
  -- Get subscription info
  SELECT 
    id,
    subscription_created_at,
    withdrawal_right_waived
  INTO sub_id, subscription_created, already_waived
  FROM professor_subscriptions
  WHERE user_id = user_id_param 
    AND professor_id = professor_id_param
    AND status = 'active';

  -- If no subscription or already waived, return false
  IF subscription_created IS NULL OR already_waived THEN
    RETURN false;
  END IF;

  -- Check if within 14-day period
  within_period := is_within_withdrawal_period(subscription_created);

  -- If within period, waive the right
  IF within_period THEN
    UPDATE professor_subscriptions
    SET 
      withdrawal_right_waived = true,
      withdrawal_waived_at = now(),
      withdrawal_waiver_reason = waiver_reason_param
    WHERE id = sub_id;
    
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ========================================
-- 5. UPDATE REFUND CALCULATION FUNCTION
-- ========================================

DROP FUNCTION IF EXISTS calculate_refund_amount(timestamptz, decimal);

CREATE OR REPLACE FUNCTION calculate_platform_refund_amount(user_id_param uuid)
RETURNS decimal
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_created timestamptz;
  sub_amount decimal;
  waived boolean;
BEGIN
  -- Get subscription details
  SELECT 
    platform_subscription_created_at,
    platform_subscription_price_paid,
    platform_withdrawal_right_waived
  INTO sub_created, sub_amount, waived
  FROM profiles
  WHERE id = user_id_param;

  -- If no amount recorded, return 0
  IF sub_amount IS NULL OR sub_amount <= 0 THEN
    RETURN 0;
  END IF;

  -- If withdrawal right was waived (user used benefits), no refund
  IF waived THEN
    RETURN 0;
  END IF;

  -- Full refund within 14 days (EU withdrawal period) only if not waived
  IF is_within_withdrawal_period(sub_created) THEN
    RETURN sub_amount;
  END IF;

  -- No refund after 14 days
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_professor_refund_amount(
  user_id_param uuid,
  professor_id_param uuid
)
RETURNS decimal
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_created timestamptz;
  sub_amount decimal;
  waived boolean;
BEGIN
  -- Get subscription details
  SELECT 
    subscription_created_at,
    price_paid,
    withdrawal_right_waived
  INTO sub_created, sub_amount, waived
  FROM professor_subscriptions
  WHERE user_id = user_id_param 
    AND professor_id = professor_id_param
    AND status = 'active';

  -- If no amount recorded, return 0
  IF sub_amount IS NULL OR sub_amount <= 0 THEN
    RETURN 0;
  END IF;

  -- If withdrawal right was waived (user used benefits), no refund
  IF waived THEN
    RETURN 0;
  END IF;

  -- Full refund within 14 days (EU withdrawal period) only if not waived
  IF is_within_withdrawal_period(sub_created) THEN
    RETURN sub_amount;
  END IF;

  -- No refund after 14 days
  RETURN 0;
END;
$$;

-- ========================================
-- 6. ADD TRIGGERS TO AUTO-WAIVE ON BENEFIT USE
-- ========================================

-- Trigger for program purchases with discount
CREATE OR REPLACE FUNCTION auto_waive_on_program_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  program_price decimal;
  price_difference decimal;
BEGIN
  -- Get the original program price
  SELECT price INTO program_price
  FROM programs
  WHERE id = NEW.program_id;

  -- If user paid less than full price, they used a discount
  price_difference := program_price - NEW.price_paid;

  -- If discount was used (more than 0.01 difference to account for rounding)
  IF price_difference > 0.01 THEN
    -- Check if it was from professor subscription
    IF NEW.professor_id IS NOT NULL THEN
      PERFORM check_and_waive_professor_withdrawal_right(
        NEW.user_id,
        NEW.professor_id,
        'used_discount_on_program_purchase'
      );
    END IF;
    
    -- Could also be platform subscriber discount
    PERFORM check_and_waive_platform_withdrawal_right(
      NEW.user_id,
      'used_discount_on_program_purchase'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_waive_on_program_purchase
AFTER INSERT ON program_purchases
FOR EACH ROW
EXECUTE FUNCTION auto_waive_on_program_purchase();

-- Trigger for video purchases with discount
CREATE OR REPLACE FUNCTION auto_waive_on_video_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  video_price decimal;
  video_professor_id uuid;
  price_difference decimal;
BEGIN
  -- Get the original video price and professor
  SELECT price, professor_id INTO video_price, video_professor_id
  FROM videos
  WHERE id = NEW.video_id;

  -- If user paid less than full price, they used a discount
  price_difference := video_price - NEW.amount_paid;

  -- If discount was used (more than 0.01 difference to account for rounding)
  IF price_difference > 0.01 THEN
    -- Check if it was from professor subscription
    IF video_professor_id IS NOT NULL THEN
      PERFORM check_and_waive_professor_withdrawal_right(
        NEW.user_id,
        video_professor_id,
        'used_discount_on_video_purchase'
      );
    END IF;
    
    -- Could also be platform subscriber discount
    PERFORM check_and_waive_platform_withdrawal_right(
      NEW.user_id,
      'used_discount_on_video_purchase'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_waive_on_video_purchase
AFTER INSERT ON video_purchases
FOR EACH ROW
EXECUTE FUNCTION auto_waive_on_video_purchase();

-- ========================================
-- 7. ADD DOCUMENTATION COMMENTS
-- ========================================

COMMENT ON COLUMN profiles.platform_withdrawal_right_waived IS 'EU Directive 2011/83/EU Article 16(m): Right waived if user begins using service benefits during withdrawal period';
COMMENT ON COLUMN professor_subscriptions.withdrawal_right_waived IS 'EU Directive 2011/83/EU Article 16(m): Right waived if user begins using service benefits during withdrawal period';
COMMENT ON FUNCTION check_and_waive_platform_withdrawal_right IS 'Automatically waives withdrawal right when user uses platform subscription benefits';
COMMENT ON FUNCTION check_and_waive_professor_withdrawal_right IS 'Automatically waives withdrawal right when user uses professor subscription benefits';
