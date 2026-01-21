/*
  # Fix Profiles Public Access

  1. Changes
    - Drop the restrictive "Authenticated users can view profiles" policy
    - Create new policy allowing public (anon) and authenticated users to view all profiles
    - This enables professor listings to work for non-logged-in users

  2. Security
    - Profiles remain read-only for non-owners
    - Only profile viewing is public, not modification
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Authenticated users can view profiles'
  ) THEN
    DROP POLICY "Authenticated users can view profiles" ON profiles;
  END IF;
END $$;

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);
