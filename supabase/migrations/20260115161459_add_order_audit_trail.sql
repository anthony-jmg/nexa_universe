/*
  # Add Order Audit Trail System

  This migration creates a comprehensive audit trail for order status changes.
  Every time an order status changes, a record is automatically created.

  ## New Table: `order_status_history`

  Tracks all status changes for orders with full context.
  - `id` (uuid, primary key) - Unique history record identifier
  - `order_id` (uuid, NOT NULL) - Foreign key to orders
  - `old_status` (text) - Previous order status
  - `new_status` (text, NOT NULL) - New order status
  - `changed_by` (uuid) - User who made the change (can be null for system changes)
  - `reason` (text) - Optional reason for the change
  - `metadata` (jsonb) - Additional context (payment info, tracking number, etc.)
  - `created_at` (timestamptz) - When the change occurred

  ## Automatic Trigger

  A trigger automatically logs status changes whenever an order is updated.
  No manual intervention needed - it just works.

  ## Security
  - RLS enabled
  - Users can view history for their own orders
  - Admins can view all history

  ## Benefits
  1. Full audit trail for compliance
  2. Debug payment issues
  3. Track order processing times
  4. Customer support insights
  5. Analytics on conversion rates

  ## Important Notes
  - History is immutable (no updates or deletes)
  - Trigger runs automatically on every order update
  - Captures auth.uid() as changed_by when available
  - System changes (webhooks) will have null changed_by
*/

-- ============================================================================
-- TABLE: order_status_history
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_by ON order_status_history(changed_by) WHERE changed_by IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order history"
  ON order_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_history.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all order history"
  ON order_status_history
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
-- TRIGGER FUNCTION: Automatically log status changes
-- ============================================================================

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (
      order_id,
      old_status,
      new_status,
      changed_by,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      jsonb_build_object(
        'stripe_payment_intent_id', NEW.stripe_payment_intent_id,
        'total_amount', NEW.total_amount,
        'is_member_order', NEW.is_member_order
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_order_status_change() IS
  'Automatically logs order status changes to order_status_history table. Triggered on every order update.';

-- ============================================================================
-- TRIGGER: Auto-log status changes
-- ============================================================================

DROP TRIGGER IF EXISTS order_status_change_trigger ON orders;
CREATE TRIGGER order_status_change_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- ============================================================================
-- HELPER FUNCTION: Get order timeline
-- ============================================================================

CREATE OR REPLACE FUNCTION get_order_timeline(p_order_id uuid)
RETURNS TABLE (
  event_time timestamptz,
  old_status text,
  new_status text,
  changed_by_email text,
  reason text,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.created_at as event_time,
    h.old_status,
    h.new_status,
    p.email as changed_by_email,
    h.reason,
    h.metadata
  FROM order_status_history h
  LEFT JOIN profiles p ON p.id = h.changed_by
  WHERE h.order_id = p_order_id
  ORDER BY h.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_order_timeline(uuid) IS
  'Returns the complete timeline of status changes for an order with user emails.';
