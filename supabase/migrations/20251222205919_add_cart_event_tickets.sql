/*
  # Add Event Tickets to Cart System
  
  ## Overview
  This migration adds the ability to add event tickets to the shopping cart before purchase.
  QR codes will be generated only after payment is validated.
  
  ## New Tables
  
  ### 1. cart_event_tickets
  Stores event ticket selections in the cart before purchase
  - `id` (uuid, PK) - Cart item ID
  - `user_id` (uuid, FK) - User who added this to cart
  - `event_ticket_type_id` (uuid, FK) - Reference to the specific event ticket type
  - `quantity` (integer) - Number of tickets
  - `created_at` (timestamptz) - When added to cart
  - `updated_at` (timestamptz) - Last update
  
  ## Security
  - Enable RLS on cart_event_tickets table
  - Users can only manage their own cart items
  
  ## Important Notes
  - Tickets are added to cart with quantity
  - After payment, user will provide attendee info for each ticket
  - QR codes are generated only after payment validation
*/

-- Create cart_event_tickets table
CREATE TABLE IF NOT EXISTS cart_event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_ticket_type_id uuid NOT NULL REFERENCES event_ticket_types(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_ticket_type_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cart_event_tickets_user_id ON cart_event_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_event_tickets_event_ticket_type_id ON cart_event_tickets(event_ticket_type_id);

-- Enable RLS
ALTER TABLE cart_event_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cart_event_tickets

-- Users can view their own cart items
CREATE POLICY "Users can view own cart event tickets"
  ON cart_event_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own cart items
CREATE POLICY "Users can insert own cart event tickets"
  ON cart_event_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own cart items
CREATE POLICY "Users can update own cart event tickets"
  ON cart_event_tickets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own cart items
CREATE POLICY "Users can delete own cart event tickets"
  ON cart_event_tickets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_cart_event_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS cart_event_tickets_updated_at ON cart_event_tickets;
CREATE TRIGGER cart_event_tickets_updated_at
  BEFORE UPDATE ON cart_event_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_event_tickets_updated_at();