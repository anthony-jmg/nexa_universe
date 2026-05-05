/*
  # Add order_index to product_types table

  1. Changes
    - Add `order_index` column (integer, default 0) to `product_types` table
    - This allows ordering product types in the admin interface

  2. Notes
    - Non-destructive addition
    - Existing rows will get default value of 0
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_types' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE product_types ADD COLUMN order_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;
