/*
  # Add is_active column to product_types

  1. Changes
    - Add `is_active` boolean column to `product_types` table with default true
    - All existing product types are set to active by default

  2. Notes
    - This column allows admins to deactivate product types without deleting them
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_types' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE product_types ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;
