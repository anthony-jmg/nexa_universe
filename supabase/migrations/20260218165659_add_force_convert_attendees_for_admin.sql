/*
  # Add admin function to force convert pending attendees

  This migration adds a helper function that allows admins to manually
  mark an order as paid and convert its pending attendees to actual tickets.
  This is needed when the Stripe webhook fails silently.

  1. New Functions
    - `admin_confirm_order_payment` - marks order as paid and converts pending attendees
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
  v_result jsonb;
BEGIN
  SELECT id, status, user_id FROM orders WHERE id = p_order_id INTO v_order;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already paid', 'converted', 0);
  END IF;

  UPDATE orders SET status = 'paid' WHERE id = p_order_id;

  PERFORM release_stock_reservation(p_order_id);

  SELECT convert_pending_to_actual_attendees(p_order_id) INTO v_converted;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'tickets_converted', v_converted
  );
END;
$$;
