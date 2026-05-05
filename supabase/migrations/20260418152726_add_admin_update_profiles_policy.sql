
/*
  # Add admin policy to update any profile

  ## Problem
  The current UPDATE policy on profiles only allows users to update their own profile.
  Admins need to be able to update any user's profile (e.g., changing role from student to professor).

  ## Changes
  - Add a new UPDATE policy allowing admins to update any profile
*/

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
