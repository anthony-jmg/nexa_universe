/*
  # Add status column to video_purchases

  1. Changes
    - Add `status` column to `video_purchases` table
    - Status can be 'active', 'refunded', or 'expired'
    - Default value is 'active'

  2. Security
    - Existing RLS policies remain unchanged
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_purchases' AND column_name = 'status'
  ) THEN
    ALTER TABLE video_purchases 
    ADD COLUMN status text DEFAULT 'active' 
    CHECK (status IN ('active', 'refunded', 'expired'));
  END IF;
END $$;
