/*
  # Fix professor entry creation on role update

  1. Changes
    - Update trigger to also fire on UPDATE operations
    - Check if role changed to 'professor' and create entry if needed
    - Handles both new user creation and role changes
  
  2. Security
    - Trigger runs with proper permissions
    - Prevents duplicate entries with ON CONFLICT
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_profile_created_create_professor ON profiles;

-- Update function to handle both INSERT and UPDATE
CREATE OR REPLACE FUNCTION create_professor_entry()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create professor entry if role is 'professor'
  -- For INSERT: always check NEW.role
  -- For UPDATE: check if role changed to 'professor' or if it's already 'professor' and entry doesn't exist
  IF (TG_OP = 'INSERT' AND NEW.role = 'professor') OR 
     (TG_OP = 'UPDATE' AND NEW.role = 'professor' AND (OLD.role IS DISTINCT FROM NEW.role OR OLD.role = 'professor')) THEN
    
    -- Insert into professors table with default values
    INSERT INTO professors (
      id,
      bio,
      specialties,
      experience_years,
      is_featured,
      subscription_price,
      subscriber_discount_percentage,
      is_founder,
      badge_type
    )
    VALUES (
      NEW.id,
      'Professeur de danse',
      ARRAY['Kizomba'],
      0,
      false,
      9.99,
      10,
      false,
      NULL
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires after INSERT or UPDATE
CREATE TRIGGER on_profile_created_create_professor
  AFTER INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_professor_entry();
