/*
  # Allow multiple tickets per user per event

  ## Problem
  The unique constraint on (event_id, user_id, event_ticket_type_id) prevents
  a user from purchasing multiple tickets for the same event and ticket type.
  This blocks legitimate use cases like buying tickets for other attendees.
  It also caused the convert_pending_to_actual_attendees function to fail
  silently, leaving paid orders without generated tickets.

  ## Changes
  - Drop the unique constraint `event_attendees_event_id_user_id_event_ticket_type_id_key`
  - The `qr_code` unique constraint remains as the proper unique identifier for each ticket

  ## Affected Tables
  - `event_attendees` (constraint dropped)
*/

ALTER TABLE event_attendees
  DROP CONSTRAINT IF EXISTS event_attendees_event_id_user_id_event_ticket_type_id_key;
