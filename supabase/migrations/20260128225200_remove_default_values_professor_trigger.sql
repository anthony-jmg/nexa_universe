/*
  # Remove default values from professor auto-creation

  1. Changes
    - Update trigger to create professor entry with only ID
    - No default values for bio, specialties, prices, etc.
    - Professor must fill in their information from dashboard
  
  2. Security
    - Trigger runs with proper permissions
    - Prevents duplicate entries with ON CONFLICT
*/

-- Update function to create professor entry without default values
CREATE OR REPLACE FUNCTION create_professor_entry()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create professor entry if role is 'professor'
  IF (TG_OP = 'INSERT' AND NEW.role = 'professor') OR 
     (TG_OP = 'UPDATE' AND NEW.role = 'professor' AND (OLD.role IS DISTINCT FROM NEW.role OR OLD.role = 'professor')) THEN
    
    -- Insert into professors table with only the ID
    INSERT INTO professors (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;
