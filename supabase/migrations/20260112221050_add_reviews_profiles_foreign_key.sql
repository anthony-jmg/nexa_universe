/*
  # Add Foreign Key Relationship Between Reviews and Profiles

  1. Changes
    - Drop existing foreign key from reviews.user_id to auth.users
    - Add new foreign key from reviews.user_id to profiles.id
    - This allows queries to join reviews with profiles table for user information
  
  2. Security
    - No changes to RLS policies
    - Maintains data integrity with CASCADE delete
*/

-- Drop the existing foreign key to auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'reviews_user_id_fkey' 
    AND table_name = 'reviews'
  ) THEN
    ALTER TABLE reviews DROP CONSTRAINT reviews_user_id_fkey;
  END IF;
END $$;

-- Add foreign key to profiles table instead
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'reviews_user_id_fkey' 
    AND table_name = 'reviews'
  ) THEN
    ALTER TABLE reviews 
    ADD CONSTRAINT reviews_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;
  END IF;
END $$;
