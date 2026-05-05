/*
  # Add shipping columns to orders and create rate_limits table

  1. Modified Tables
    - `orders`
      - `shipping_name` (text) - Customer name for shipping
      - `shipping_email` (text) - Customer email for order confirmation
      - `shipping_phone` (text) - Customer phone number
      - `shipping_address` (text) - Shipping address for physical products
      - `notes` (text) - Order notes from customer
      - `is_member_order` (boolean) - Whether the order used member pricing

  2. New Tables
    - `rate_limits`
      - `id` (uuid, primary key)
      - `key` (text, unique) - Rate limit key (e.g., "order:user_id")
      - `count` (integer) - Number of requests in current window
      - `window_start` (timestamptz) - Start of the rate limit window
      - `expires_at` (timestamptz) - When the rate limit window expires

  3. Security
    - Enable RLS on `rate_limits` table
    - Service role only access for rate_limits (no user-facing policies needed)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_email'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_email text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_phone'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_phone text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_address text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN notes text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'is_member_order'
  ) THEN
    ALTER TABLE orders ADD COLUMN is_member_order boolean DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 minute'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
