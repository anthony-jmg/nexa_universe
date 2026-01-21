/*
  # Add Rate Limiting Infrastructure

  1. Purpose
    - Create infrastructure for rate limiting edge functions
    - Prevent abuse and DoS attacks
    - Track API usage per user

  2. New Tables
    - `rate_limits`: Store rate limit counters per key
      - `id` (uuid, PK) - Record ID
      - `key` (text) - Rate limit key (e.g., "checkout:user_id")
      - `count` (integer) - Number of requests in window
      - `window_start` (timestamptz) - Start of rate limit window
      - `expires_at` (timestamptz) - When this record expires
      - `created_at` (timestamptz) - Creation timestamp

  3. Security
    - Enable RLS on rate_limits table
    - Only edge functions can write to this table
    - Automatic cleanup of expired records

  4. Indexes
    - Index on key for fast lookups
    - Index on expires_at for cleanup
*/

CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

CREATE POLICY "Service role can manage rate limits"
  ON rate_limits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view own rate limits"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (key LIKE 'checkout:' || auth.uid()::text || '%');

CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION schedule_rate_limit_cleanup()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE expires_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
