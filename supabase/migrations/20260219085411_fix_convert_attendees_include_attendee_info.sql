/*
  # Fix convert_pending_to_actual_attendees to include attendee info

  ## Problem
  The function was not copying attendee name/email/phone fields from
  pending_event_attendees to event_attendees, causing ticket holder
  information to be lost after payment.

  ## Changes
  - Updated SELECT to include attendee_first_name, attendee_last_name,
    attendee_email, attendee_phone from pending_event_attendees
  - Updated INSERT to write these fields into event_attendees

  ## Affected Tables
  - `pending_event_attendees` (read)
  - `event_attendees` (write)
*/

CREATE OR REPLACE FUNCTION convert_pending_to_actual_attendees(p_order_id uuid)
RETURNS integer AS $$
DECLARE
  pending_record RECORD;
  total_converted integer := 0;
BEGIN
  FOR pending_record IN
    SELECT id, event_id, user_id, event_ticket_type_id, qr_code,
           attendee_first_name, attendee_last_name, attendee_email, attendee_phone
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
      created_at,
      attendee_first_name,
      attendee_last_name,
      attendee_email,
      attendee_phone
    )
    VALUES (
      pending_record.event_id,
      pending_record.user_id,
      pending_record.event_ticket_type_id,
      pending_record.qr_code,
      'not_checked_in',
      now(),
      now(),
      pending_record.attendee_first_name,
      pending_record.attendee_last_name,
      pending_record.attendee_email,
      pending_record.attendee_phone
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
