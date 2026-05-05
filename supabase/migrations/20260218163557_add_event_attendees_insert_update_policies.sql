/*
  # Add INSERT and UPDATE policies for event_attendees

  Currently users can only SELECT their own attendance records.
  This adds policies so users can:
  1. Insert their own attendance records (for direct ticket purchase flows)
  2. Update their own attendance records (e.g. cancel a ticket)

  ## Security
  - INSERT: users can only create records where user_id matches their own auth.uid()
  - UPDATE: users can only update their own records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_attendees'
    AND policyname = 'Users can insert own attendance'
  ) THEN
    CREATE POLICY "Users can insert own attendance"
      ON event_attendees
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_attendees'
    AND policyname = 'Users can update own attendance'
  ) THEN
    CREATE POLICY "Users can update own attendance"
      ON event_attendees
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
