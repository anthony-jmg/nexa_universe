/*
  # Fix Anonymous User Access to Public Content

  1. Problem
    - Anonymous (non-logged in) users cannot see public videos and programs
    - RLS policies may be conflicting or missing for anonymous users

  2. Solution
    - Drop all existing SELECT policies for videos and programs
    - Recreate clean policies for both anonymous and authenticated users
    - Ensure anonymous users can see:
      * Public videos
      * Public programs
      * Paid programs (to see what's available for purchase)

  3. Security
    - Anonymous users can VIEW public/paid content metadata
    - Actual video playback is controlled separately
    - Paid content requires authentication to purchase
*/

-- =============================================
-- VIDEOS POLICIES
-- =============================================

-- Drop all existing SELECT policies for videos
DROP POLICY IF EXISTS "Users can view videos" ON videos;
DROP POLICY IF EXISTS "Users can view accessible videos" ON videos;
DROP POLICY IF EXISTS "Users can view free videos" ON videos;
DROP POLICY IF EXISTS "Subscribers can view platform videos" ON videos;
DROP POLICY IF EXISTS "Users can view program videos" ON videos;
DROP POLICY IF EXISTS "Anonymous users can view public videos" ON videos;
DROP POLICY IF EXISTS "Anonymous users can view public program videos" ON videos;
DROP POLICY IF EXISTS "Anonymous users can view all videos for listing" ON videos;
DROP POLICY IF EXISTS "Simple video access" ON videos;
DROP POLICY IF EXISTS "Public videos viewable by everyone" ON videos;

-- Policy for anonymous users (not logged in)
CREATE POLICY "Anonymous users can view public videos"
  ON videos FOR SELECT
  TO anon
  USING (
    visibility = 'public'
  );

-- Policy for authenticated users (logged in)
CREATE POLICY "Authenticated users can view videos"
  ON videos FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR
    (visibility = 'platform' AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.platform_subscription_status = 'active'
      AND profiles.platform_subscription_expires_at > now()
    ))
    OR
    (visibility = 'subscribers_only' AND (
      EXISTS (
        SELECT 1 FROM professors
        WHERE professors.id = videos.professor_id
        AND professors.subscription_price = 0
      )
      OR
      EXISTS (
        SELECT 1 FROM professor_subscriptions
        WHERE professor_subscriptions.user_id = auth.uid()
        AND professor_subscriptions.professor_id = videos.professor_id
        AND professor_subscriptions.status = 'active'
        AND professor_subscriptions.expires_at > now()
      )
    ))
    OR
    (visibility = 'paid' AND EXISTS (
      SELECT 1 FROM video_purchases
      WHERE video_purchases.user_id = auth.uid()
      AND video_purchases.video_id = videos.id
      AND video_purchases.status = 'active'
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

-- =============================================
-- PROGRAMS POLICIES
-- =============================================

-- Drop all existing SELECT policies for programs
DROP POLICY IF EXISTS "Users can view programs" ON programs;
DROP POLICY IF EXISTS "Users can view accessible programs" ON programs;
DROP POLICY IF EXISTS "Anonymous users can view public programs" ON programs;
DROP POLICY IF EXISTS "Simple program access" ON programs;
DROP POLICY IF EXISTS "Public programs viewable by everyone" ON programs;

-- Policy for anonymous users (not logged in)
CREATE POLICY "Anonymous users can view public programs"
  ON programs FOR SELECT
  TO anon
  USING (
    visibility = 'public' 
    OR 
    visibility = 'paid'
  );

-- Policy for authenticated users (logged in)
CREATE POLICY "Authenticated users can view programs"
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
    (visibility = 'subscribers_only' AND (
      EXISTS (
        SELECT 1 FROM professors
        WHERE professors.id = programs.professor_id
        AND professors.subscription_price = 0
      )
      OR
      EXISTS (
        SELECT 1 FROM professor_subscriptions
        WHERE professor_subscriptions.user_id = auth.uid()
        AND professor_subscriptions.professor_id = programs.professor_id
        AND professor_subscriptions.status = 'active'
        AND professor_subscriptions.expires_at > now()
      )
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