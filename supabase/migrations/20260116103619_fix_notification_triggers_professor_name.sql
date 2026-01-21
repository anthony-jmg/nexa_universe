/*
  # Fix Notification Triggers - Professor Name Issue

  1. Problem
    - Notification triggers reference p.name which doesn't exist in professors table
    - Professors table only has: id, bio, specialties, etc. (no name column)
    - Name is stored in profiles.full_name

  2. Solution
    - Update notify_followers_new_video() to join with profiles table
    - Update notify_followers_new_program() to join with profiles table
    - Use COALESCE for graceful fallback if name is missing

  3. Impact
    - Fixes notifications when professors publish new content
    - Prevents database errors during content creation
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
  WHERE f.item_id = NEW.professor_id
    AND f.item_type = 'professor'
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
  WHERE f.item_id = NEW.professor_id
    AND f.item_type = 'professor'
    AND NEW.visibility IN ('public', 'subscribers_only');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
