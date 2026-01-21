/*
  # Kizomba Dance Platform - Initial Schema

  ## Overview
  Complete database schema for a kizomba dance learning platform with role-based access,
  subscription management, and video content organization.

  ## New Tables

  ### 1. profiles
  Extended user profile information linked to auth.users
  - `id` (uuid, FK to auth.users) - User ID
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `role` (text) - User role: student, professor, admin
  - `platform_subscription_status` (text) - Platform subscription: active, inactive, trial
  - `platform_subscription_expires_at` (timestamptz) - Expiration date
  - `avatar_url` (text) - Profile picture URL
  - `created_at` (timestamptz) - Account creation date
  - `updated_at` (timestamptz) - Last update

  ### 2. professors
  Professor profiles and information
  - `id` (uuid, FK to profiles) - Professor ID
  - `bio` (text) - Professor biography
  - `specialties` (text[]) - Dance specialties
  - `experience_years` (integer) - Years of experience
  - `profile_video_url` (text) - Introduction video
  - `is_featured` (boolean) - Featured on homepage
  - `subscription_price` (decimal) - Monthly subscription price
  - `created_at` (timestamptz) - Profile creation date

  ### 3. videos
  Video content library
  - `id` (uuid, PK) - Video ID
  - `title` (text) - Video title
  - `description` (text) - Video description
  - `level` (text) - beginner, intermediate, advanced
  - `duration_minutes` (integer) - Video duration
  - `video_url` (text) - Video streaming URL
  - `thumbnail_url` (text) - Thumbnail image
  - `order_index` (integer) - Display order within level
  - `professor_id` (uuid, FK to professors) - Teaching professor
  - `is_free` (boolean) - Free preview access
  - `created_at` (timestamptz) - Upload date
  - `updated_at` (timestamptz) - Last update

  ### 4. professor_subscriptions
  Individual professor subscriptions
  - `id` (uuid, PK) - Subscription ID
  - `user_id` (uuid, FK to profiles) - Student ID
  - `professor_id` (uuid, FK to professors) - Professor ID
  - `status` (text) - active, inactive, cancelled
  - `started_at` (timestamptz) - Subscription start
  - `expires_at` (timestamptz) - Subscription expiration
  - `created_at` (timestamptz) - Record creation

  ### 5. video_progress
  Track user progress on videos
  - `id` (uuid, PK) - Progress ID
  - `user_id` (uuid, FK to profiles) - User ID
  - `video_id` (uuid, FK to videos) - Video ID
  - `progress_percentage` (integer) - Completion percentage (0-100)
  - `completed` (boolean) - Whether video is completed
  - `last_watched_at` (timestamptz) - Last viewing time
  - `created_at` (timestamptz) - First view
  - `updated_at` (timestamptz) - Last update

  ## Security
  - Enable RLS on all tables
  - Policies for role-based access control
  - Students can only access content based on subscription
  - Professors can manage their own content
  - Admins have full access
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'professor', 'admin')),
  platform_subscription_status text NOT NULL DEFAULT 'inactive' CHECK (platform_subscription_status IN ('active', 'inactive', 'trial')),
  platform_subscription_expires_at timestamptz,
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create professors table
CREATE TABLE IF NOT EXISTS professors (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  bio text DEFAULT '',
  specialties text[] DEFAULT '{}',
  experience_years integer DEFAULT 0,
  profile_video_url text DEFAULT '',
  is_featured boolean DEFAULT false,
  subscription_price decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE professors ENABLE ROW LEVEL SECURITY;

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  level text NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  duration_minutes integer DEFAULT 0,
  video_url text DEFAULT '',
  thumbnail_url text DEFAULT '',
  order_index integer DEFAULT 0,
  professor_id uuid REFERENCES professors(id) ON DELETE SET NULL,
  is_free boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Create professor_subscriptions table
CREATE TABLE IF NOT EXISTS professor_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'cancelled')),
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, professor_id)
);

ALTER TABLE professor_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create video_progress table
CREATE TABLE IF NOT EXISTS video_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  completed boolean DEFAULT false,
  last_watched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Professors policies
CREATE POLICY "Anyone can view professors"
  ON professors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Professors can update own profile"
  ON professors FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage professors"
  ON professors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Videos policies
CREATE POLICY "Users can view videos"
  ON videos FOR SELECT
  TO authenticated
  USING (
    is_free = true
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.platform_subscription_status = 'active'
      AND profiles.platform_subscription_expires_at > now()
    )
    OR EXISTS (
      SELECT 1 FROM professor_subscriptions
      WHERE professor_subscriptions.user_id = auth.uid()
      AND professor_subscriptions.professor_id = videos.professor_id
      AND professor_subscriptions.status = 'active'
      AND professor_subscriptions.expires_at > now()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('professor', 'admin')
    )
  );

CREATE POLICY "Professors can manage own videos"
  ON videos FOR ALL
  TO authenticated
  USING (
    professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Professor subscriptions policies
CREATE POLICY "Users can view own subscriptions"
  ON professor_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own subscriptions"
  ON professor_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subscriptions"
  ON professor_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Professors can view their subscriptions"
  ON professor_subscriptions FOR SELECT
  TO authenticated
  USING (professor_id = auth.uid());

-- Video progress policies
CREATE POLICY "Users can view own progress"
  ON video_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own progress"
  ON video_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own progress"
  ON video_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles(platform_subscription_status);
CREATE INDEX IF NOT EXISTS idx_videos_level ON videos(level);
CREATE INDEX IF NOT EXISTS idx_videos_professor ON videos(professor_id);
CREATE INDEX IF NOT EXISTS idx_professor_subs_user ON professor_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_professor_subs_professor ON professor_subscriptions(professor_id);
CREATE INDEX IF NOT EXISTS idx_video_progress_user ON video_progress(user_id);

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', ''));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();