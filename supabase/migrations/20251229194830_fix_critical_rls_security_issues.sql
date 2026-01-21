/*
  # Fix Critical RLS Security Issues

  1. Purpose
    - Address critical security vulnerabilities identified in RLS audit
    - Restrict overly permissive policies
    - Add missing security controls

  2. Critical Fixes
    - Fix Stripe payment policies (remove USING(true))
    - Restrict profiles table public access
    - Fix video purchases to allow user purchases
    - Add verified purchase enforcement for reviews

  3. Additional Improvements
    - Add missing DELETE policies
    - Add professor_id to program_purchases for better access control
    - Strengthen event attendee validation

  4. Security
    - All changes follow principle of least privilege
    - Admin-only access for financial operations
    - User data restricted to authenticated users
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_payments' 
    AND policyname = 'Service can insert payments'
  ) THEN
    DROP POLICY "Service can insert payments" ON stripe_payments;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_payments' 
    AND policyname = 'Service can update payments'
  ) THEN
    DROP POLICY "Service can update payments" ON stripe_payments;
  END IF;
END $$;

CREATE POLICY "Only admins can insert payments"
  ON stripe_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can update payments"
  ON stripe_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Public can view profiles'
  ) THEN
    DROP POLICY "Public can view profiles" ON profiles;
  END IF;
END $$;

CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'video_purchases' 
    AND policyname = 'Only admins can create video purchases'
  ) THEN
    DROP POLICY "Only admins can create video purchases" ON video_purchases;
  END IF;
END $$;

CREATE POLICY "Users can create own video purchases"
  ON video_purchases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'program_purchases' 
    AND column_name = 'professor_id'
  ) THEN
    ALTER TABLE program_purchases ADD COLUMN professor_id uuid REFERENCES professors(id);
    
    UPDATE program_purchases pp
    SET professor_id = (
      SELECT p.professor_id 
      FROM programs p 
      WHERE p.id = pp.program_id
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_program_purchases_professor_id ON program_purchases(professor_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'program_purchases' 
    AND policyname = 'Professors can view their program purchases'
  ) THEN
    CREATE POLICY "Professors can view their program purchases"
      ON program_purchases FOR SELECT
      TO authenticated
      USING (professor_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION verify_purchase_on_review()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_type = 'video' THEN
    NEW.is_verified_purchase := EXISTS (
      SELECT 1 FROM video_purchases
      WHERE user_id = NEW.user_id 
      AND video_id = NEW.item_id 
      AND status = 'active'
    );
  ELSIF NEW.item_type = 'program' THEN
    NEW.is_verified_purchase := EXISTS (
      SELECT 1 FROM program_purchases
      WHERE user_id = NEW.user_id 
      AND program_id = NEW.item_id 
      AND status = 'active'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS verify_purchase_before_review ON reviews;

CREATE TRIGGER verify_purchase_before_review
BEFORE INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION verify_purchase_on_review();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_customers' 
    AND policyname = 'Users can delete own Stripe customer data'
  ) THEN
    CREATE POLICY "Users can delete own Stripe customer data"
      ON stripe_customers FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'video_views' 
    AND policyname = 'Users can delete own video views'
  ) THEN
    CREATE POLICY "Users can delete own video views"
      ON video_views FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION validate_event_attendee()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = NEW.order_id
    AND orders.user_id = auth.uid()
    AND orders.status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Can only create attendees for paid orders';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS validate_attendee_before_insert ON event_attendees;

CREATE TRIGGER validate_attendee_before_insert
BEFORE INSERT ON event_attendees
FOR EACH ROW EXECUTE FUNCTION validate_event_attendee();
