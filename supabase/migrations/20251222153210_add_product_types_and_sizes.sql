/*
  # Add Product Types and Sizes Management

  ## Overview
  This migration adds a flexible system for managing product types and their associated sizes.
  Admins can create product types (e.g., T-Shirt, Hoodie, Sticker) and optionally define 
  sizes for types that need them (e.g., S, M, L, XL for clothing).

  ## New Tables

  ### 1. product_types
  Defines the different types of products available in the shop
  - `id` (uuid, PK) - Product type ID
  - `name` (text) - Type name (e.g., "T-Shirt", "Sticker", "Poster")
  - `has_sizes` (boolean) - Whether this type supports different sizes
  - `is_active` (boolean) - Whether this type is available for new products
  - `order_index` (integer) - Display order
  - `created_at` (timestamptz) - Creation date

  ### 2. product_sizes
  Defines available sizes for product types that support them
  - `id` (uuid, PK) - Size ID
  - `product_type_id` (uuid, FK) - Reference to product type
  - `name` (text) - Size name (e.g., "S", "M", "L", "XL", "One Size")
  - `order_index` (integer) - Display order
  - `created_at` (timestamptz) - Creation date

  ## Modified Tables

  ### products
  - Add `product_type_id` (uuid, FK) - Reference to product type
  - Add `product_size_id` (uuid, FK, nullable) - Reference to size if applicable
  - Keep existing `type` field for backward compatibility

  ## Security
  - Enable RLS on all new tables
  - All users can view active product types and sizes
  - Only admins can create, update, or delete types and sizes

  ## Important Notes
  1. Product types are reusable across multiple products
  2. Sizes are optional and only relevant for certain product types
  3. Existing products continue to work with the `type` text field
  4. New products can use the structured type system
*/

-- Create product_types table
CREATE TABLE IF NOT EXISTS product_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  has_sizes boolean DEFAULT false,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;

-- Create product_sizes table
CREATE TABLE IF NOT EXISTS product_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id uuid NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_type_id, name)
);

ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;

-- Add columns to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'product_type_id'
  ) THEN
    ALTER TABLE products ADD COLUMN product_type_id uuid REFERENCES product_types(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'product_size_id'
  ) THEN
    ALTER TABLE products ADD COLUMN product_size_id uuid REFERENCES product_sizes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS Policies for product_types

CREATE POLICY "Anyone can view active product types"
  ON product_types FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all product types"
  ON product_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create product types"
  ON product_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update product types"
  ON product_types FOR UPDATE
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

CREATE POLICY "Admins can delete product types"
  ON product_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for product_sizes

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

-- Insert some default product types
INSERT INTO product_types (name, has_sizes, order_index) VALUES
  ('T-Shirt', true, 1),
  ('Hoodie', true, 2),
  ('Cap', false, 3),
  ('Sticker', false, 4),
  ('Poster', false, 5)
ON CONFLICT (name) DO NOTHING;

-- Insert default sizes for clothing items
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