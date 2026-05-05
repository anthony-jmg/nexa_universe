/*
  # Refactor product sizes as a separate table

  ## Summary
  This migration refactors how product sizes and stock are managed:

  1. **product_types** table changes:
     - Remove `sizes` (array of strings) column — sizes are no longer stored on the type
     - Remove `has_sizes` boolean column — no longer needed
     - A product type now only has a name (and is_active, order_index)

  2. **product_sizes** table (new structure):
     - Drop old `product_sizes` table linked to product_types
     - Create new `product_sizes` table linked to **products**
     - Each row: id, product_id (FK to products), name (e.g. "S", "M", "L"), stock_quantity, order_index
     - A product can have multiple sizes, each with its own stock quantity

  3. **products** table changes:
     - Remove `product_size_id` column (old FK to old product_sizes)
     - Remove `stock_quantity` column (stock is now per size; sizeless products can have one "default" size row)

  ## Security
  - RLS enabled on new product_sizes table
  - Admins can manage sizes; authenticated users can read active product sizes
*/

-- Step 1: Drop old product_sizes table if it exists (was linked to product_types)
DROP TABLE IF EXISTS product_sizes CASCADE;

-- Step 2: Remove sizes-related columns from product_types
ALTER TABLE product_types
  DROP COLUMN IF EXISTS sizes,
  DROP COLUMN IF EXISTS has_sizes;

-- Step 3: Remove old columns from products
ALTER TABLE products
  DROP COLUMN IF EXISTS product_size_id,
  DROP COLUMN IF EXISTS stock_quantity;

-- Step 4: Create new product_sizes table (linked to products)
CREATE TABLE IF NOT EXISTS product_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  stock_quantity integer NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_sizes_product_id ON product_sizes(product_id);

-- Step 5: Enable RLS
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage product sizes"
  ON product_sizes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert product sizes"
  ON product_sizes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update product sizes"
  ON product_sizes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete product sizes"
  ON product_sizes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- All authenticated users can read product sizes (for shopping)
CREATE POLICY "Authenticated users can read product sizes"
  ON product_sizes
  FOR SELECT
  TO authenticated
  USING (true);

-- Anonymous users can read product sizes (for browsing)
CREATE POLICY "Anonymous users can read product sizes"
  ON product_sizes
  FOR SELECT
  TO anon
  USING (true);
