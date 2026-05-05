/*
  # Fix convert_pending_to_actual_attendees function

  The original function referenced columns that don't exist on the actual
  event_attendees table. This creates a corrected version that:

  1. Reads from pending_event_attendees (using reservation_id as order_id)
  2. Inserts into event_attendees with the correct columns:
     - event_id, user_id, event_ticket_type_id, qr_code, check_in_status
  3. Updates quantity_sold on event_ticket_types
  4. Deletes processed pending records

  ## Changes
  - Drops old broken function if exists
  - Creates corrected function matching actual table schemas
*/

CREATE OR REPLACE FUNCTION convert_pending_to_actual_attendees(p_order_id uuid)
RETURNS integer AS $$
DECLARE
  pending_record RECORD;
  total_converted integer := 0;
BEGIN
  FOR pending_record IN
    SELECT id, event_id, user_id, event_ticket_type_id, qr_code
    FROM pending_event_attendees
    WHERE reservation_id = p_order_id
  LOOP
    INSERT INTO event_attendees (
      event_id,
      user_id,
      event_ticket_type_id,
      qr_code,
      check_in_status,
      purchased_at,
      created_at
    )
    VALUES (
      pending_record.event_id,
      pending_record.user_id,
      pending_record.event_ticket_type_id,
      pending_record.qr_code,
      'not_checked_in',
      now(),
      now()
    );

    UPDATE event_ticket_types
    SET quantity_sold = quantity_sold + 1
    WHERE id = pending_record.event_ticket_type_id;

    total_converted := total_converted + 1;
  END LOOP;

  DELETE FROM pending_event_attendees WHERE reservation_id = p_order_id;

  RETURN total_converted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION convert_pending_to_actual_attendees(uuid) IS
  'Converts pending event attendees to actual attendees after payment. Returns number of tickets created.';
