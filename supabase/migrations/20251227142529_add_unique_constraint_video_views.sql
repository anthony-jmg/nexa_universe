/*
  # Add Unique Constraint to video_views

  ## Overview
  This migration adds a unique constraint on (user_id, video_id) in video_views
  to ensure each user has only one progress record per video, enabling upsert operations.

  ## Changes
  1. Drop duplicate entries (keep most recent)
  2. Add unique constraint on (user_id, video_id)

  ## Notes
  - Prevents duplicate progress records
  - Enables efficient upsert operations
  - Maintains data integrity
*/

-- Remove duplicates by keeping only the most recent view for each user-video pair
DELETE FROM video_views v1
WHERE v1.id NOT IN (
  SELECT DISTINCT ON (user_id, video_id) id
  FROM video_views
  ORDER BY user_id, video_id, watched_at DESC
);

-- Add unique constraint
ALTER TABLE video_views
DROP CONSTRAINT IF EXISTS video_views_user_video_unique;

ALTER TABLE video_views
ADD CONSTRAINT video_views_user_video_unique UNIQUE (user_id, video_id);