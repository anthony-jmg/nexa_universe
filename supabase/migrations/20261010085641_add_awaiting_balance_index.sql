/*
# Index awaiting-balance attendees

1. Plain-English summary
- Adds one index to speed up the lookup used when a Price Lock balance is paid
  (find the holders waiting for their balance for a given user and ticket type).

2. Indexes
- `event_attendees_user_status_ticket_idx` on `event_attendees (user_id, check_in_status, event_ticket_type_id)`.

3. Security
- None (index only). Fully additive.
*/

CREATE INDEX IF NOT EXISTS event_attendees_user_status_ticket_idx
  ON event_attendees (user_id, check_in_status, event_ticket_type_id);
