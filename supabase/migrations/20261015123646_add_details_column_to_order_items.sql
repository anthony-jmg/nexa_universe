/*
# Add missing `details` column to order_items

1. Problem
- The order creation step writes, and the payment confirmation step reads, a
  `details` field on order lines (it stores the Price Lock balance payment mode:
  manual or automatic). The column was never created, so every checkout failed
  with "Failed to create order items", and confirmation would have failed too.

2. Modified Tables
- `order_items`
  - `details` (jsonb, nullable) — extra per-line metadata, e.g.
    `{"balance_payment_mode": "manual"}` for Price Lock deposits. NULL otherwise.

3. Security
- No policy changes. Existing order_items policies apply to the new column.
- Additive only; no existing data is modified.
*/

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS details jsonb;
