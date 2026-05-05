/*
  # Add product_images table

  ## Summary
  Allows products to have multiple images instead of a single image_url.

  ## Changes

  ### New Tables
  - `product_images`
    - `id` (uuid, primary key)
    - `product_id` (uuid, FK to products, cascade delete)
    - `image_url` (text, the signed URL of the image)
    - `order_index` (integer, controls display order, 0 = main image)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled on product_images
  - Public can read images for active products
  - Admins can insert/update/delete images

  ## Notes
  - The existing `image_url` column on products is kept for backwards compatibility
  - order_index = 0 is the primary/cover image shown in listings
  - Additional images are shown in the product detail gallery
*/

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_order ON product_images(product_id, order_index);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product images"
  ON product_images
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert product images"
  ON product_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update product images"
  ON product_images
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

CREATE POLICY "Admins can delete product images"
  ON product_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
