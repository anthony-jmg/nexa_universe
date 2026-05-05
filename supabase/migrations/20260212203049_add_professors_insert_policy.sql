/*
  # Add INSERT policy for professors table

  1. Changes
    - Add policy allowing professors to insert their own entry
    - This ensures upsert operations work correctly
    - Complements the existing UPDATE policy
  
  2. Security
    - Only allows users to insert their own professor entry (auth.uid() = id)
    - Must have 'professor' role in profiles table
    - Prevents unauthorized professor entries
*/

-- Allow professors to insert their own entry
CREATE POLICY "Professors can insert own profile"
  ON professors FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id 
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'professor'
    )
  );