/*
  # Fix videos update policy

  1. Changes
    - Drop existing "Professors can manage own videos" policy
    - Recreate with both USING and WITH CHECK clauses
    
  2. Security
    - Professors can only manage (select, insert, update, delete) their own videos
    - Admins can manage all videos
    - WITH CHECK ensures updates maintain ownership constraints
*/

-- Drop and recreate the policy with WITH CHECK clause
DROP POLICY IF EXISTS "Professors can manage own videos" ON videos;

CREATE POLICY "Professors can manage own videos"
  ON videos FOR ALL
  TO authenticated
  USING (
    professor_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    professor_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
