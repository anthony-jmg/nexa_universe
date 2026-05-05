/*
  # Add stock management functions

  1. New Functions
    - `get_available_stock(p_product_id uuid)` - Returns available stock for a product
      accounting for pending reservations
    - `reserve_stock(p_product_id uuid, p_order_id uuid, p_quantity integer)` - Reserves
      stock for an order, returns true if successful

  2. Notes
    - Available stock = stock_quantity - reserved quantity from unexpired reservations
    - Reservations expire after 30 minutes
*/

CREATE OR REPLACE FUNCTION get_available_stock(p_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_stock integer;
  reserved_qty integer;
BEGIN
  SELECT stock_quantity INTO total_stock
  FROM products
  WHERE id = p_product_id;

  IF total_stock IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO reserved_qty
  FROM stock_reservations
  WHERE product_id = p_product_id
    AND expires_at > now();

  RETURN GREATEST(total_stock - reserved_qty, 0);
END;
$$;

CREATE OR REPLACE FUNCTION reserve_stock(p_product_id uuid, p_order_id uuid, p_quantity integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  available integer;
BEGIN
  available := get_available_stock(p_product_id);

  IF available < p_quantity THEN
    RETURN false;
  END IF;

  INSERT INTO stock_reservations (reservation_id, product_id, quantity, expires_at)
  VALUES (p_order_id, p_product_id, p_quantity, now() + interval '30 minutes');

  RETURN true;
END;
$$;
