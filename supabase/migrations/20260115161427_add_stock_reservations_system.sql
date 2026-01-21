/*
  # Add Stock Reservations System

  This migration creates a stock reservation system to prevent overselling.
  When a customer starts checkout, stock is temporarily reserved for 30 minutes.

  ## New Table: `stock_reservations`

  Tracks temporary stock reservations during checkout process.
  - `id` (uuid, primary key) - Unique reservation identifier
  - `product_id` (uuid, NOT NULL) - Foreign key to products
  - `order_id` (uuid, NOT NULL) - Foreign key to orders
  - `quantity` (integer, NOT NULL) - Number of items reserved
  - `expires_at` (timestamptz, NOT NULL) - When reservation expires (30 minutes default)
  - `created_at` (timestamptz) - When reservation was created

  ## Functions

  ### `reserve_stock(p_product_id, p_order_id, p_quantity)`
  Attempts to reserve stock for an order. Returns true if successful, false if insufficient stock.
  Checks available stock = actual stock - active reservations.

  ### `release_stock_reservation(p_order_id)`
  Releases all stock reservations for an order (when order is paid or cancelled).

  ### `get_available_stock(p_product_id)`
  Returns the actual available stock for a product (stock - active reservations).

  ### `cleanup_expired_reservations()`
  Removes expired reservations. Should be called periodically.

  ## Security
  - RLS enabled on stock_reservations
  - Only authenticated users can view their own reservations
  - Admins can view all reservations

  ## Important Notes
  1. Reservations expire after 30 minutes
  2. When an order is paid, reservation should be released and actual stock decremented
  3. When an order is cancelled, reservation should be released
  4. Cleanup function should run periodically to remove expired reservations
*/

-- ============================================================================
-- TABLE: stock_reservations
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_id ON stock_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order_id ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires_at ON stock_reservations(expires_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stock reservations"
  ON stock_reservations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = stock_reservations.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all stock reservations"
  ON stock_reservations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- FUNCTION: Get available stock for a product
-- ============================================================================

CREATE OR REPLACE FUNCTION get_available_stock(p_product_id uuid)
RETURNS integer AS $$
DECLARE
  v_stock integer;
  v_reserved integer;
BEGIN
  SELECT stock INTO v_stock
  FROM products
  WHERE id = p_product_id;

  IF v_stock < 0 THEN
    RETURN 999999;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
  FROM stock_reservations
  WHERE product_id = p_product_id
    AND expires_at > now();

  RETURN GREATEST(v_stock - v_reserved, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_available_stock(uuid) IS
  'Returns the available stock for a product (actual stock minus active reservations). Returns 999999 for unlimited stock (stock = -1).';

-- ============================================================================
-- FUNCTION: Reserve stock for an order
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id uuid,
  p_order_id uuid,
  p_quantity integer
)
RETURNS boolean AS $$
DECLARE
  v_available integer;
BEGIN
  v_available := get_available_stock(p_product_id);

  IF v_available >= p_quantity THEN
    INSERT INTO stock_reservations (product_id, order_id, quantity)
    VALUES (p_product_id, p_order_id, p_quantity);
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reserve_stock(uuid, uuid, integer) IS
  'Reserves stock for a product in an order. Returns true if successful, false if insufficient stock.';

-- ============================================================================
-- FUNCTION: Release stock reservation for an order
-- ============================================================================

CREATE OR REPLACE FUNCTION release_stock_reservation(p_order_id uuid)
RETURNS integer AS $$
DECLARE
  affected_count integer;
BEGIN
  DELETE FROM stock_reservations
  WHERE order_id = p_order_id;

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION release_stock_reservation(uuid) IS
  'Releases all stock reservations for an order. Returns the number of reservations released.';

-- ============================================================================
-- FUNCTION: Cleanup expired reservations
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS integer AS $$
DECLARE
  affected_count integer;
BEGIN
  DELETE FROM stock_reservations
  WHERE expires_at < now();

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_reservations() IS
  'Removes expired stock reservations. Should be called periodically by a cron job.';
