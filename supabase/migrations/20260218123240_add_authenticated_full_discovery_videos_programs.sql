/*
  # Allow authenticated users to discover all videos and programs

  1. Problem
    - Authenticated users (including professors) cannot see videos/programs
      they don't have subscription access to
    - The existing "Users can view accessible videos" policy is too restrictive
      for discovery purposes — professors cannot see other professors' content
      in the Academy listing

  2. Solution
    - Add a broad discovery policy for authenticated users so they can see
      all videos and all active programs in the listing
    - Actual playback access is still enforced by:
      a) Frontend checks in Academy.tsx (getVideoAccess function)
      b) Backend Cloudflare signed token generation (get-cloudflare-video-token)
      c) Program detail page access checks

  3. Security
    - Seeing metadata (title, thumbnail, description) is safe for discovery
    - Actual video content is behind Cloudflare signed URLs with expiration
    - Purchase/subscription checks remain on frontend and edge functions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'videos'
    AND policyname = 'Authenticated users can discover all videos'
  ) THEN
    CREATE POLICY "Authenticated users can discover all videos"
      ON videos
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'programs'
    AND policyname = 'Authenticated users can discover all programs'
  ) THEN
    CREATE POLICY "Authenticated users can discover all programs"
      ON programs
      FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END $$;
