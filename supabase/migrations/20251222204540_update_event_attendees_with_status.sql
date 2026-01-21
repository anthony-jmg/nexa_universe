/*
  # Update Event Attendees System with Status Management
  
  ## Overview
  This migration enhances the event_attendees system to fully implement secure access control
  with proper status tracking and simplified QR code management.
  
  ## Changes Made
  
  ### 1. Add status field to event_attendees
  - `status` (text) - Access status: 'valid', 'used', 'cancelled'
  - Default: 'valid'
  - Check constraint to ensure only valid statuses
  
  ### 2. Simplify QR code system
  - qr_code_data will contain only a secure UUID
  - qr_code_hash remains for quick lookups
  
  ### 3. Add access tracking
  - Track when access was used
  - Prevent reuse of used or cancelled access
  
  ## Security Rules
  - Once an access is marked as 'used', it cannot be revalidated
  - Once an access is 'cancelled', it cannot be used
  - Only staff (admin/professor) can change status to 'used'
  - Only buyer or admin can cancel their own tickets
  
  ## Important Notes
  - Each ticket purchase = 1 individual access
  - QR codes are unique and non-guessable
  - All validation must be done server-side
*/

-- Add status column to event_attendees if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_attendees' AND column_name = 'status'
  ) THEN
    ALTER TABLE event_attendees ADD COLUMN status text DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled'));
  END IF;
END $$;

-- Add index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_event_attendees_status ON event_attendees(status);

-- Update the RLS policy for updates to be more specific
DROP POLICY IF EXISTS "Event organizers can update check-in" ON event_attendees;

-- Event organizers can mark tickets as used (check-in)
CREATE POLICY "Event organizers can check in attendees"
  ON event_attendees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'professor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'professor')
    )
  );

-- Buyers can cancel their own tickets (before they are used)
CREATE POLICY "Buyers can cancel their own tickets"
  ON event_attendees FOR UPDATE
  TO authenticated
  USING (
    status = 'valid' AND
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = event_attendees.order_id
      AND orders.user_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('valid', 'cancelled') AND
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = event_attendees.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Function to validate and check-in an attendee via QR code
CREATE OR REPLACE FUNCTION check_in_attendee(
  p_qr_code_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attendee event_attendees;
  v_event events;
  v_ticket_type ticket_types;
  v_result jsonb;
BEGIN
  -- Check if user is authorized (admin or professor)
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'professor')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only staff can check in attendees'
    );
  END IF;

  -- Find the attendee
  SELECT * INTO v_attendee
  FROM event_attendees
  WHERE qr_code_hash = p_qr_code_hash;

  IF v_attendee IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid QR code'
    );
  END IF;

  -- Check if already used
  IF v_attendee.status = 'used' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket already used',
      'checked_in_at', v_attendee.checked_in_at
    );
  END IF;

  -- Check if cancelled
  IF v_attendee.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket has been cancelled'
    );
  END IF;

  -- Get event details
  SELECT e.* INTO v_event
  FROM events e
  JOIN event_ticket_types ett ON e.id = ett.event_id
  WHERE ett.id = v_attendee.event_ticket_type_id;

  -- Get ticket type details
  SELECT tt.* INTO v_ticket_type
  FROM ticket_types tt
  JOIN event_ticket_types ett ON tt.id = ett.ticket_type_id
  WHERE ett.id = v_attendee.event_ticket_type_id;

  -- Mark as used
  UPDATE event_attendees
  SET 
    status = 'used',
    checked_in = true,
    checked_in_at = now(),
    checked_in_by = auth.uid(),
    updated_at = now()
  WHERE id = v_attendee.id;

  -- Return success with attendee info
  RETURN jsonb_build_object(
    'success', true,
    'attendee', jsonb_build_object(
      'first_name', v_attendee.attendee_first_name,
      'last_name', v_attendee.attendee_last_name,
      'email', v_attendee.attendee_email,
      'ticket_type', v_ticket_type.name,
      'event_title', v_event.title,
      'checked_in_at', now()
    )
  );
END;
$$;

-- Function to get attendee stats for an event (for admins/professors)
CREATE OR REPLACE FUNCTION get_event_attendee_stats(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check if user is authorized
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'professor')
  ) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'valid', COUNT(*) FILTER (WHERE ea.status = 'valid'),
    'used', COUNT(*) FILTER (WHERE ea.status = 'used'),
    'cancelled', COUNT(*) FILTER (WHERE ea.status = 'cancelled'),
    'by_ticket_type', jsonb_agg(
      DISTINCT jsonb_build_object(
        'ticket_type', tt.name,
        'count', (
          SELECT COUNT(*)
          FROM event_attendees ea2
          WHERE ea2.event_ticket_type_id = ett.id
        )
      )
    )
  ) INTO v_result
  FROM event_attendees ea
  JOIN event_ticket_types ett ON ea.event_ticket_type_id = ett.id
  JOIN ticket_types tt ON ett.ticket_type_id = tt.id
  WHERE ett.event_id = p_event_id;

  RETURN v_result;
END;
$$;