/*
  # Add Video Progress Percentage Tracking

  ## Overview
  This migration adds a progress_percentage column to the video_views table
  to track how far a user has watched in each video. This enables:
  - Resume playback from where user left off
  - Visual progress indicators on video cards
  - Better completion tracking

  ## Changes
  1. Add progress_percentage column to video_views
     - Stores percentage (0-100) of video watched
     - Defaults to 0
  2. Add last_position_seconds column
     - Stores the exact second where user stopped
     - Helps resume playback precisely

  ## Notes
  - Progress is updated as user watches video
  - Allows users to resume from last position
  - Completed flag is set when progress reaches 95%+
*/

-- Add progress tracking columns to video_views
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_views' AND column_name = 'progress_percentage'
  ) THEN
    ALTER TABLE video_views ADD COLUMN progress_percentage decimal(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_views' AND column_name = 'last_position_seconds'
  ) THEN
    ALTER TABLE video_views ADD COLUMN last_position_seconds integer DEFAULT 0;
  END IF;
END $$;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_video_views_user_video ON video_views(user_id, video_id);

-- Add policy to allow users to update their own video views
DROP POLICY IF EXISTS "Users can update own video views" ON video_views;
CREATE POLICY "Users can update own video views"
  ON video_views FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);