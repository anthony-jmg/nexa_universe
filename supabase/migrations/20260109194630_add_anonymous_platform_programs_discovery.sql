/*
  # Allow anonymous users to discover NEXA Academy programs

  1. Changes
    - Drop the old "Anonymous view discoverable programs" policy
    - Create a new comprehensive policy for anonymous users to discover:
      - Public programs
      - Paid programs
      - Platform programs (NEXA Academy) - for discovery only
      - Subscribers-only programs from free professors
    
  2. Security
    - Anonymous users can VIEW/SELECT these programs in the list
    - Frontend will still enforce authentication and subscription requirements for actual access
    - This allows proper discovery and marketing of platform content
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Anonymous view discoverable programs" ON programs;

-- Create new comprehensive discovery policy for anonymous users
CREATE POLICY "Anonymous users can discover programs for marketing"
  ON programs
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (
      visibility = 'public'
      OR visibility = 'paid'
      OR visibility = 'platform'
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
