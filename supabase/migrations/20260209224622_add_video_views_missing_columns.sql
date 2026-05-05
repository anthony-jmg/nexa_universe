/*
  # Add missing columns to video_views table

  1. Modified Tables
    - `video_views`
      - Added `last_position_seconds` (integer, default 0) - tracks playback position for resume functionality
      - Added `watch_duration_seconds` (integer, default 0) - tracks total watch time
  
  2. Notes
    - These columns are required for video progress tracking and resume-from-last-position feature
    - Uses IF NOT EXISTS to prevent errors if columns already exist
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_views' AND column_name = 'last_position_seconds'
  ) THEN
    ALTER TABLE video_views ADD COLUMN last_position_seconds integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_views' AND column_name = 'watch_duration_seconds'
  ) THEN
    ALTER TABLE video_views ADD COLUMN watch_duration_seconds integer DEFAULT 0;
  END IF;
END $$;