/*
  # Fix events RLS policy to include upcoming status

  ## Problem
  The existing SELECT policy on the events table only allows viewing events with
  event_status = 'published'. Events with event_status = 'upcoming' are blocked
  by RLS, making them invisible to users even though they are active.

  ## Changes
  - Drop the existing "Anyone can view published events" policy
  - Create a new policy that allows viewing events with status 'published' OR 'upcoming'
    as long as is_active = true
*/

DROP POLICY IF EXISTS "Anyone can view published events" ON events;

CREATE POLICY "Anyone can view published or upcoming events"
  ON events
  FOR SELECT
  USING (
    (event_status IN ('published', 'upcoming')) AND (is_active = true)
  );
