/*
  # Remove professor_only from visibility enums
  
  1. Changes
    - Remove 'professor_only' value from program_visibility enum type
    - Remove 'professor_only' value from video_visibility enum type
    - Update existing data that uses 'professor_only'
  
  2. Technical Details
    - Two separate enums exist: program_visibility and video_visibility
    - program_visibility has 'subscribers_only' as replacement
    - video_visibility does NOT have 'subscribers_only', so we keep it without
    - Update program_templates to replace professor_only with subscribers_only
    - Drop views, triggers, functions, and policies that depend on these columns
    - Create new enums without 'professor_only'
    - Alter columns to use new enum types
    - Drop old enums and rename new ones
    - Recreate policies and views
  
  3. Notes
    - For programs: professor_only → subscribers_only (same semantic meaning)
    - For videos: professor_only → private (fallback, no data uses it anyway)
    - Migration is idempotent using IF EXISTS checks
*/

-- Step 1: Update existing data that uses professor_only
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program_templates' AND column_name = 'program_visibility'
  ) THEN
    UPDATE program_templates SET program_visibility = 'subscribers_only' WHERE program_visibility = 'professor_only';
  END IF;
END $$;

UPDATE programs SET visibility = 'subscribers_only' WHERE visibility = 'professor_only';
-- Videos: no data uses professor_only, but if any exists, set to private
UPDATE videos SET visibility = 'private' WHERE visibility = 'professor_only';

-- Step 2: Drop views that depend on visibility columns
DROP VIEW IF EXISTS video_visibility_conflicts;
DROP VIEW IF EXISTS programs_with_warnings;

-- Step 3: Drop triggers that depend on visibility columns
DROP TRIGGER IF EXISTS trigger_sync_program_videos ON programs;
DROP TRIGGER IF EXISTS trigger_inherit_program_visibility ON videos;
DROP TRIGGER IF EXISTS trigger_prevent_manual_visibility_change ON videos;

-- Drop the functions
DROP FUNCTION IF EXISTS sync_program_videos_visibility();
DROP FUNCTION IF EXISTS inherit_program_visibility();
DROP FUNCTION IF EXISTS prevent_manual_video_visibility_change();

-- Step 4: Drop policies that depend on visibility columns
DROP POLICY IF EXISTS "Simple program access" ON programs;
DROP POLICY IF EXISTS "Simple video access" ON videos;
DROP POLICY IF EXISTS "Anonymous users can view public programs" ON programs;
DROP POLICY IF EXISTS "Anonymous users can view public videos" ON videos;
DROP POLICY IF EXISTS "Anonymous users can view public program videos" ON videos;

-- Step 5: Remove default values temporarily
ALTER TABLE programs ALTER COLUMN visibility DROP DEFAULT;
ALTER TABLE videos ALTER COLUMN visibility DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program_templates' AND column_name = 'program_visibility'
  ) THEN
    ALTER TABLE program_templates ALTER COLUMN program_visibility DROP DEFAULT;
  END IF;
END $$;

-- Step 6: Create new enum types without professor_only

-- Create new program_visibility enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'program_visibility_new') THEN
    CREATE TYPE program_visibility_new AS ENUM ('public', 'platform', 'paid', 'private', 'subscribers_only');
  END IF;
END $$;

-- Create new video_visibility enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_visibility_new') THEN
    CREATE TYPE video_visibility_new AS ENUM ('public', 'platform', 'paid', 'private');
  END IF;
END $$;

-- Step 7: Alter columns to use new enums

-- Programs table
ALTER TABLE programs 
  ALTER COLUMN visibility TYPE program_visibility_new 
  USING visibility::text::program_visibility_new;

-- Videos table
ALTER TABLE videos 
  ALTER COLUMN visibility TYPE video_visibility_new 
  USING visibility::text::video_visibility_new;

-- Program templates if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program_templates' AND column_name = 'program_visibility'
  ) THEN
    EXECUTE 'ALTER TABLE program_templates ALTER COLUMN program_visibility TYPE program_visibility_new USING program_visibility::text::program_visibility_new';
  END IF;
END $$;

-- Step 8: Drop old enums and rename new ones
DROP TYPE IF EXISTS program_visibility;
ALTER TYPE program_visibility_new RENAME TO program_visibility;

DROP TYPE IF EXISTS video_visibility;
ALTER TYPE video_visibility_new RENAME TO video_visibility;

-- Step 9: Restore default values
ALTER TABLE programs ALTER COLUMN visibility SET DEFAULT 'public'::program_visibility;
ALTER TABLE videos ALTER COLUMN visibility SET DEFAULT 'public'::video_visibility;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program_templates' AND column_name = 'program_visibility'
  ) THEN
    ALTER TABLE program_templates ALTER COLUMN program_visibility SET DEFAULT 'public'::program_visibility;
  END IF;
END $$;

-- Step 10: Recreate policies without professor_only

-- Programs policies
CREATE POLICY "Anonymous users can view public programs"
  ON programs FOR SELECT
  TO anon
  USING (visibility = 'public' AND is_active = true);

CREATE POLICY "Simple program access"
  ON programs FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR (visibility = 'platform' AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.platform_subscription_status = 'active'
      AND profiles.platform_subscription_expires_at > now()
    ))
    OR (visibility = 'subscribers_only' AND EXISTS (
      SELECT 1 FROM professor_subscriptions
      WHERE professor_subscriptions.user_id = auth.uid()
      AND professor_subscriptions.professor_id = programs.professor_id
      AND professor_subscriptions.status = 'active'
      AND professor_subscriptions.expires_at > now()
    ))
    OR (visibility = 'paid' AND EXISTS (
      SELECT 1 FROM program_purchases
      WHERE program_purchases.program_id = programs.id
      AND program_purchases.user_id = auth.uid()
      AND program_purchases.status = 'active'
      AND (program_purchases.expires_at IS NULL OR program_purchases.expires_at > now())
    ))
    OR professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Videos policies
CREATE POLICY "Anonymous users can view public videos"
  ON videos FOR SELECT
  TO anon
  USING (visibility = 'public');

CREATE POLICY "Anonymous users can view public program videos"
  ON videos FOR SELECT
  TO anon
  USING (
    program_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = videos.program_id
      AND programs.visibility = 'public'
      AND programs.is_active = true
    )
  );

CREATE POLICY "Simple video access"
  ON videos FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR (visibility = 'platform' AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.platform_subscription_status = 'active'
      AND profiles.platform_subscription_expires_at > now()
    ))
    OR (visibility = 'paid' AND (
      EXISTS (
        SELECT 1 FROM video_purchases
        WHERE video_purchases.video_id = videos.id
        AND video_purchases.user_id = auth.uid()
        AND video_purchases.status = 'active'
      )
      OR (program_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM program_purchases
        WHERE program_purchases.program_id = videos.program_id
        AND program_purchases.user_id = auth.uid()
        AND program_purchases.status = 'active'
        AND (program_purchases.expires_at IS NULL OR program_purchases.expires_at > now())
      ))
    ))
    OR professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Step 11: Recreate views without professor_only references

-- Video visibility conflicts view
CREATE VIEW video_visibility_conflicts AS
SELECT 
  v.id AS video_id,
  v.title AS video_title,
  v.visibility::text AS video_visibility,
  p.id AS program_id,
  p.title AS program_title,
  p.visibility::text AS program_visibility,
  'CONFLICT: Video and program have different visibility' AS issue
FROM videos v
JOIN programs p ON v.program_id = p.id
WHERE v.visibility::text <> p.visibility::text;

-- Programs with warnings view (updated without professor_only)
CREATE VIEW programs_with_warnings AS
SELECT 
  p.id,
  p.title,
  p.visibility,
  p.price,
  (SELECT COUNT(*) FROM videos WHERE videos.program_id = p.id) AS video_count,
  CASE
    WHEN visibility = 'paid' AND price <= 0 THEN 'ERROR: Programme payant sans prix'
    WHEN visibility IN ('public', 'platform', 'private', 'subscribers_only') AND price > 0 THEN 'WARNING: Prix défini pour programme gratuit'
    WHEN (SELECT COUNT(*) FROM videos WHERE videos.program_id = p.id) = 0 THEN 'WARNING: Programme vide'
    WHEN EXISTS (SELECT 1 FROM videos v WHERE v.program_id = p.id AND v.visibility::text <> p.visibility::text) THEN 'ERROR: Incohérence de visibilité avec les vidéos'
    ELSE 'OK'
  END AS status,
  p.professor_id
FROM programs p
WHERE 
  (visibility = 'paid' AND price <= 0)
  OR (SELECT COUNT(*) FROM videos WHERE videos.program_id = p.id) = 0
  OR EXISTS (SELECT 1 FROM videos v WHERE v.program_id = p.id AND v.visibility::text <> p.visibility::text);
