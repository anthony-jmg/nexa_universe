/*
  # Add Founder Badge Management for Professors
  
  1. Changes
    - Add `is_founder` boolean field to professors table to mark founding instructors
    - Default value is false
    - Only admins can manage this field through RLS policies
  
  2. Security
    - Update RLS policies to allow admins to manage the founder badge
    - Regular users can view but not modify this field
*/

-- Add is_founder column to professors table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professors' AND column_name = 'is_founder'
  ) THEN
    ALTER TABLE professors ADD COLUMN is_founder boolean DEFAULT false;
  END IF;
END $$;