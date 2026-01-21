/*
  # Fix Orders System - Add Missing Features

  This migration adds missing columns, constraints, indexes, and security features
  to the existing orders and order_items tables.

  ## Changes to `orders` table
  1. Add `expires_at` column for auto-expiration of pending orders
  2. Add constraints for data integrity
  3. Add indexes for performance
  4. Add cleanup function for expired orders

  ## Changes to `order_items` table
  1. Add missing indexes
  2. Ensure proper constraints

  ## Security
  1. Ensure RLS is properly configured
  2. Add missing policies

  ## Important Notes
  - This migration is idempotent (safe to run multiple times)
  - Existing data is preserved
  - New columns have sensible defaults
*/

-- ============================================================================
-- Add missing column to orders table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '24 hours');
  END IF;
END $$;

-- ============================================================================
-- Set NOT NULL constraints where appropriate (for new orders only)
-- ============================================================================

DO $$
BEGIN
  -- Set default for user_id if NULL (shouldn't happen, but just in case)
  UPDATE orders SET user_id = '00000000-0000-0000-0000-000000000000'::uuid
  WHERE user_id IS NULL;

  -- Now we can safely set NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- Add UNIQUE constraint on stripe_payment_intent_id if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_stripe_payment_intent_id_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_stripe_payment_intent_id_key
      UNIQUE (stripe_payment_intent_id);
  END IF;
END $$;

-- ============================================================================
-- Add CHECK constraints if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_total_amount_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_total_amount_check
      CHECK (total_amount >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_quantity_check'
  ) THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_check
      CHECK (quantity > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_unit_price_check'
  ) THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_unit_price_check
      CHECK (unit_price >= 0);
  END IF;
END $$;

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id) WHERE product_id IS NOT NULL;

-- ============================================================================
-- Ensure RLS is enabled
-- ============================================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Drop existing policies to recreate them (idempotent)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Users can update own pending orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update any order" ON orders;

DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;

-- ============================================================================
-- Create RLS policies for orders
-- ============================================================================

CREATE POLICY "Users can view own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update any order"
  ON orders
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

-- ============================================================================
-- Create RLS policies for order_items
-- ============================================================================

CREATE POLICY "Users can view own order items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own order items"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all order items"
  ON order_items
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
-- Create or replace trigger function for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- ============================================================================
-- Create function to cleanup expired orders
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_orders()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE orders
  SET
    status = 'cancelled',
    notes = COALESCE(notes || E'\n\n', '') || '[Auto-cancelled: Order expired after 24 hours without payment]',
    updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_orders() IS
  'Automatically cancels orders that have been pending for more than 24 hours. Returns the number of orders cancelled.';
