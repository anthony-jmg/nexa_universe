/*
  # Fix professor trigger to prevent duplicate entry attempts

  1. Changes
    - Update trigger logic to only create professor entry when role changes TO 'professor'
    - For INSERT: create entry if role is 'professor'
    - For UPDATE: only create entry if role changed from something else to 'professor'
    - Prevents unnecessary INSERT attempts on existing professors
  
  2. Security
    - Trigger runs with proper permissions
    - ON CONFLICT clause prevents any actual duplicates
*/

-- Update function with correct logic
CREATE OR REPLACE FUNCTION create_professor_entry()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- For INSERT: create professor entry if role is 'professor'
  IF TG_OP = 'INSERT' AND NEW.role = 'professor' THEN
    INSERT INTO professors (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  
  -- For UPDATE: only create professor entry if role changed TO 'professor'
  ELSIF TG_OP = 'UPDATE' AND NEW.role = 'professor' AND OLD.role != 'professor' THEN
    INSERT INTO professors (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;