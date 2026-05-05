/*
  # Add product_sizes table and product_size_id column

  ## Changes
  - Creates `product_sizes` table (was missing from database)
  - Adds `product_size_id` column to `products` table
  - Enables RLS on product_sizes table
  - Adds RLS policies for product_sizes
  - Seeds default sizes for T-Shirt and Hoodie types
  - Adds performance index on the foreign key
*/

CREATE TABLE IF NOT EXISTS product_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id uuid NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_type_id, name)
);

ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product sizes"
  ON product_sizes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM product_types
      WHERE product_types.id = product_sizes.product_type_id
      AND product_types.is_active = true
    )
  );

CREATE POLICY "Admins can view all product sizes"
  ON product_sizes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create product sizes"
  ON product_sizes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update product sizes"
  ON product_sizes FOR UPDATE
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
  ON product_sizes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'product_size_id'
  ) THEN
    ALTER TABLE products ADD COLUMN product_size_id uuid REFERENCES product_sizes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_product_size_id_fk ON products(product_size_id);

DO $$
DECLARE
  tshirt_id uuid;
  hoodie_id uuid;
BEGIN
  SELECT id INTO tshirt_id FROM product_types WHERE name = 'T-Shirt';
  SELECT id INTO hoodie_id FROM product_types WHERE name = 'Hoodie';

  IF tshirt_id IS NOT NULL THEN
    INSERT INTO product_sizes (product_type_id, name, order_index) VALUES
      (tshirt_id, 'XS', 1),
      (tshirt_id, 'S', 2),
      (tshirt_id, 'M', 3),
      (tshirt_id, 'L', 4),
      (tshirt_id, 'XL', 5),
      (tshirt_id, 'XXL', 6)
    ON CONFLICT (product_type_id, name) DO NOTHING;
  END IF;

  IF hoodie_id IS NOT NULL THEN
    INSERT INTO product_sizes (product_type_id, name, order_index) VALUES
      (hoodie_id, 'XS', 1),
      (hoodie_id, 'S', 2),
      (hoodie_id, 'M', 3),
      (hoodie_id, 'L', 4),
      (hoodie_id, 'XL', 5),
      (hoodie_id, 'XXL', 6)
    ON CONFLICT (product_type_id, name) DO NOTHING;
  END IF;
END $$;
