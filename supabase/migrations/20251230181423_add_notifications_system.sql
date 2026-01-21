/*
  # Add Notifications System

  1. Purpose
    - Create notification system for students following professors
    - Notify students when their favorite professors publish new content
    - Support for video and program notifications

  2. New Tables
    - `notifications`: Store user notifications
      - `id` (uuid, PK) - Notification ID
      - `user_id` (uuid, FK) - User receiving notification
      - `professor_id` (uuid, FK) - Professor who created content
      - `type` (text) - Type of notification (new_video, new_program)
      - `title` (text) - Notification title
      - `message` (text) - Notification message
      - `link` (text) - Link to content
      - `item_id` (uuid) - ID of video/program
      - `is_read` (boolean) - Read status
      - `created_at` (timestamptz) - Creation timestamp

  3. Triggers
    - Auto-create notifications when professors publish videos
    - Auto-create notifications when professors publish programs
    - Only notify users who favorited the professor

  4. Security
    - Enable RLS on notifications table
    - Users can only view their own notifications
    - Users can mark their own notifications as read
    - Only triggers can insert notifications

  5. Indexes
    - Index on user_id for fast queries
    - Index on is_read for filtering unread
    - Index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('new_video', 'new_program')),
  title text NOT NULL,
  message text NOT NULL,
  link text NOT NULL,
  item_id uuid NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications as read"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION notify_followers_new_video()
RETURNS TRIGGER AS $$
DECLARE
  professor_name text;
  video_title text;
BEGIN
  SELECT p.name INTO professor_name
  FROM professors p
  WHERE p.id = NEW.professor_id;

  video_title := NEW.title;

  INSERT INTO notifications (user_id, professor_id, type, title, message, link, item_id)
  SELECT 
    f.user_id,
    NEW.professor_id,
    'new_video',
    'Nouvelle vidéo disponible',
    professor_name || ' a publié une nouvelle vidéo : ' || video_title,
    '/academy?video=' || NEW.id::text,
    NEW.id
  FROM favorites f
  WHERE f.item_id = NEW.professor_id
    AND f.item_type = 'professor'
    AND NEW.visibility IN ('public', 'subscribers_only');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_followers_new_program()
RETURNS TRIGGER AS $$
DECLARE
  professor_name text;
  program_title text;
BEGIN
  SELECT p.name INTO professor_name
  FROM professors p
  WHERE p.id = NEW.professor_id;

  program_title := NEW.title;

  INSERT INTO notifications (user_id, professor_id, type, title, message, link, item_id)
  SELECT 
    f.user_id,
    NEW.professor_id,
    'new_program',
    'Nouveau programme disponible',
    professor_name || ' a publié un nouveau programme : ' || program_title,
    '/academy?program=' || NEW.id::text,
    NEW.id
  FROM favorites f
  WHERE f.item_id = NEW.professor_id
    AND f.item_type = 'professor'
    AND NEW.visibility IN ('public', 'subscribers_only');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_video ON videos;
CREATE TRIGGER trigger_notify_new_video
  AFTER INSERT ON videos
  FOR EACH ROW
  EXECUTE FUNCTION notify_followers_new_video();

DROP TRIGGER IF EXISTS trigger_notify_new_program ON programs;
CREATE TRIGGER trigger_notify_new_program
  AFTER INSERT ON programs
  FOR EACH ROW
  EXECUTE FUNCTION notify_followers_new_program();

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM notifications
    WHERE user_id = p_user_id
    AND is_read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = p_user_id
  AND is_read = false
  AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
