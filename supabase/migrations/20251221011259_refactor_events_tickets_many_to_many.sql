/*
  # Refactor Events and Tickets to Many-to-Many Relationship

  ## Overview
  This migration refactors the existing events and tickets system to support a many-to-many relationship
  where a single ticket type can be used across multiple events with different prices per event.

  ## Changes Made

  ### 1. Drop existing constraints and policies
  Remove policies and constraints that depend on event_id in ticket_types

  ### 2. Restructure ticket_types table
  Transform ticket_types to be reusable across events

  ### 3. Create event_ticket_types junction table
  Links events to ticket types with event-specific pricing

  ### 4. Update ticket_purchases
  Link purchases to the junction table

  ## Security
  - Maintain RLS policies with updated structure
*/

-- Drop all existing policies on ticket_types
DROP POLICY IF EXISTS "Anyone can view active ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Anyone can view ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Admins and professors can create ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Admins and professors can update ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Admins and professors can manage ticket types" ON ticket_types;

-- Drop FK constraint from ticket_purchases if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_purchases_ticket_type_id_fkey'
    AND table_name = 'ticket_purchases'
  ) THEN
    ALTER TABLE ticket_purchases DROP CONSTRAINT ticket_purchases_ticket_type_id_fkey;
  END IF;
END $$;

-- Drop existing foreign key constraint from ticket_types
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_types_event_id_fkey'
    AND table_name = 'ticket_types'
  ) THEN
    ALTER TABLE ticket_types DROP CONSTRAINT ticket_types_event_id_fkey;
  END IF;
END $$;

-- Remove event-specific columns from ticket_types
ALTER TABLE ticket_types DROP COLUMN IF EXISTS event_id CASCADE;
ALTER TABLE ticket_types DROP COLUMN IF EXISTS price;
ALTER TABLE ticket_types DROP COLUMN IF EXISTS member_price;
ALTER TABLE ticket_types DROP COLUMN IF EXISTS quantity_available;
ALTER TABLE ticket_types DROP COLUMN IF EXISTS quantity_sold;
ALTER TABLE ticket_types DROP COLUMN IF EXISTS max_per_order;
ALTER TABLE ticket_types DROP COLUMN IF EXISTS sale_start_date;
ALTER TABLE ticket_types DROP COLUMN IF EXISTS sale_end_date;
ALTER TABLE ticket_types DROP COLUMN IF EXISTS features;
ALTER TABLE ticket_types DROP COLUMN IF EXISTS is_active;
ALTER TABLE ticket_types DROP COLUMN IF EXISTS display_order;

-- Add unique constraint on name
ALTER TABLE ticket_types ADD CONSTRAINT ticket_types_name_key UNIQUE (name);

-- Update events table
DO $$
BEGIN
  -- Rename event_date to start_date if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'event_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE events RENAME COLUMN event_date TO start_date;
  END IF;

  -- Add event_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'event_status'
  ) THEN
    ALTER TABLE events ADD COLUMN event_status text DEFAULT 'draft' CHECK (event_status IN ('draft', 'published', 'cancelled', 'completed'));
    UPDATE events SET event_status = CASE WHEN is_active THEN 'published' ELSE 'draft' END;
  END IF;

  -- Add created_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE events ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Add max_attendees column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'max_attendees'
  ) THEN
    ALTER TABLE events ADD COLUMN max_attendees integer;
  END IF;
END $$;

-- Create event_ticket_types junction table
CREATE TABLE IF NOT EXISTS event_ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  price decimal(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  member_price decimal(10,2) DEFAULT 0 CHECK (member_price >= 0),
  quantity_available integer CHECK (quantity_available >= 0),
  quantity_sold integer NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  max_per_order integer DEFAULT 10 CHECK (max_per_order > 0),
  sales_start_date timestamptz,
  sales_end_date timestamptz,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, ticket_type_id)
);

-- Update ticket_purchases to reference event_ticket_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_purchases' AND column_name = 'event_ticket_type_id'
  ) THEN
    ALTER TABLE ticket_purchases ADD COLUMN event_ticket_type_id uuid REFERENCES event_ticket_types(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_event_ticket_types_event_id ON event_ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_event_ticket_types_ticket_type_id ON event_ticket_types(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_event_ticket_type_id ON ticket_purchases(event_ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_events_event_status ON events(event_status);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);

-- Enable RLS
ALTER TABLE event_ticket_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticket_types

-- Anyone can view ticket types
CREATE POLICY "Anyone can view ticket types"
  ON ticket_types FOR SELECT
  USING (true);

-- Admins and professors can manage ticket types
CREATE POLICY "Admins and professors can manage ticket types"
  ON ticket_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'professor')
    )
  );

-- RLS Policies for event_ticket_types

-- Anyone can view tickets for published events
CREATE POLICY "Anyone can view tickets for published events"
  ON event_ticket_types FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_ticket_types.event_id
      AND (events.event_status = 'published' OR events.is_active = true)
    )
  );

-- Admins and professors can manage event tickets
CREATE POLICY "Admins and professors can manage event tickets"
  ON event_ticket_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'professor')
    )
  );

-- Update events RLS policies
DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Anyone can view active events" ON events;

CREATE POLICY "Anyone can view published events"
  ON events FOR SELECT
  USING (event_status = 'published' OR is_active = true);

CREATE POLICY "Admins and professors can manage events"
  ON events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'professor')
    )
  );

-- Insert default ticket types
INSERT INTO ticket_types (name, description) VALUES
  ('VIP', 'Access VIP avec avantages exclusifs'),
  ('Standard', 'Billet d''entrée standard'),
  ('Early Bird', 'Tarif préférentiel pour réservation anticipée'),
  ('Student', 'Tarif étudiant avec justificatif'),
  ('Group', 'Tarif de groupe (minimum 5 personnes)')
ON CONFLICT (name) DO NOTHING;