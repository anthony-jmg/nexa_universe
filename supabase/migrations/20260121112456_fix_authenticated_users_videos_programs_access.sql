/*
  # Fix authenticated users access to videos and programs

  1. Problem
    - Only anonymous users had SELECT policies on videos and programs
    - Authenticated users (students, professors) had NO policies, so they saw nothing
    - This is why logged-in students see empty Academy page

  2. Solution
    - Add comprehensive SELECT policies for authenticated users
    - Allow them to see ALL discoverable content (public, paid, platform, subscribers_only)
    - Frontend will still enforce what they can actually ACCESS/WATCH
    - Database policies just control what they can SEE in the list

  3. Security
    - Users can discover all content for marketing purposes
    - Actual access control is enforced by:
      - Frontend checks (hasAccess, subscriptions, purchases)
      - Video token generation (get-cloudflare-video-token function)
      - Program access checks in ProgramDetail page
*/

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Authenticated users view videos" ON videos;
DROP POLICY IF EXISTS "Authenticated users view programs" ON programs;

-- Allow authenticated users to discover ALL videos (for browsing/marketing)
CREATE POLICY "Authenticated users can discover all videos"
  ON videos
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to discover ALL active programs (for browsing/marketing)
CREATE POLICY "Authenticated users can discover all programs"
  ON programs
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Note: Actual access control for playing videos is enforced by:
-- 1. Frontend checks in Academy.tsx (getVideoAccess function)
-- 2. Backend token generation in get-cloudflare-video-token edge function
-- 3. Cloudflare Stream signed URLs with expiration
