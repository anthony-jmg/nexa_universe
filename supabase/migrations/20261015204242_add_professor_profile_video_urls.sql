/*
# Add profile_video_urls column to professors

1. Modified Tables
- `professors`: add `profile_video_urls` (text[], default '{}')
  Stores up to 3 presentation video URLs (YouTube, youtu.be, Instagram).
  The existing `profile_video_url` (text) is kept for backward compatibility.

2. Security
- No new policies needed. The column inherits the table's existing RLS.
*/

ALTER TABLE public.professors
  ADD COLUMN IF NOT EXISTS profile_video_urls text[] DEFAULT '{}'::text[];
