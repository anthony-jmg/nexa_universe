/*
  # Add Favorites System

  1. New Tables
    - `favorites`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `favorite_type` (text) - Type of favorite: 'professor', 'video', 'program'
      - `professor_id` (uuid, nullable, references professors)
      - `video_id` (uuid, nullable, references videos)
      - `program_id` (uuid, nullable, references programs)
      - `created_at` (timestamptz)
      - Unique constraint on (user_id, favorite_type, professor_id, video_id, program_id)

  2. Security
    - Enable RLS on `favorites` table
    - Add policy for authenticated users to view their own favorites
    - Add policy for authenticated users to create their own favorites
    - Add policy for authenticated users to delete their own favorites

  3. Notes
    - Each favorite has exactly one of: professor_id, video_id, or program_id set (based on favorite_type)
    - Users can only have one favorite per item
    - Favorites are personal to each user
*/

-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  favorite_type text NOT NULL CHECK (favorite_type IN ('professor', 'video', 'program')),
  professor_id uuid REFERENCES professors(id) ON DELETE CASCADE,
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,
  program_id uuid REFERENCES programs(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_favorite_reference CHECK (
    (favorite_type = 'professor' AND professor_id IS NOT NULL AND video_id IS NULL AND program_id IS NULL) OR
    (favorite_type = 'video' AND video_id IS NOT NULL AND professor_id IS NULL AND program_id IS NULL) OR
    (favorite_type = 'program' AND program_id IS NOT NULL AND professor_id IS NULL AND video_id IS NULL)
  )
);

-- Create unique index to prevent duplicate favorites
CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_professor_idx 
  ON favorites(user_id, professor_id) 
  WHERE professor_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_video_idx 
  ON favorites(user_id, video_id) 
  WHERE video_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_program_idx 
  ON favorites(user_id, program_id) 
  WHERE program_id IS NOT NULL;

-- Enable RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own favorites
CREATE POLICY "Users can view own favorites"
  ON favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create their own favorites
CREATE POLICY "Users can create own favorites"
  ON favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own favorites
CREATE POLICY "Users can delete own favorites"
  ON favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);