/*
# Purchase modes for event tickets in the cart (cash purchase / Price Lock)

1. Purpose
- Allows the cart to distinguish two purchase modes for an event ticket:
  - `full_purchase`: classic full-payment purchase.
  - `price_lock_deposit`: first Price Lock instalment (only the deposit is
    charged today, the balance will be paid later).
- Fully additive migration: no column is deleted or modified, existing data
  (old carts, old orders, old attendees, existing Price Locks) remains valid.

2. Modified tables
- `cart_event_tickets`
  - `purchase_type` (text, NOT NULL, default `full_purchase`): purchase mode.
    Old rows therefore remain "cash purchases" by default.
  - `price_snapshot` (numeric, nullable): ticket price at the time of adding
    to the cart (locked price in the case of a Price Lock).
  - `deposit_amount` (numeric, nullable): instalment amount (Price Lock only).
  - `amount_due_now` (numeric, nullable): amount to actually pay today per
    unit (full price for a cash purchase, deposit only for a Price Lock).
  - Unique index on (user_id, event_ticket_type_id, purchase_type): prevents
    duplicates of the same line in the cart.
- `order_items`
  - `purchase_type` (text, nullable): purchase mode of the line (NULL = old
    lines and cash purchases, `price_lock_deposit` = instalment line).
  - `locked_price_snapshot` (numeric, nullable): price locked at the time of
    ordering.
  - `deposit_amount` (numeric, nullable): confirmed instalment amount.
- `pending_event_attendees`
  - `purchase_type` (text, NOT NULL, default `full_purchase`): each pending
    ticket knows its mode, to know after payment whether the sale should be
    counted in `quantity_sold` (a Price Lock reserves its unit via the active
    lock, not via quantity_sold).
- `price_locks`
  - `order_item_id` (uuid, nullable, FK to order_items): minimal link between
    a Price Lock and the order line of the instalment that created it. The
    holder's information remains in `event_attendees` (no duplication).

3. Updated function
- `convert_pending_to_actual_attendees(p_order_id)`: unchanged behavior for
  cash purchases (attendee creation + quantity_sold increment). For a pending
  ticket in `price_lock_deposit` mode, the attendee is created but quantity_sold
  is NOT incremented: the unit is already reserved by the active Price Lock.
  This prevents the same unit from being counted twice in the quota.

4. Security
- No change to RLS: existing policies remain in effect. The added columns
  inherit the existing table protections.

5. Important notes
- No Price Lock is created in this migration: a lock is only ever created
  after confirmation of Stripe payment (existing webhook).
- Old cart items are automatically treated as `full_purchase`.
*/

-- ============================================================================
-- CART_EVENT_TICKETS : purchase mode + price snapshots
-- ============================================================================

ALTER TABLE cart_event_tickets
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'full_purchase';

ALTER TABLE cart_event_tickets
  ADD COLUMN IF NOT EXISTS price_snapshot numeric;

ALTER TABLE cart_event_tickets
  ADD COLUMN IF NOT EXISTS deposit_amount numeric;

ALTER TABLE cart_event_tickets
  ADD COLUMN IF NOT EXISTS amount_due_now numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cart_event_tickets_purchase_type_check'
  ) THEN
    ALTER TABLE cart_event_tickets
      ADD CONSTRAINT cart_event_tickets_purchase_type_check
      CHECK (purchase_type IN ('full_purchase', 'price_lock_deposit'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cart_event_tickets_user_ticket_mode_unique
  ON cart_event_tickets (user_id, event_ticket_type_id, purchase_type);

-- ============================================================================
-- ORDER_ITEMS : purchase mode + Price Lock snapshots
-- ============================================================================

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS purchase_type text;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS locked_price_snapshot numeric;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS deposit_amount numeric;

-- ============================================================================
-- PENDING_EVENT_ATTENDEES : purchase mode per pending ticket
-- ============================================================================

ALTER TABLE pending_event_attendees
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'full_purchase';

-- ============================================================================
-- PRICE_LOCKS : minimal link to the order line of the instalment
-- ============================================================================

ALTER TABLE price_locks
  ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES order_items(id);

-- ============================================================================
-- CONVERT_PENDING_TO_ACTUAL_ATTENDEES : per-mode stock counting
-- ============================================================================

CREATE OR REPLACE FUNCTION public.convert_pending_to_actual_attendees(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      'not_checked_in',
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

COMMENT ON FUNCTION convert_pending_to_actual_attendees(uuid) IS
  'Converts pending event attendees to actual attendees after payment. Price lock deposits reserve their unit via the active lock (no quantity_sold increment). Returns number of tickets created.';
