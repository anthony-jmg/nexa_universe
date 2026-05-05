/*
  # Setup pg_cron for automatic stock cleanup and expired order cancellation

  ## Changes

  1. Extensions
    - Enable `pg_cron` for scheduled job execution

  2. New Functions
    - `cancel_expired_orders()` - Cancels pending orders that have passed their expiry time
      and releases their stock reservations
    - Updated `cleanup_expired_reservations()` - Returns count of deleted rows

  3. Scheduled Jobs (via pg_cron)
    - Every 10 minutes: cleanup expired stock reservations
    - Every 10 minutes: cancel expired pending orders

  ## Notes
    - pg_cron jobs run in the `pg_cron` schema under the postgres role
    - Expired orders are those with status = 'pending' and expires_at < now()
    - Stock reservations older than 30 minutes are cleaned up automatically
    - Both jobs run together every 10 minutes to keep data consistent
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.cancel_expired_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_order_id uuid;
BEGIN
  FOR v_order_id IN
    SELECT id FROM orders
    WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < now()
  LOOP
    UPDATE orders SET status = 'cancelled' WHERE id = v_order_id;
    PERFORM release_stock_reservation(v_order_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM stock_reservations
  WHERE expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

SELECT cron.schedule(
  'cleanup-expired-stock-reservations',
  '*/10 * * * *',
  $$SELECT public.cleanup_expired_reservations()$$
);

SELECT cron.schedule(
  'cancel-expired-orders',
  '*/10 * * * *',
  $$SELECT public.cancel_expired_orders()$$
);
