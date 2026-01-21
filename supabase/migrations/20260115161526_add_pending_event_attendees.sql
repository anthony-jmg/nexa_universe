/*
  # Add Pending Event Attendees System

  This migration creates a system to store pending event ticket information
  in the database instead of localStorage, preventing data loss.

  ## New Table: `pending_event_attendees`

  Stores event ticket information linked to pending orders.
  When payment succeeds, these are converted to actual event_attendees records.
  - `id` (uuid, primary key) - Unique record identifier
  - `order_id` (uuid, NOT NULL) - Foreign key to orders
  - `event_ticket_type_id` (uuid, NOT NULL) - Foreign key to event_ticket_types
  - `quantity` (integer, NOT NULL) - Number of tickets
  - `created_at` (timestamptz) - When tickets were added to cart

  ## Workflow

  1. User adds event tickets to cart → Creates pending_event_attendees record
  2. User starts checkout → Order created with pending status
  3. User completes payment → Webhook converts pending → actual event_attendees
  4. User abandons → Order expires → Pending records auto-deleted (CASCADE)

  ## Security
  - RLS enabled
  - Users can only view/modify their own pending tickets
  - Admins can view all

  ## Important Notes
  1. Replaces localStorage approach (more reliable)
  2. Survives page refresh, browser close, multi-device
  3. Auto-cleanup via CASCADE when order is deleted
  4. No data loss if user closes browser during checkout
*/

-- ============================================================================
-- TABLE: pending_event_attendees
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_ticket_type_id uuid NOT NULL REFERENCES event_ticket_types(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pending_event_attendees_order_id ON pending_event_attendees(order_id);
CREATE INDEX IF NOT EXISTS idx_pending_event_attendees_event_ticket_type_id ON pending_event_attendees(event_ticket_type_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE pending_event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pending event attendees"
  ON pending_event_attendees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = pending_event_attendees.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own pending event attendees"
  ON pending_event_attendees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = pending_event_attendees.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own pending event attendees"
  ON pending_event_attendees
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = pending_event_attendees.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all pending event attendees"
  ON pending_event_attendees
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
-- FUNCTION: Convert pending attendees to actual attendees
-- ============================================================================

CREATE OR REPLACE FUNCTION convert_pending_to_actual_attendees(p_order_id uuid)
RETURNS integer AS $$
DECLARE
  pending_record RECORD;
  total_converted integer := 0;
  i integer;
BEGIN
  FOR pending_record IN
    SELECT event_ticket_type_id, quantity
    FROM pending_event_attendees
    WHERE order_id = p_order_id
  LOOP
    FOR i IN 1..pending_record.quantity LOOP
      INSERT INTO event_attendees (
        order_id,
        event_ticket_type_id,
        attendee_first_name,
        attendee_last_name,
        attendee_email,
        attendee_phone,
        qr_code_data,
        qr_code_hash,
        status
      )
      SELECT
        p_order_id,
        pending_record.event_ticket_type_id,
        '',
        '',
        o.shipping_email,
        o.shipping_phone,
        gen_random_uuid()::text,
        encode(sha256(gen_random_uuid()::text::bytea), 'hex'),
        'valid'
      FROM orders o
      WHERE o.id = p_order_id;

      total_converted := total_converted + 1;
    END LOOP;
  END LOOP;

  DELETE FROM pending_event_attendees WHERE order_id = p_order_id;

  RETURN total_converted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION convert_pending_to_actual_attendees(uuid) IS
  'Converts pending event attendees to actual attendees after payment. Returns number of tickets created.';
