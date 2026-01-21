/*
  # Fix professors visibility for anonymous users

  1. Changes
    - Update RLS policy to allow anonymous users to view professors
    - Add policy to allow anonymous users to view profiles (read-only)
  
  2. Security
    - Anonymous users can only SELECT (read) data
    - No write access for anonymous users
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can view professors" ON professors;

-- Create new policy that allows both authenticated and anonymous users
CREATE POLICY "Public can view professors"
  ON professors
  FOR SELECT
  TO public
  USING (true);

-- Also allow anonymous users to view professor profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

CREATE POLICY "Public can view profiles"
  ON profiles
  FOR SELECT
  TO public
  USING (true);
