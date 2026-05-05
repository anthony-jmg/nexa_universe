/*
  # Fix reviews trigger column names

  ## Problem
  The `verify_purchase_on_review` trigger function references old column names
  `item_type` and `item_id` that were renamed to `reviewable_type` and `reviewable_id`.
  This causes a "Could not find the 'item_id' column" error on every review insert.

  ## Changes
  - Update `verify_purchase_on_review` function to use correct column names
    (`reviewable_type` and `reviewable_id` instead of `item_type` and `item_id`)
  - Recreate the trigger to pick up the updated function
*/

CREATE OR REPLACE FUNCTION verify_purchase_on_review()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reviewable_type = 'video' THEN
    NEW.is_verified_purchase := EXISTS (
      SELECT 1 FROM video_purchases
      WHERE user_id = NEW.user_id
      AND video_id = NEW.reviewable_id
      AND status = 'active'
    );
  ELSIF NEW.reviewable_type = 'program' THEN
    NEW.is_verified_purchase := EXISTS (
      SELECT 1 FROM program_purchases
      WHERE user_id = NEW.user_id
      AND program_id = NEW.reviewable_id
      AND status = 'active'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS verify_purchase_before_review ON reviews;

CREATE TRIGGER verify_purchase_before_review
BEFORE INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION verify_purchase_on_review();
