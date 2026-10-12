/*
# Official PDF Pass system for event attendees

1. New columns on `event_attendees` (additive only, no data loss):
   - `pass_status` (text, NOT NULL, default 'pending') — PDF pass lifecycle: 'pending' (purchase confirmed, official PDF not yet imported by admin) or 'available' (PDF imported, user can open it).
   - `pass_file_path` (text, nullable) — path of the PDF inside the private `event-passes` storage bucket. Never a public URL.
   - `pass_uploaded_at` (timestamptz, nullable) — when the admin imported the PDF.
   - `pass_reference` (text, nullable) — optional external reference for the official pass.
   All existing rows automatically get `pass_status = 'pending'` via the default; no historical data is touched.

2. Security changes:
   - New PRIVATE storage bucket `event-passes` (no public access, no anonymous reads).
   - Storage policies: an authenticated user may only read files whose path starts with their own user id; admins (profiles.role = 'admin') can read/write all pass files.
   - New UPDATE policy on `event_attendees` allowing admins to manage pass metadata.
   - New trigger `trg_enforce_pass_columns_admin_only`: a regular user can still update their own attendee row (e.g. cancel a ticket) but can NEVER change the pass columns — only admins can.
   - Backfill is implicit: every existing attendee becomes pass_status = 'pending'.

3. Notification:
   - New allowed notification type `pass_available`.
   - New trigger `trg_notify_pass_available`: when an attendee's pass becomes 'available', a notification "Ton pass est disponible sur Nexa." is inserted for the buyer (reuses the existing notifications system).

4. Price Lock / payment logic unchanged: `awaiting_balance` attendees keep pass_status 'pending' and get no pass access (frontend hides the pass until they are confirmed).
*/

-- 1. Additive columns
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS pass_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pass_file_path text,
  ADD COLUMN IF NOT EXISTS pass_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS pass_reference text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_attendees_pass_status_check') THEN
    ALTER TABLE event_attendees
      ADD CONSTRAINT event_attendees_pass_status_check
      CHECK (pass_status IN ('pending', 'available'));
  END IF;
END $$;

-- 2. Private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-passes', 'event-passes', false)
ON CONFLICT (id) DO NOTHING;

-- Owner can read only files stored under their own user-id folder ({user_id}/...)
DROP POLICY IF EXISTS "Users read own event passes" ON storage.objects;
CREATE POLICY "Users read own event passes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'event-passes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins manage all pass files (import, replace, view)
DROP POLICY IF EXISTS "Admins manage event passes" ON storage.objects;
CREATE POLICY "Admins manage event passes"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'event-passes'
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
)
WITH CHECK (
  bucket_id = 'event-passes'
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Admins can update pass metadata on event_attendees
DROP POLICY IF EXISTS "Admins manage event pass files" ON event_attendees;
CREATE POLICY "Admins manage event pass files"
ON event_attendees FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Guard: non-admin users must not alter pass columns through their own update policy
CREATE OR REPLACE FUNCTION enforce_pass_columns_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF NEW.pass_status IS DISTINCT FROM OLD.pass_status
     OR NEW.pass_file_path IS DISTINCT FROM OLD.pass_file_path
     OR NEW.pass_uploaded_at IS DISTINCT FROM OLD.pass_uploaded_at
     OR NEW.pass_reference IS DISTINCT FROM OLD.pass_reference THEN
    SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = auth.uid();
    IF NOT COALESCE(v_is_admin, false) THEN
      RAISE EXCEPTION 'Seul un administrateur peut modifier le pass.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_pass_columns_admin_only ON event_attendees;
CREATE TRIGGER trg_enforce_pass_columns_admin_only
AFTER UPDATE ON event_attendees
FOR EACH ROW EXECUTE FUNCTION enforce_pass_columns_admin_only();

-- 3. Notification type + trigger (reuses existing notifications system)
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
CHECK (type = ANY (ARRAY[
  'new_video'::text, 'new_program'::text,
  'platform_subscription_expiring'::text, 'professor_subscription_expiring'::text,
  'platform_subscription_expired'::text, 'professor_subscription_expired'::text,
  'order_paid'::text, 'order_processing'::text, 'order_shipped'::text,
  'order_completed'::text, 'order_cancelled'::text,
  'professor_approved'::text, 'professor_rejected'::text,
  'pass_available'::text
]));

CREATE OR REPLACE FUNCTION notify_pass_available()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pass_status = 'available' AND OLD.pass_status IS DISTINCT FROM 'available' THEN
    INSERT INTO notifications (user_id, type, title, message, item_id)
    VALUES (
      NEW.user_id,
      'pass_available',
      'Ton pass est disponible',
      'Ton pass est disponible sur Nexa. Retrouve-le dans « Mes achats ».',
      NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_pass_available ON event_attendees;
CREATE TRIGGER trg_notify_pass_available
AFTER UPDATE ON event_attendees
FOR EACH ROW EXECUTE FUNCTION notify_pass_available();
