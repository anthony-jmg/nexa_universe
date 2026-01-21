/*
  # Fix Academy Public Access

  1. Changes
    - Allow anonymous users to view programs with 'subscribers_only' visibility (for display purposes)
    - Allow anonymous users to view videos with 'subscribers_only' visibility (for display purposes)
    - Add policy for anonymous users to view professors
  
  2. Security
    - Users can only VIEW the content, not access it
    - Actual access control is handled at the application level (showing lock icons, etc.)
    - Anonymous users still cannot watch/download restricted content
*/

-- Drop and recreate professors policy for anonymous users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'professors' 
    AND policyname = 'Public can view professors'
  ) THEN
    DROP POLICY "Public can view professors" ON professors;
  END IF;
END $$;

CREATE POLICY "Anyone can view professors"
  ON professors FOR SELECT
  TO anon, authenticated
  USING (true);

-- Add policy for anonymous users to view programs (including subscribers_only for display)
CREATE POLICY "Anonymous users can view all active programs"
  ON programs FOR SELECT
  TO anon
  USING (
    is_active = true 
    AND visibility IN ('public', 'subscribers_only', 'paid')
  );

-- Add policy for anonymous users to view videos (including subscribers_only for display)
CREATE POLICY "Anonymous users can view all videos for listing"
  ON videos FOR SELECT
  TO anon
  USING (
    visibility IN ('public', 'subscribers_only', 'paid')
  );
