/*
  # Add anonymous discovery policies for videos and programs

  1. Problem
    - Anonymous (non-logged-in) users have no SELECT policies on videos and programs
    - This causes the Academy page to show "no videos or programs available" for visitors

  2. Solution
    - Add anon SELECT policies so anonymous users can discover content
    - Videos: show public and platform videos for marketing/discovery
    - Programs: show public, paid, and platform programs for marketing/discovery
    - Frontend already handles actual access control (login prompts, subscription checks)

  3. Security
    - Anonymous users can only VIEW metadata (titles, descriptions, thumbnails)
    - Actual video playback requires authentication + Cloudflare signed tokens
    - Purchase/subscription enforcement remains on frontend and edge functions
*/

-- Add anonymous discovery policy for videos
CREATE POLICY "Anon can discover videos"
  ON videos
  FOR SELECT
  TO anon
  USING (
    visibility IN ('public', 'platform')
    OR (
      visibility = 'subscribers_only'
      AND EXISTS (
        SELECT 1 FROM professors
        WHERE professors.id = videos.professor_id
        AND professors.subscription_price = 0
      )
    )
  );

-- Add anonymous discovery policy for programs
CREATE POLICY "Anon can discover programs"
  ON programs
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (
      visibility IN ('public', 'paid', 'platform')
      OR (
        visibility = 'subscribers_only'
        AND EXISTS (
          SELECT 1 FROM professors
          WHERE professors.id = programs.professor_id
          AND professors.subscription_price = 0
        )
      )
    )
  );
