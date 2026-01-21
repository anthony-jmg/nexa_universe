/*
  # Allow Access to Subscribers-Only Content When Professor Price is Free

  1. Problem
    - Content with visibility='subscribers_only' requires an active subscription
    - When a professor sets their subscription_price to 0, their content should be free
    - Currently, users still cannot access this content without subscribing

  2. Solution
    - Update RLS policies for programs and videos
    - Allow access to 'subscribers_only' content when professor's subscription_price = 0
    - Keep subscription requirement when subscription_price > 0

  3. Impact
    - Professors can make all their content free by setting price to 0
    - Content automatically becomes accessible without requiring subscription
    - Professors maintain full control over their monetization strategy
*/

-- Update programs RLS policy to allow access when professor subscription is free
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
    (
      visibility = 'subscribers_only' 
      AND (
        -- Access granted if professor subscription is free
        EXISTS (
          SELECT 1 FROM professors
          WHERE professors.id = programs.professor_id
          AND professors.subscription_price = 0
        )
        OR
        -- Access granted if user has active subscription
        EXISTS (
          SELECT 1 FROM professor_subscriptions
          WHERE professor_subscriptions.user_id = auth.uid()
          AND professor_subscriptions.professor_id = programs.professor_id
          AND professor_subscriptions.status = 'active'
          AND professor_subscriptions.expires_at > now()
        )
      )
    )
    OR
    professor_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Update videos RLS policy to allow access when professor subscription is free
DROP POLICY IF EXISTS "Simple video access" ON videos;

CREATE POLICY "Simple video access"
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
    (
      visibility = 'subscribers_only' 
      AND (
        -- Access granted if professor subscription is free
        EXISTS (
          SELECT 1 FROM professors
          WHERE professors.id = videos.professor_id
          AND professors.subscription_price = 0
        )
        OR
        -- Access granted if user has active subscription
        EXISTS (
          SELECT 1 FROM professor_subscriptions
          WHERE professor_subscriptions.user_id = auth.uid()
          AND professor_subscriptions.professor_id = videos.professor_id
          AND professor_subscriptions.status = 'active'
          AND professor_subscriptions.expires_at > now()
        )
      )
    )
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

-- Also update anonymous access policies
DROP POLICY IF EXISTS "Public programs viewable by everyone" ON programs;

CREATE POLICY "Public programs viewable by everyone"
  ON programs FOR SELECT
  TO anon
  USING (
    visibility = 'public' 
    OR 
    visibility = 'paid'
    OR
    (
      visibility = 'subscribers_only'
      AND EXISTS (
        SELECT 1 FROM professors
        WHERE professors.id = programs.professor_id
        AND professors.subscription_price = 0
      )
    )
  );

DROP POLICY IF EXISTS "Public videos viewable by everyone" ON videos;

CREATE POLICY "Public videos viewable by everyone"
  ON videos FOR SELECT
  TO anon
  USING (
    visibility = 'public'
    OR
    (
      visibility = 'subscribers_only'
      AND EXISTS (
        SELECT 1 FROM professors
        WHERE professors.id = videos.professor_id
        AND professors.subscription_price = 0
      )
    )
  );
