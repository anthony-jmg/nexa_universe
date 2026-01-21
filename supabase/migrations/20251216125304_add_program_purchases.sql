/*
  # Add Program Purchases Feature

  ## Overview
  This migration adds the ability for students to purchase individual programs
  without needing a professor subscription.

  ## New Tables

  ### 1. program_purchases
  Tracks individual program purchases by students
  - `id` (uuid, PK) - Purchase ID
  - `user_id` (uuid, FK to profiles) - Student who purchased
  - `program_id` (uuid, FK to programs) - Program purchased
  - `price_paid` (decimal) - Amount paid at time of purchase
  - `status` (text) - active, refunded, expired
  - `purchased_at` (timestamptz) - Purchase date
  - `expires_at` (timestamptz) - Expiration date (null for lifetime access)
  - `created_at` (timestamptz) - Record creation

  ## Modified Policies

  ### videos
  - Update SELECT policy to allow access if user has purchased the program

  ### programs
  - Update SELECT policy to show purchased programs

  ## Security
  - Enable RLS on program_purchases table
  - Students can view their own purchases
  - Professors can view purchases of their programs
  - Admins have full access

  ## Important Notes
  1. Students can purchase programs without professor subscription
  2. Purchase grants access to all videos in the program
  3. Purchases can be lifetime or time-limited
  4. Price is recorded at time of purchase for historical tracking
*/

-- Create program_purchases table
CREATE TABLE IF NOT EXISTS program_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  price_paid decimal(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'refunded', 'expired')),
  purchased_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, program_id)
);

ALTER TABLE program_purchases ENABLE ROW LEVEL SECURITY;

-- Program purchases policies

CREATE POLICY "Users can view own purchases"
  ON program_purchases FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own purchases"
  ON program_purchases FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own purchases"
  ON program_purchases FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Professors can view their program purchases"
  ON program_purchases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = program_purchases.program_id
      AND programs.professor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all purchases"
  ON program_purchases FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Update programs SELECT policy to include purchased programs

DROP POLICY IF EXISTS "Users can view public programs" ON programs;
CREATE POLICY "Users can view accessible programs"
  ON programs FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR EXISTS (
      SELECT 1 FROM program_purchases
      WHERE program_purchases.program_id = programs.id
      AND program_purchases.user_id = auth.uid()
      AND program_purchases.status = 'active'
      AND (program_purchases.expires_at IS NULL OR program_purchases.expires_at > now())
    )
    OR visibility = 'subscribers_only' AND EXISTS (
      SELECT 1 FROM professor_subscriptions
      WHERE professor_subscriptions.user_id = auth.uid()
      AND professor_subscriptions.professor_id = programs.professor_id
      AND professor_subscriptions.status = 'active'
      AND professor_subscriptions.expires_at > now()
    )
    OR professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Update videos SELECT policy to include program purchases

DROP POLICY IF EXISTS "Users can view videos" ON videos;
CREATE POLICY "Users can view accessible videos"
  ON videos FOR SELECT
  TO authenticated
  USING (
    -- Public videos or videos in public programs
    (visibility = 'public' AND (program_id IS NULL OR EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = videos.program_id
      AND programs.visibility = 'public'
    )))
    OR 
    -- Free videos
    is_free = true
    OR
    -- Videos from purchased programs
    (program_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM program_purchases
      WHERE program_purchases.program_id = videos.program_id
      AND program_purchases.user_id = auth.uid()
      AND program_purchases.status = 'active'
      AND (program_purchases.expires_at IS NULL OR program_purchases.expires_at > now())
    ))
    OR
    -- Videos for subscribers only (professor subscription)
    (visibility = 'subscribers_only' AND EXISTS (
      SELECT 1 FROM professor_subscriptions
      WHERE professor_subscriptions.user_id = auth.uid()
      AND professor_subscriptions.professor_id = videos.professor_id
      AND professor_subscriptions.status = 'active'
      AND professor_subscriptions.expires_at > now()
    ))
    OR
    -- Videos in programs for subscribers
    (program_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = videos.program_id
      AND programs.visibility = 'subscribers_only'
      AND EXISTS (
        SELECT 1 FROM professor_subscriptions
        WHERE professor_subscriptions.user_id = auth.uid()
        AND professor_subscriptions.professor_id = programs.professor_id
        AND professor_subscriptions.status = 'active'
        AND professor_subscriptions.expires_at > now()
      )
    ))
    OR
    -- Platform subscribers can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.platform_subscription_status = 'active'
      AND profiles.platform_subscription_expires_at > now()
    )
    OR
    -- Own videos (professor) or admin
    professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_program_purchases_user ON program_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_program_purchases_program ON program_purchases(program_id);
CREATE INDEX IF NOT EXISTS idx_program_purchases_status ON program_purchases(status);