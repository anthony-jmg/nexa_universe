/*
  # Add Order Status Change Notifications

  1. Purpose
    - Notify users automatically when their order status changes
    - Provide real-time updates on order processing, shipping, and delivery
    - Improve customer experience with automated status notifications

  2. Changes
    - Make `professor_id` nullable to support non-professor notifications
    - Add new notification types for order status changes:
      * `order_paid` - Order has been paid
      * `order_processing` - Order is being prepared
      * `order_shipped` - Order has been shipped
      * `order_completed` - Order has been delivered
      * `order_cancelled` - Order has been cancelled

  3. Triggers
    - Auto-create notifications when order status changes
    - Only notify for meaningful status transitions (not pending)
    - Include order details in notification message

  4. Security
    - Notifications follow existing RLS policies
    - Users can only view their own order notifications
    - Only database triggers can create notifications

  5. Important Notes
    - Notifications are sent for all status changes except 'pending'
    - Each notification links to the user's purchases page
    - Messages include order number and status
*/

-- Step 1: Make professor_id nullable to support order notifications
ALTER TABLE notifications
  ALTER COLUMN professor_id DROP NOT NULL;

-- Step 2: Update the type constraint to include order notification types
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'new_video',
    'new_program',
    'order_paid',
    'order_processing',
    'order_shipped',
    'order_completed',
    'order_cancelled'
  ));

-- Step 3: Create function to notify users of order status changes
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title text;
  notification_message text;
  notification_type text;
  order_number text;
BEGIN
  -- Skip if status hasn't changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Skip pending status (no notification needed)
  IF NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- Generate order number (first 8 chars of UUID)
  order_number := SUBSTRING(NEW.id::text, 1, 8);

  -- Determine notification type, title, and message based on new status
  CASE NEW.status
    WHEN 'paid' THEN
      notification_type := 'order_paid';
      notification_title := 'Paiement confirmé';
      notification_message := 'Votre commande #' || order_number || ' a été payée avec succès. Nous préparons votre commande.';

    WHEN 'processing' THEN
      notification_type := 'order_processing';
      notification_title := 'Commande en préparation';
      notification_message := 'Votre commande #' || order_number || ' est en cours de préparation.';

    WHEN 'shipped' THEN
      notification_type := 'order_shipped';
      notification_title := 'Commande expédiée';
      notification_message := 'Votre commande #' || order_number || ' a été expédiée ! Vous devriez la recevoir prochainement.';

    WHEN 'completed' THEN
      notification_type := 'order_completed';
      notification_title := 'Commande livrée';
      notification_message := 'Votre commande #' || order_number || ' a été livrée. Merci pour votre achat !';

    WHEN 'cancelled' THEN
      notification_type := 'order_cancelled';
      notification_title := 'Commande annulée';
      notification_message := 'Votre commande #' || order_number || ' a été annulée.';

    ELSE
      -- Unknown status, skip notification
      RETURN NEW;
  END CASE;

  -- Insert notification for the user
  INSERT INTO notifications (
    user_id,
    professor_id,
    type,
    title,
    message,
    link,
    item_id
  ) VALUES (
    NEW.user_id,
    NULL, -- No professor for order notifications
    notification_type,
    notification_title,
    notification_message,
    '/my-purchases', -- Link to purchases page
    NEW.id -- Order ID
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_notify_order_status_change ON orders;
CREATE TRIGGER trigger_notify_order_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_order_status_change();
