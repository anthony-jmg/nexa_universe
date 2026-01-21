/*
  # Add Cloudflare Stream Support

  1. Changes
    - Add `cloudflare_video_id` column to `videos` table to store Cloudflare Stream video IDs
    - This allows secure video streaming with signed tokens
    
  2. Notes
    - Nullable column to support gradual migration from existing video URLs
    - Existing videos can continue using video_url field
    - New videos should use cloudflare_video_id for secure streaming
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'cloudflare_video_id'
  ) THEN
    ALTER TABLE videos ADD COLUMN cloudflare_video_id text;
  END IF;
END $$;
