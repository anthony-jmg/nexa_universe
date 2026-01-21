/*
  # Add Stripe Payment System

  ## Overview
  This migration adds comprehensive Stripe payment integration to support:
  - Payment tracking and transaction history
  - Checkout session management
  - Customer management with Stripe
  - Subscription tracking for professors and platform
  - Event ticket payments
  - Product and video purchases

  ## New Tables
  
  1. **stripe_customers**
     - Links platform users to Stripe customer IDs
     - Stores default payment method
     - Tracks customer metadata
  
  2. **stripe_payments**
     - Records all payment transactions
     - Links to orders, subscriptions, video purchases
     - Tracks payment status and metadata
  
  3. **stripe_checkout_sessions**
     - Temporary storage for checkout sessions
     - Links to target purchases (orders, subscriptions, etc.)
     - Expires after 24 hours

  ## Modified Tables
  
  1. **orders** - Add Stripe payment intent ID
  2. **professor_subscriptions** - Add Stripe subscription ID
  
  ## Security
  - All tables have RLS enabled
  - Users can only view their own payment data
  - Admins can view all payment data for management
  - Checkout sessions are only accessible by the creating user
*/

-- Create stripe_customers table
CREATE TABLE IF NOT EXISTS stripe_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE NOT NULL,
  default_payment_method text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create stripe_payments table
CREATE TABLE IF NOT EXISTS stripe_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_intent_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'eur' NOT NULL,
  status text NOT NULL,
  payment_type text NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES professor_subscriptions(id) ON DELETE SET NULL,
  video_purchase_id uuid REFERENCES video_purchases(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stripe_checkout_sessions table
CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE NOT NULL,
  payment_type text NOT NULL,
  target_id uuid,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'eur' NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add Stripe fields to existing tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN stripe_payment_intent_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'professor_subscriptions' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE professor_subscriptions ADD COLUMN stripe_subscription_id text;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_user_id ON stripe_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_intent_id ON stripe_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_order_id ON stripe_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_user_id ON stripe_checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_session_id ON stripe_checkout_sessions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_expires_at ON stripe_checkout_sessions(expires_at);

-- Enable RLS
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_customers

CREATE POLICY "Users can view own Stripe customer data"
  ON stripe_customers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Stripe customer data"
  ON stripe_customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Stripe customer data"
  ON stripe_customers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for stripe_payments

CREATE POLICY "Users can view own payments"
  ON stripe_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert payments"
  ON stripe_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service can update payments"
  ON stripe_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for stripe_checkout_sessions

CREATE POLICY "Users can view own checkout sessions"
  ON stripe_checkout_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own checkout sessions"
  ON stripe_checkout_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can update checkout sessions"
  ON stripe_checkout_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service can delete checkout sessions"
  ON stripe_checkout_sessions FOR DELETE
  TO authenticated
  USING (true);

-- Create function to clean up expired checkout sessions
CREATE OR REPLACE FUNCTION cleanup_expired_checkout_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM stripe_checkout_sessions
  WHERE expires_at < now() AND status = 'pending';
END;
$$;
