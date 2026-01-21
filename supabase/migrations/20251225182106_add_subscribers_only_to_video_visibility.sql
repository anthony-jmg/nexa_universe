/*
  # Add subscribers_only to video_visibility enum
  
  1. Changes
    - Add 'subscribers_only' value to video_visibility enum type
    - This allows videos to be restricted to professor subscribers
    - Maintains consistency with program_visibility enum
  
  2. Notes
    - Safe to add as it doesn't affect existing data
    - Videos can now have the same visibility options as programs (except platform which is program-specific)
*/

-- Add subscribers_only to video_visibility enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'subscribers_only' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'video_visibility')
  ) THEN
    ALTER TYPE video_visibility ADD VALUE 'subscribers_only';
  END IF;
END $$;
