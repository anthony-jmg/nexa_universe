/*
  # Add attendee info to pending_event_attendees

  ## Problem
  When users complete checkout via Stripe, the webhook calls convert_pending_to_actual_attendees
  which creates event_attendees records without attendee names (NULL). The attendee names were
  only available in the frontend localStorage, causing them to be lost.

  ## Changes
  1. Add attendee name/email/phone fields to pending_event_attendees table
  2. Update convert_pending_to_actual_attendees to copy these fields when creating event_attendees
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_event_attendees' AND column_name = 'attendee_first_name'
  ) THEN
    ALTER TABLE pending_event_attendees ADD COLUMN attendee_first_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_event_attendees' AND column_name = 'attendee_last_name'
  ) THEN
    ALTER TABLE pending_event_attendees ADD COLUMN attendee_last_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_event_attendees' AND column_name = 'attendee_email'
  ) THEN
    ALTER TABLE pending_event_attendees ADD COLUMN attendee_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_event_attendees' AND column_name = 'attendee_phone'
  ) THEN
    ALTER TABLE pending_event_attendees ADD COLUMN attendee_phone text;
  END IF;
END $$;

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
