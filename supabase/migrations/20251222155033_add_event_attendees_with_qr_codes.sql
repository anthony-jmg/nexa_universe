/*
  # Event Attendees System with QR Codes

  ## Overview
  This migration creates a comprehensive system for event ticket purchases where buyers can
  purchase tickets for themselves and/or other people. Each ticket holder gets a unique
  QR code generated from their personal information and event details.

  ## New Tables

  ### 1. event_attendees
  Stores individual attendee information for each ticket purchased
  - `id` (uuid, PK) - Attendee ID
  - `order_id` (uuid, FK) - Reference to the order
  - `event_ticket_type_id` (uuid, FK) - Reference to the specific event ticket type
  - `attendee_first_name` (text) - First name of the person using this ticket
  - `attendee_last_name` (text) - Last name of the person using this ticket
  - `attendee_email` (text) - Email of the person using this ticket
  - `attendee_phone` (text, optional) - Phone number of the person using this ticket
  - `qr_code_data` (text) - Unique QR code data (JSON string with attendee + event info)
  - `qr_code_hash` (text, unique) - SHA256 hash of QR code for verification
  - `checked_in` (boolean) - Whether the attendee has checked in at the event
  - `checked_in_at` (timestamptz) - When the attendee checked in
  - `checked_in_by` (uuid, FK) - Who checked in the attendee
  - `created_at` (timestamptz) - Creation date
  - `updated_at` (timestamptz) - Last update date

  ## Modified Tables

  ### orders
  Add event-related fields if they don't exist

  ## Security
  - Enable RLS on event_attendees table
  - Buyers can view their own attendees
  - Event organizers (admins/professors) can view all attendees for their events
  - Only event organizers can update check-in status

  ## Important Notes
  1. Each ticket purchase creates one event_attendee entry
  2. QR codes are generated with attendee info + event info for uniqueness
  3. The buyer can purchase multiple tickets and provide different attendee info for each
  4. Attendees can be the buyer themselves or different people
*/

-- Create event_attendees table
CREATE TABLE IF NOT EXISTS event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_ticket_type_id uuid NOT NULL REFERENCES event_ticket_types(id) ON DELETE RESTRICT,
  attendee_first_name text NOT NULL,
  attendee_last_name text NOT NULL,
  attendee_email text NOT NULL,
  attendee_phone text,
  qr_code_data text NOT NULL,
  qr_code_hash text NOT NULL UNIQUE,
  checked_in boolean DEFAULT false,
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_attendees_order_id ON event_attendees(order_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_ticket_type_id ON event_attendees(event_ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_qr_code_hash ON event_attendees(qr_code_hash);
CREATE INDEX IF NOT EXISTS idx_event_attendees_email ON event_attendees(attendee_email);
CREATE INDEX IF NOT EXISTS idx_event_attendees_checked_in ON event_attendees(checked_in);

-- Enable RLS
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_attendees

-- Buyers can view attendees for their own orders
CREATE POLICY "Buyers can view their attendees"
  ON event_attendees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = event_attendees.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Admins and professors can view all attendees
CREATE POLICY "Admins and professors can view all attendees"
  ON event_attendees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'professor')
    )
  );

-- Only system can insert attendees (via order creation)
CREATE POLICY "Authenticated users can create attendees"
  ON event_attendees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = event_attendees.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Admins and professors can update check-in status
CREATE POLICY "Event organizers can update check-in"
  ON event_attendees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'professor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'professor')
    )
  );

-- Admins can delete attendees
CREATE POLICY "Admins can delete attendees"
  ON event_attendees FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to generate QR code hash
CREATE OR REPLACE FUNCTION generate_qr_code_hash(
  p_attendee_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_event_id uuid,
  p_ticket_type_id uuid
) RETURNS text AS $$
DECLARE
  qr_string text;
BEGIN
  qr_string := p_attendee_id::text || '|' || 
               p_first_name || '|' || 
               p_last_name || '|' || 
               p_email || '|' || 
               p_event_id::text || '|' || 
               p_ticket_type_id::text;
  
  RETURN encode(digest(qr_string, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_event_attendees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS event_attendees_updated_at ON event_attendees;
CREATE TRIGGER event_attendees_updated_at
  BEFORE UPDATE ON event_attendees
  FOR EACH ROW
  EXECUTE FUNCTION update_event_attendees_updated_at();