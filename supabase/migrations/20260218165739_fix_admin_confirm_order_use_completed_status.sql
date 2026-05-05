/*
  # Fix admin_confirm_order_payment to use correct status value

  The orders table status check constraint allows:
  pending, processing, completed, cancelled, failed
  
  The webhook was trying to set 'paid' which is invalid.
  This fixes the function and also updates the webhook's expected status.
*/

CREATE OR REPLACE FUNCTION admin_confirm_order_payment(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_converted integer;
BEGIN
  SELECT id, status, user_id FROM orders WHERE id = p_order_id INTO v_order;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already completed', 'converted', 0);
  END IF;

  UPDATE orders SET status = 'completed' WHERE id = p_order_id;

  PERFORM release_stock_reservation(p_order_id);

  SELECT convert_pending_to_actual_attendees(p_order_id) INTO v_converted;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'tickets_converted', v_converted
  );
END;
$$;
