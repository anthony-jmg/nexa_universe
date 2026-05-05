/*
  # Add order_index to products table

  1. Changes
    - Add `order_index` column (integer, default 0) to `products` table
    - This column is used to control the display order of products in the shop

  2. Notes
    - Non-destructive addition
    - Existing rows will get default value of 0
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE products ADD COLUMN order_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;
