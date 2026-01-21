/*
  # Add Video Views Tracking System

  ## Overview
  This migration adds a comprehensive video views tracking system to provide
  professors with analytics about their content performance.

  ## New Tables
  
  1. **video_views**
     - Tracks each time a video is watched
     - Records viewer, video, and timestamp
     - Enables analytics for professors
     - Supports view counting and engagement metrics
  
  ## Purpose
  - Allow professors to see which videos are most popular
  - Track total view counts per video
  - Provide engagement metrics for content optimization
  - Support future analytics features

  ## Security
  - RLS enabled on video_views table
  - Users can only see views of their own videos (if professor)
  - Users can log views for videos they watch
  - Privacy-focused: no sensitive user data stored
*/

-- Create video_views table
CREATE TABLE IF NOT EXISTS video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  professor_id uuid REFERENCES professors(id) ON DELETE CASCADE,
  watched_at timestamptz DEFAULT now(),
  watch_duration_seconds integer DEFAULT 0,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_professor_id ON video_views(professor_id);
CREATE INDEX IF NOT EXISTS idx_video_views_user_id ON video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_video_views_watched_at ON video_views(watched_at);

-- Enable RLS
ALTER TABLE video_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for video_views

CREATE POLICY "Users can insert own video views"
  ON video_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professors can view stats for their videos"
  ON video_views FOR SELECT
  TO authenticated
  USING (
    professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view own video views"
  ON video_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to automatically set professor_id on video view insert
CREATE OR REPLACE FUNCTION set_video_view_professor_id()
RETURNS trigger AS $$
BEGIN
  SELECT professor_id INTO NEW.professor_id
  FROM videos
  WHERE id = NEW.video_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-populate professor_id
DROP TRIGGER IF EXISTS on_video_view_insert ON video_views;
CREATE TRIGGER on_video_view_insert
  BEFORE INSERT ON video_views
  FOR EACH ROW EXECUTE FUNCTION set_video_view_professor_id();