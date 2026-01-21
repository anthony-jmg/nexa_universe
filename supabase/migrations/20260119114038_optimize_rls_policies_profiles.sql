/*
  # Optimize RLS Policies - Profiles Table

  This migration optimizes RLS policies on the profiles table by replacing direct 
  `auth.uid()` calls with `(select auth.uid())` to prevent re-evaluation for each row.

  ## Policies Optimized
  
  - Users can update own profile
  - Users can insert own profile

  ## Performance Impact
  
  By using subqueries, the auth function is evaluated once per query instead of once
  per row, dramatically improving performance for large result sets.
*/

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));