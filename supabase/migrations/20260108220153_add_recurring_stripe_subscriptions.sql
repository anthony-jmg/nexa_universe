/*
  # Add Recurring Stripe Subscriptions Support

  ## Overview
  This migration adds support for true recurring Stripe subscriptions with automatic renewals,
  replacing the previous one-time payment system.

  ## Changes to Existing Tables
  
  1. **profiles**
     - Add `stripe_subscription_id` - Links to active Stripe subscription
     - Add `stripe_price_id` - Stores the price ID (monthly/yearly)
     - Add `subscription_cancel_at_period_end` - Flag for scheduled cancellations
  
  2. **professor_subscriptions**
     - Ensure proper Stripe subscription tracking is in place

  ## New Features
  - Automatic subscription renewal tracking
  - Proper cancellation handling (access until period end)
  - Subscription status synchronization with Stripe
  - Support for subscription upgrades/downgrades

  ## Security
  - All RLS policies remain in place
  - Only authenticated users can view their subscription data
  - Only service role can update subscription statuses via webhooks
*/

-- Add Stripe subscription fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_subscription_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_price_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'subscription_cancel_at_period_end'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_cancel_at_period_end boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id 
  ON profiles(stripe_subscription_id) 
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status 
  ON profiles(platform_subscription_status);

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expires 
  ON profiles(platform_subscription_expires_at) 
  WHERE platform_subscription_expires_at IS NOT NULL;

-- Create index for professor subscriptions
CREATE INDEX IF NOT EXISTS idx_professor_subscriptions_stripe_id 
  ON professor_subscriptions(stripe_subscription_id) 
  WHERE stripe_subscription_id IS NOT NULL;

-- Function to check if platform subscription is active and valid
CREATE OR REPLACE FUNCTION is_platform_subscription_active(profile_record profiles)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN profile_record.platform_subscription_status = 'active' 
    AND (
      profile_record.platform_subscription_expires_at IS NULL 
      OR profile_record.platform_subscription_expires_at > now()
    );
END;
$$;

-- Function to check if professor subscription is active
CREATE OR REPLACE FUNCTION is_professor_subscription_active(
  user_uuid uuid,
  prof_uuid uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  sub_record professor_subscriptions;
BEGIN
  SELECT * INTO sub_record
  FROM professor_subscriptions
  WHERE user_id = user_uuid 
    AND professor_id = prof_uuid
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  
  RETURN sub_record.id IS NOT NULL;
END;
$$;
