/*
  # Add 'upcoming' status to events table

  ## Changes
  - Adds 'upcoming' as a valid value for the event_status CHECK constraint on the events table
  - This allows admins to mark events as "coming soon" — visible to the public but without
    purchasable tickets, showing only a description and a "Coming Soon" banner

  ## Notes
  - The existing CHECK constraint must be dropped and recreated to add the new value
  - No data is modified; only the constraint definition changes
*/

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_status_check;

ALTER TABLE events
  ADD CONSTRAINT events_event_status_check
  CHECK (event_status IN ('draft', 'published', 'cancelled', 'completed', 'upcoming'));
