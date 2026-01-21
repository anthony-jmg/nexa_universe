/*
  # Migrate video_progress to video_views

  ## Overview
  This migration consolidates video tracking by:
  - Migrating existing data from video_progress to video_views
  - Dropping the video_progress table
  - Using video_views as the single source of truth for video progress

  ## Changes
  1. Migrate data from video_progress to video_views
     - Copy progress_percentage, completed, user_id, video_id
     - Set last_position_seconds to 0 (unknown)
  2. Drop video_progress table
  3. Update any references

  ## Notes
  - video_views is more comprehensive with progress tracking
  - This consolidation simplifies the schema
*/

-- Check if video_progress table exists before migrating
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_progress') THEN
    -- Migrate data from video_progress to video_views (if not already present)
    INSERT INTO video_views (
      user_id,
      video_id,
      progress_percentage,
      last_position_seconds,
      completed,
      watched_at,
      created_at
    )
    SELECT DISTINCT ON (vp.user_id, vp.video_id)
      vp.user_id,
      vp.video_id,
      vp.progress_percentage::decimal(5,2),
      0,
      vp.completed,
      vp.last_watched_at,
      vp.created_at
    FROM video_progress vp
    WHERE NOT EXISTS (
      SELECT 1 FROM video_views vv
      WHERE vv.user_id = vp.user_id
      AND vv.video_id = vp.video_id
    )
    ORDER BY vp.user_id, vp.video_id, vp.updated_at DESC;

    -- Drop video_progress table
    DROP TABLE IF EXISTS video_progress CASCADE;
  END IF;
END $$;