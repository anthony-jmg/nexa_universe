/*
  # Fix Notification Triggers - item_id References

  1. Problem
    - Triggers use f.item_id and f.item_type which don't exist in favorites table
    - The favorites table uses professor_id, video_id, program_id and favorite_type
    - Error: "column f.item_id does not exist"

  2. Solution
    - Update notify_followers_new_video() to use f.professor_id
    - Update notify_followers_new_program() to use f.professor_id
    - Update to use f.favorite_type instead of f.item_type

  3. Impact
    - Fixes video and program creation errors
    - Allows professors to successfully add content
*/

-- Fix notify_followers_new_video function
CREATE OR REPLACE FUNCTION notify_followers_new_video()
RETURNS TRIGGER AS $$
DECLARE
  professor_name text;
  video_title text;
BEGIN
  -- Get professor name from profiles table via join
  SELECT pr.full_name INTO professor_name
  FROM professors p
  JOIN profiles pr ON pr.id = p.id
  WHERE p.id = NEW.professor_id;

  video_title := NEW.title;

  -- Insert notifications for all followers
  INSERT INTO notifications (user_id, professor_id, type, title, message, link, item_id)
  SELECT 
    f.user_id,
    NEW.professor_id,
    'new_video',
    'Nouvelle vidéo disponible',
    COALESCE(professor_name, 'Un professeur') || ' a publié une nouvelle vidéo : ' || video_title,
    '/academy?video=' || NEW.id::text,
    NEW.id
  FROM favorites f
  WHERE f.professor_id = NEW.professor_id
    AND f.favorite_type = 'professor'
    AND NEW.visibility IN ('public', 'subscribers_only');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix notify_followers_new_program function
CREATE OR REPLACE FUNCTION notify_followers_new_program()
RETURNS TRIGGER AS $$
DECLARE
  professor_name text;
  program_title text;
BEGIN
  -- Get professor name from profiles table via join
  SELECT pr.full_name INTO professor_name
  FROM professors p
  JOIN profiles pr ON pr.id = p.id
  WHERE p.id = NEW.professor_id;

  program_title := NEW.title;

  -- Insert notifications for all followers
  INSERT INTO notifications (user_id, professor_id, type, title, message, link, item_id)
  SELECT 
    f.user_id,
    NEW.professor_id,
    'new_program',
    'Nouveau programme disponible',
    COALESCE(professor_name, 'Un professeur') || ' a publié un nouveau programme : ' || program_title,
    '/academy?program=' || NEW.id::text,
    NEW.id
  FROM favorites f
  WHERE f.professor_id = NEW.professor_id
    AND f.favorite_type = 'professor'
    AND NEW.visibility IN ('public', 'subscribers_only');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
