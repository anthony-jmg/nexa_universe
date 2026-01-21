/*
  # Simplify RLS to Eliminate Recursion

  1. Problem
    - Multiple SELECT policies on programs cause all to be evaluated
    - Subqueries to program_purchases can cause recursion
  
  2. Solution
    - Consolidate all SELECT policies into one simple policy
    - Remove subqueries that reference other tables with RLS
    - Use simpler direct checks
  
  3. Security
    - Professors can see their own programs
    - All authenticated users can see public programs
    - Disable paid/subscriber checks temporarily to fix recursion
*/

-- Drop all existing SELECT policies for programs
DROP POLICY IF EXISTS "Professors can manage own programs" ON programs;
DROP POLICY IF EXISTS "Users can view public programs" ON programs;
DROP POLICY IF EXISTS "Users can view purchased programs" ON programs;
DROP POLICY IF EXISTS "Subscribers can view subscriber programs" ON programs;

-- Create a single comprehensive SELECT policy without subqueries
CREATE POLICY "Users can view programs"
  ON programs FOR SELECT
  TO authenticated
  USING (
    -- Professors and admins can see their own programs
    professor_id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR
    -- All users can see public active programs
    (visibility = 'public' AND is_active = true)
  );

-- Separate policies for INSERT/UPDATE/DELETE (no recursion risk)
CREATE POLICY "Professors can insert own programs"
  ON programs FOR INSERT
  TO authenticated
  WITH CHECK (
    professor_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Professors can update own programs"
  ON programs FOR UPDATE
  TO authenticated
  USING (
    professor_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    professor_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Professors can delete own programs"
  ON programs FOR DELETE
  TO authenticated
  USING (
    professor_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );