/*
  # Allow anonymous users to discover NEXA Academy videos

  1. Changes
    - Drop the old "Anonymous view discoverable videos" policy
    - Create a new comprehensive policy for anonymous users to discover:
      - Public videos
      - Platform videos (NEXA Academy) - for discovery only
      - Subscribers-only videos from free professors
    
  2. Security
    - Anonymous users can VIEW/SELECT these videos in the list
    - Frontend will still enforce authentication and subscription requirements for actual access
    - This allows proper discovery and marketing of platform content
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Anonymous view discoverable videos" ON videos;

-- Create new comprehensive discovery policy for anonymous users
CREATE POLICY "Anonymous users can discover videos for marketing"
  ON videos
  FOR SELECT
  TO anon
  USING (
    visibility = 'public'
    OR visibility = 'platform'
    OR (
      visibility = 'subscribers_only' 
      AND EXISTS (
        SELECT 1 FROM professors
        WHERE professors.id = videos.professor_id
        AND professors.subscription_price = 0
      )
    )
  );
