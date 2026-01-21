/*
  # Fix Paid Programs Visibility for Authenticated Users

  1. Problem
    - Anonymous users can see programs with visibility='paid' to purchase them
    - Authenticated users can ONLY see programs with visibility='paid' if they already purchased them
    - This creates a paradox: authenticated users cannot purchase programs they cannot see

  2. Solution
    - Update the "Simple program access" policy to allow authenticated users to see 'paid' programs
    - They can see them to purchase them, just like anonymous users
    - Access control for actual content is handled separately

  3. Security
    - Users can VIEW paid programs without purchasing (to see what's available)
    - Access to video content is still controlled by separate policies
*/

DROP POLICY IF EXISTS "Simple program access" ON programs;

CREATE POLICY "Simple program access"
  ON programs FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR
    visibility = 'paid'
    OR
    (visibility = 'platform' AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.platform_subscription_status = 'active'
      AND profiles.platform_subscription_expires_at > now()
    ))
    OR
    (visibility = 'subscribers_only' AND EXISTS (
      SELECT 1 FROM professor_subscriptions
      WHERE professor_subscriptions.user_id = auth.uid()
      AND professor_subscriptions.professor_id = programs.professor_id
      AND professor_subscriptions.status = 'active'
      AND professor_subscriptions.expires_at > now()
    ))
    OR
    professor_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
