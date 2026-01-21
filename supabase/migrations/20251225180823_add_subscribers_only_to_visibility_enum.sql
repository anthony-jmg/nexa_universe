/*
  # Add subscribers_only to visibility enum
  
  1. Changes
    - Add 'subscribers_only' value to program_visibility enum type
    - This allows programs and videos to be restricted to subscribers
  
  2. Notes
    - Uses IF NOT EXISTS pattern to safely add the enum value
    - Existing data is not affected
*/

DO $$
BEGIN
  -- Add subscribers_only to program_visibility enum if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'subscribers_only' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'program_visibility')
  ) THEN
    ALTER TYPE program_visibility ADD VALUE 'subscribers_only';
  END IF;
END $$;
