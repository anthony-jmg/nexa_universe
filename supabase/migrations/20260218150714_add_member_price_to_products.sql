/*
  # Add member_price to products table

  1. Modified Tables
    - `products`
      - `member_price` (numeric) - Discounted price for platform members, defaults to 0
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'member_price'
  ) THEN
    ALTER TABLE products ADD COLUMN member_price numeric DEFAULT 0;
  END IF;
END $$;
