/*
# Widen cart_event_tickets uniqueness to include purchase_type

1. Context
- The cart table `cart_event_tickets` previously enforced
  UNIQUE (user_id, event_ticket_type_id), added in an earlier migration.
- With the new purchase modes (full_purchase vs price_lock_deposit), the same
  user must be able to hold the SAME ticket type twice: once as a Price Lock
  deposit and once as a full purchase, as two separate cart lines.
- The old constraint made this impossible and raised
  "duplicate key value violates unique constraint
  cart_event_tickets_user_id_event_ticket_type_id_key" on the second insert.

2. Constraint change (additive/corrective only, no data loss)
- DROP the old UNIQUE (user_id, event_ticket_type_id) constraint.
- ADD UNIQUE (user_id, event_ticket_type_id, purchase_type):
  - ALLOWED: same user + same ticket type as price_lock_deposit AND as
    full_purchase (two distinct rows).
  - BLOCKED: two identical rows with the same (user, ticket type,
    purchase_type) combination.
- Pre-checked before applying: zero existing rows violate the new rule, so no
  data cleanup or loss was needed. All existing cart rows are preserved.
- Old rows without an explicit purchase_type keep their default
  'full_purchase' value, unchanged.

3. Business rules NOT changed
- Price Lock quantity stays forced to 1 (frontend + server-side validation,
  unchanged).
- The "1 Price Lock per user per event" rule remains enforced separately by
  the order validation edge function; this migration does not alter it.

4. Security
- No RLS or privilege change; row level security policies on the table are
  untouched.
*/

ALTER TABLE public.cart_event_tickets
  DROP CONSTRAINT cart_event_tickets_user_id_event_ticket_type_id_key;

ALTER TABLE public.cart_event_tickets
  ADD CONSTRAINT cart_event_tickets_user_id_event_ticket_type_id_purchase_type_key
  UNIQUE (user_id, event_ticket_type_id, purchase_type);