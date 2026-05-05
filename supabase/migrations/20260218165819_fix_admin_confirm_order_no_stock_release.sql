/*
  # Fix admin_confirm_order_payment - remove non-existent function call

  The release_stock_reservation function does not exist in this schema.
  Removing that call so the function works correctly.
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

  SELECT convert_pending_to_actual_attendees(p_order_id) INTO v_converted;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'tickets_converted', v_converted
  );
END;
$$;
