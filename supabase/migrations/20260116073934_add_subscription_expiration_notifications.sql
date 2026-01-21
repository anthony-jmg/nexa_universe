/*
  # Add Subscription Expiration Notifications

  ## Overview
  This migration adds automatic notifications to alert users before their subscriptions expire.
  Users will receive reminders at strategic intervals (7 days, 3 days, 1 day) before expiration.

  ## Changes

  1. **Notification Types**
     - Add `platform_subscription_expiring` - Platform subscription expiring soon
     - Add `professor_subscription_expiring` - Professor subscription expiring soon
     - Add `platform_subscription_expired` - Platform subscription has expired
     - Add `professor_subscription_expired` - Professor subscription has expired

  2. **New Table: subscription_expiration_notifications_sent**
     - Track which expiration notifications have been sent to avoid duplicates
     - `id` (uuid, PK)
     - `user_id` (uuid, FK) - User who received notification
     - `subscription_type` (text) - 'platform' or 'professor'
     - `subscription_id` (uuid) - ID of subscription (profile.id or professor_subscription.id)
     - `days_before` (integer) - Days before expiration (7, 3, 1, 0)
     - `sent_at` (timestamptz) - When notification was sent
     - Unique constraint on (user_id, subscription_type, subscription_id, days_before)

  3. **Functions**
     - `check_and_send_expiration_notifications()` - Main function to check subscriptions and send notifications
     - Should be called periodically (daily via cron or edge function)

  ## Security
  - RLS enabled on new table
  - Only system can insert notification tracking records
  - Users can view their own notification history
*/

-- Update notification type constraint to include new types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    'new_video', 
    'new_program',
    'platform_subscription_expiring',
    'professor_subscription_expiring',
    'platform_subscription_expired',
    'professor_subscription_expired'
  ));

-- Create table to track sent expiration notifications
CREATE TABLE IF NOT EXISTS subscription_expiration_notifications_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_type text NOT NULL CHECK (subscription_type IN ('platform', 'professor')),
  subscription_id uuid NOT NULL,
  professor_id uuid REFERENCES professors(id) ON DELETE CASCADE,
  days_before integer NOT NULL CHECK (days_before IN (7, 3, 1, 0)),
  sent_at timestamptz DEFAULT now(),
  UNIQUE(user_id, subscription_type, subscription_id, days_before)
);

ALTER TABLE subscription_expiration_notifications_sent ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_expiration_notifications_user_id 
  ON subscription_expiration_notifications_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_expiration_notifications_subscription 
  ON subscription_expiration_notifications_sent(subscription_type, subscription_id);

CREATE POLICY "Users can view own expiration notification history"
  ON subscription_expiration_notifications_sent FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to check and send platform subscription expiration notifications
CREATE OR REPLACE FUNCTION check_and_send_expiration_notifications()
RETURNS void AS $$
DECLARE
  profile_record RECORD;
  prof_sub_record RECORD;
  days_until_expiry integer;
  notification_days integer[] := ARRAY[7, 3, 1, 0];
  notification_day integer;
  already_sent boolean;
BEGIN
  -- Check platform subscriptions
  FOR profile_record IN
    SELECT 
      id,
      email,
      platform_subscription_status,
      platform_subscription_expires_at,
      subscription_cancel_at_period_end
    FROM profiles
    WHERE platform_subscription_status = 'active'
      AND platform_subscription_expires_at IS NOT NULL
      AND platform_subscription_expires_at > now()
      AND platform_subscription_expires_at <= now() + interval '7 days'
  LOOP
    days_until_expiry := EXTRACT(DAY FROM (profile_record.platform_subscription_expires_at - now()))::integer;
    
    -- Check each notification threshold
    FOREACH notification_day IN ARRAY notification_days
    LOOP
      -- Send notification if we're at or past the threshold and haven't sent it yet
      IF days_until_expiry <= notification_day THEN
        -- Check if we already sent this notification
        SELECT EXISTS(
          SELECT 1 FROM subscription_expiration_notifications_sent
          WHERE user_id = profile_record.id
            AND subscription_type = 'platform'
            AND subscription_id = profile_record.id
            AND days_before = notification_day
        ) INTO already_sent;
        
        IF NOT already_sent THEN
          -- Determine notification message based on days
          IF notification_day = 0 THEN
            -- Expired today
            INSERT INTO notifications (user_id, professor_id, type, title, message, link, item_id)
            VALUES (
              profile_record.id,
              (SELECT id FROM professors LIMIT 1), -- Dummy professor ID, we'll use platform logo instead
              'platform_subscription_expired',
              'Votre abonnement a expiré',
              'Votre abonnement plateforme a expiré aujourd''hui. Renouvelez-le pour continuer à profiter de tous les avantages.',
              '/account',
              profile_record.id
            );
          ELSE
            -- Expiring soon
            INSERT INTO notifications (user_id, professor_id, type, title, message, link, item_id)
            VALUES (
              profile_record.id,
              (SELECT id FROM professors LIMIT 1), -- Dummy professor ID
              'platform_subscription_expiring',
              'Votre abonnement expire bientôt',
              'Votre abonnement plateforme expire dans ' || notification_day || ' jour' || 
                CASE WHEN notification_day > 1 THEN 's' ELSE '' END || 
                '. Renouvelez-le pour continuer à profiter de tous les avantages.',
              '/account',
              profile_record.id
            );
          END IF;
          
          -- Mark as sent
          INSERT INTO subscription_expiration_notifications_sent 
            (user_id, subscription_type, subscription_id, days_before)
          VALUES 
            (profile_record.id, 'platform', profile_record.id, notification_day)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Check professor subscriptions
  FOR prof_sub_record IN
    SELECT 
      ps.id,
      ps.user_id,
      ps.professor_id,
      ps.status,
      ps.expires_at,
      p.name as professor_name
    FROM professor_subscriptions ps
    JOIN professors p ON p.id = ps.professor_id
    WHERE ps.status = 'active'
      AND ps.expires_at IS NOT NULL
      AND ps.expires_at > now()
      AND ps.expires_at <= now() + interval '7 days'
  LOOP
    days_until_expiry := EXTRACT(DAY FROM (prof_sub_record.expires_at - now()))::integer;
    
    -- Check each notification threshold
    FOREACH notification_day IN ARRAY notification_days
    LOOP
      -- Send notification if we're at or past the threshold and haven't sent it yet
      IF days_until_expiry <= notification_day THEN
        -- Check if we already sent this notification
        SELECT EXISTS(
          SELECT 1 FROM subscription_expiration_notifications_sent
          WHERE user_id = prof_sub_record.user_id
            AND subscription_type = 'professor'
            AND subscription_id = prof_sub_record.id
            AND days_before = notification_day
        ) INTO already_sent;
        
        IF NOT already_sent THEN
          -- Determine notification message based on days
          IF notification_day = 0 THEN
            -- Expired today
            INSERT INTO notifications (user_id, professor_id, type, title, message, link, item_id)
            VALUES (
              prof_sub_record.user_id,
              prof_sub_record.professor_id,
              'professor_subscription_expired',
              'Abonnement professeur expiré',
              'Votre abonnement à ' || prof_sub_record.professor_name || ' a expiré aujourd''hui. Renouvelez-le pour continuer à accéder au contenu exclusif.',
              '/professors/' || prof_sub_record.professor_id,
              prof_sub_record.id
            );
          ELSE
            -- Expiring soon
            INSERT INTO notifications (user_id, professor_id, type, title, message, link, item_id)
            VALUES (
              prof_sub_record.user_id,
              prof_sub_record.professor_id,
              'professor_subscription_expiring',
              'Abonnement professeur expire bientôt',
              'Votre abonnement à ' || prof_sub_record.professor_name || ' expire dans ' || notification_day || ' jour' || 
                CASE WHEN notification_day > 1 THEN 's' ELSE '' END || 
                '. Renouvelez-le pour continuer à accéder au contenu exclusif.',
              '/professors/' || prof_sub_record.professor_id,
              prof_sub_record.id
            );
          END IF;
          
          -- Mark as sent
          INSERT INTO subscription_expiration_notifications_sent 
            (user_id, subscription_type, subscription_id, professor_id, days_before)
          VALUES 
            (prof_sub_record.user_id, 'professor', prof_sub_record.id, prof_sub_record.professor_id, notification_day)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (for manual testing)
GRANT EXECUTE ON FUNCTION check_and_send_expiration_notifications() TO authenticated;

-- Note: To automate this, you can:
-- 1. Use pg_cron extension (if available): 
--    SELECT cron.schedule('check-subscription-expiration', '0 9 * * *', 'SELECT check_and_send_expiration_notifications()');
-- 2. Create a Supabase Edge Function that calls this function daily
-- 3. Call it manually from your application admin panel
