/*
  # Add attendee name fields to event_attendees

  ## Changes
  - Adds `attendee_first_name` (text, nullable) to store the first name of the ticket holder
  - Adds `attendee_last_name` (text, nullable) to store the last name of the ticket holder
  - Adds `attendee_email` (text, nullable) to store the email of the ticket holder
  - Adds `attendee_phone` (text, nullable) to store the phone of the ticket holder

  ## Notes
  - All fields are nullable to maintain backwards compatibility with existing records
  - These fields make tickets nominative (named tickets)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_attendees' AND column_name = 'attendee_first_name'
  ) THEN
    ALTER TABLE event_attendees ADD COLUMN attendee_first_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_attendees' AND column_name = 'attendee_last_name'
  ) THEN
    ALTER TABLE event_attendees ADD COLUMN attendee_last_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_attendees' AND column_name = 'attendee_email'
  ) THEN
    ALTER TABLE event_attendees ADD COLUMN attendee_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_attendees' AND column_name = 'attendee_phone'
  ) THEN
    ALTER TABLE event_attendees ADD COLUMN attendee_phone text;
  END IF;
END $$;
