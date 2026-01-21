/*
  # Add Price Paid Tracking for Subscriptions

  ## Problem
  Currently, when a professor changes their subscription price:
  - New subscribers pay the new price (handled by Stripe)
  - Existing subscribers keep paying their original price (handled by Stripe)
  - BUT we have NO record in our database of what price each subscriber is actually paying
  
  This creates issues:
  - Can't display "You're paying €10/month" to users
  - Can't track revenue accurately
  - Can't implement grandfathering policies properly
  - Lost historical pricing data

  ## Solution
  Add `price_paid` column to track the actual price at subscription time:
  - Stores the monthly price the user agreed to pay
  - Never changes unless the user explicitly upgrades/downgrades
  - Enables proper price protection ("grandfathering")
  - Allows accurate financial reporting

  ## Changes
  1. Add `price_paid` column to `professor_subscriptions`
     - Stores the actual monthly price in the subscription currency
     - NOT NULL with default 0 for existing records
  
  2. Add `price_paid` column to `profiles` for platform subscriptions
     - Same purpose for platform-wide subscriptions
     - Consistent data model across subscription types

  ## Notes
  - Existing subscriptions will have price_paid = 0 (needs manual backfill from Stripe)
  - Future subscriptions will automatically store the correct price via webhook
  - This enables displaying "Subscribed at €X/month" in the UI
*/

-- Add price_paid to professor_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professor_subscriptions' AND column_name = 'price_paid'
  ) THEN
    ALTER TABLE professor_subscriptions 
    ADD COLUMN price_paid decimal(10,2) NOT NULL DEFAULT 0;
    
    COMMENT ON COLUMN professor_subscriptions.price_paid IS 
      'Monthly price the user is paying for this subscription. Protected from professor price changes (grandfathering).';
  END IF;
END $$;

-- Add price_paid to profiles for platform subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'platform_subscription_price_paid'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN platform_subscription_price_paid decimal(10,2) DEFAULT 0;
    
    COMMENT ON COLUMN profiles.platform_subscription_price_paid IS 
      'Monthly price the user is paying for platform subscription. Protected from price changes.';
  END IF;
END $$;

-- Create index for efficient queries by price range
CREATE INDEX IF NOT EXISTS idx_professor_subscriptions_price_paid 
  ON professor_subscriptions(price_paid) 
  WHERE price_paid > 0;

-- Update RLS policies (they don't need changes but we verify they exist)
-- Users can see their own subscription details including price_paid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'professor_subscriptions' 
    AND policyname = 'Users can view own professor subscriptions'
  ) THEN
    CREATE POLICY "Users can view own professor subscriptions"
      ON professor_subscriptions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;