/*
# Add is_test flag to events (structural test-event distinction)

1. Context
- Public pages (Landing, Nexa Pass / Shop, Events) must never display test events.
- Until now there was no structural way to distinguish a test event; only naming
  conventions like "[TEST]" existed, which is not reliable.

2. Modified Table
- `events`: add column `is_test boolean NOT NULL DEFAULT false`.
  - false (default) = real, publicly displayable event.
  - true = test event, still fully usable by admins (tickets, tiers, Price Locks)
    but excluded from all public listings.

3. Security
- No RLS change: this is a data-level attribute used by application queries.
  Existing RLS policies on `events` remain untouched.

4. Notes
- Additive migration only: no existing column is dropped, renamed or retyped.
- Existing rows default to false (real events), so no behavior change for them.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;