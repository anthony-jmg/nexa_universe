/*
  # Auto-create professor entry when profile is created

  1. Changes
    - Add trigger function to automatically create professor entry
    - When a profile is created with role 'professor', automatically create corresponding entry in professors table
    - Set default values for new professors
  
  2. Security
    - Trigger runs with proper permissions
    - Prevents duplicate entries with ON CONFLICT
*/

-- Function to create professor entry when profile is created with role 'professor'
CREATE OR REPLACE FUNCTION create_professor_entry()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create professor entry if role is 'professor'
  IF NEW.role = 'professor' THEN
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

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_profile_created_create_professor ON profiles;

-- Create trigger that fires after profile insert
CREATE TRIGGER on_profile_created_create_professor
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_professor_entry();
