/*
  # Fix RLS Infinite Recursion

  1. Problem
    - Circular references between programs and program_purchases policies
    - Policies for videos reference program_purchases which creates recursion
  
  2. Solution
    - Drop all existing policies
    - Recreate simpler, non-recursive policies
    - Professors can always see their own content
    - Users can see content based on direct rules without cross-table checks
  
  3. Security
    - Maintain security by checking ownership directly
    - Check purchases/subscriptions without circular references
*/

-- Drop all existing policies for programs
DROP POLICY IF EXISTS "Users can view active public programs" ON programs;
DROP POLICY IF EXISTS "Users can view accessible programs" ON programs;
DROP POLICY IF EXISTS "Subscribers can view subscriber-only programs" ON programs;
DROP POLICY IF EXISTS "Professors can view own programs" ON programs;
DROP POLICY IF EXISTS "Professors can insert own programs" ON programs;
DROP POLICY IF EXISTS "Professors can update own programs" ON programs;
DROP POLICY IF EXISTS "Professors can delete own programs" ON programs;

-- Drop all existing policies for videos
DROP POLICY IF EXISTS "Users can view videos based on visibility" ON videos;
DROP POLICY IF EXISTS "Videos access by category" ON videos;
DROP POLICY IF EXISTS "Professors can manage own videos" ON videos;

-- Create simple, non-recursive policies for programs
CREATE POLICY "Professors can manage own programs"
  ON programs FOR ALL
  TO authenticated
  USING (
    professor_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Users can view public programs"
  ON programs FOR SELECT
  TO authenticated
  USING (visibility = 'public' AND is_active = true);

CREATE POLICY "Users can view purchased programs"
  ON programs FOR SELECT
  TO authenticated
  USING (
    visibility = 'paid' AND 
    is_active = true AND
    id IN (
      SELECT program_id FROM program_purchases 
      WHERE user_id = auth.uid() 
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

CREATE POLICY "Subscribers can view subscriber programs"
  ON programs FOR SELECT
  TO authenticated
  USING (
    visibility = 'subscribers_only' AND 
    is_active = true AND
    professor_id IN (
      SELECT professor_id FROM professor_subscriptions 
      WHERE user_id = auth.uid() 
      AND status = 'active'
      AND expires_at > now()
    )
  );

-- Create simple, non-recursive policies for videos
CREATE POLICY "Professors can manage own videos"
  ON videos FOR ALL
  TO authenticated
  USING (
    professor_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Users can view free videos"
  ON videos FOR SELECT
  TO authenticated
  USING (category IN ('teaser', 'free'));

CREATE POLICY "Subscribers can view platform videos"
  ON videos FOR SELECT
  TO authenticated
  USING (
    category = 'platform_module' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND platform_subscription_status = 'active'
      AND platform_subscription_expires_at > now()
    )
  );

CREATE POLICY "Users can view program videos"
  ON videos FOR SELECT
  TO authenticated
  USING (
    category = 'program' AND 
    program_id IS NOT NULL AND
    program_id IN (
      SELECT program_id FROM program_purchases 
      WHERE user_id = auth.uid() 
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
    )
  );