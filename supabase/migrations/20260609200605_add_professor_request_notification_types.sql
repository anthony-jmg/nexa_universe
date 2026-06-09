ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'new_video',
    'new_program',
    'platform_subscription_expiring',
    'professor_subscription_expiring',
    'platform_subscription_expired',
    'professor_subscription_expired',
    'order_paid',
    'order_processing',
    'order_shipped',
    'order_completed',
    'order_cancelled',
    'professor_approved',
    'professor_rejected'
  ));
