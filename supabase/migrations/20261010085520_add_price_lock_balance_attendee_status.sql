/*
# Price Lock balance payment + awaiting-balance attendees

1. Plain-English summary
- A Price Lock holder pays a 20 € deposit. Until the balance is paid, that person
  must NOT be counted as a confirmed Full Pass anywhere in the app.
- This migration marks ticket-holder rows created from a Price Lock deposit with
  a dedicated status `awaiting_balance`, and adds a server function that flips
  those rows to a normal valid ticket once the full balance is confirmed.

2. Modified functions
- `convert_pending_to_actual_attendees(uuid)`: when converting a pending
  attendee whose purchase_type is 'price_lock_deposit', the created
  `event_attendees` row now gets check_in_status = 'awaiting_balance'
  instead of 'not_checked_in'. All other rows unchanged ('not_checked_in').
  The quantity_sold gate (no double counting for Price Lock) is unchanged.

3. Modified constraints (additive: only ALLOWS a new value, no data touched)
- `event_attendees.check_in_status` CHECK now also accepts 'awaiting_balance'.

4. New functions
- `complete_price_lock_attendees(p_lock_id uuid)`: called after the balance
  payment is confirmed; sets check_in_status = 'not_checked_in' (valid ticket /
  confirmed Full Pass) on every 'awaiting_balance' row of that lock's user and
  ticket type. Returns the number of rows updated.

5. Security
- `complete_price_lock_attendees` is SECURITY DEFINER with a fixed search_path;
  it is idempotent (re-running updates 0 rows).
- No RLS changes: existing policies on event_attendees and price_locks apply.

6. Notes
- Fully additive/reversible: no columns dropped, no rows modified at migration
  time. Existing 'not_checked_in' rows keep their meaning.
*/

-- 3. Allow the new status value on the existing column (additive)
ALTER TABLE event_attendees DROP CONSTRAINT event_attendees_check_in_status_check;
ALTER TABLE event_attendees ADD CONSTRAINT event_attendees_check_in_status_check
  CHECK (check_in_status IN ('not_checked_in', 'checked_in', 'cancelled', 'awaiting_balance'));

-- 2. Conversion: Price Lock deposit holders wait for their balance
CREATE OR REPLACE FUNCTION convert_pending_to_actual_attendees(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
pending_record RECORD;
total_converted integer := 0;
BEGIN
FOR pending_record IN
SELECT id, event_id, user_id, event_ticket_type_id, qr_code,
attendee_first_name, attendee_last_name, attendee_email, attendee_phone,
purchase_type
FROM pending_event_attendees
WHERE reservation_id = p_order_id
LOOP
INSERT INTO event_attendees (
event_id,
user_id,
event_ticket_type_id,
qr_code,
check_in_status,
purchased_at,
created_at,
attendee_first_name,
attendee_last_name,
attendee_email,
attendee_phone
)
VALUES (
pending_record.event_id,
pending_record.user_id,
pending_record.event_ticket_type_id,
pending_record.qr_code,
CASE
  WHEN pending_record.purchase_type = 'price_lock_deposit' THEN 'awaiting_balance'
  ELSE 'not_checked_in'
END,
now(),
now(),
pending_record.attendee_first_name,
pending_record.attendee_last_name,
pending_record.attendee_email,
pending_record.attendee_phone
);

-- A Price Lock deposit reserves its unit via the active lock:
-- the sale must not be counted twice here.
IF pending_record.purchase_type IS DISTINCT FROM 'price_lock_deposit' THEN
UPDATE event_ticket_types
SET quantity_sold = quantity_sold + 1
WHERE id = pending_record.event_ticket_type_id;
END IF;

total_converted := total_converted + 1;
END LOOP;

DELETE FROM pending_event_attendees WHERE reservation_id = p_order_id;

RETURN total_converted;
END;
$$;

-- 4. Flip awaiting-balance holders to confirmed Full Pass after balance payment
CREATE OR REPLACE FUNCTION complete_price_lock_attendees(p_lock_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_user uuid;
v_ett uuid;
v_updated integer := 0;
BEGIN
SELECT user_id, event_ticket_type_id INTO v_user, v_ett
FROM price_locks
WHERE id = p_lock_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Price Lock introuvable';
END IF;

UPDATE event_attendees
SET check_in_status = 'not_checked_in'
WHERE user_id = v_user
AND event_ticket_type_id = v_ett
AND check_in_status = 'awaiting_balance';

GET DIAGNOSTICS v_updated = ROW_COUNT;

RETURN v_updated;
END;
$$;
