/*
  # Add Subscriber Discount System

  ## Overview
  This migration adds a discount system where professors can offer percentage 
  discounts to their subscribers on paid programs and videos.

  ## Changes

  ### 1. professors table
  - Add `subscriber_discount_percentage` (integer) - Discount percentage for subscribers (0-100)

  ## Important Notes
  1. Subscribers get the discount percentage off the regular price
  2. Free content remains free for everyone
  3. Subscribers-only content remains accessible only to subscribers
  4. Paid content shows reduced price for subscribers
  5. Default discount is 0% (no discount)
*/

-- Add subscriber discount percentage to professors table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professors' AND column_name = 'subscriber_discount_percentage'
  ) THEN
    ALTER TABLE professors 
    ADD COLUMN subscriber_discount_percentage integer DEFAULT 0 CHECK (subscriber_discount_percentage >= 0 AND subscriber_discount_percentage <= 100);
  END IF;
END $$;

-- Update existing professors to have 0% discount by default
UPDATE professors SET subscriber_discount_percentage = 0 WHERE subscriber_discount_percentage IS NULL;