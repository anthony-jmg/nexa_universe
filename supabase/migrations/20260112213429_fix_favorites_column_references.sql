/*
  # Fix Favorites Column References in Notification Triggers
  
  1. Changes
    - Update `notify_followers_new_video()` to use correct column names
    - Update `notify_followers_new_program()` to use correct column names
    
  2. Details
    - The `favorites` table uses `professor_id`, `video_id`, `program_id` (not `item_id`)
    - The `favorites` table uses `favorite_type` (not `item_type`)
    - Fixing SQL errors: "column f.item_id does not exist"
*/

CREATE OR REPLACE FUNCTION notify_followers_new_video()
RETURNS TRIGGER AS $$
DECLARE
  professor_name text;
  video_title text;
BEGIN
  SELECT full_name INTO professor_name
  FROM profiles
  WHERE id = NEW.professor_id;

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
  WHERE f.professor_id = NEW.professor_id
    AND f.favorite_type = 'professor'
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
  SELECT full_name INTO professor_name
  FROM profiles
  WHERE id = NEW.professor_id;

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
  WHERE f.professor_id = NEW.professor_id
    AND f.favorite_type = 'professor'
    AND NEW.visibility IN ('public', 'paid');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
