/*
  # Add Missing Foreign Key Indexes for Performance

  This migration adds indexes to all foreign key columns that were missing them,
  which significantly improves query performance for joins and foreign key lookups.

  ## New Indexes Added

  1. **cart_items**
     - `idx_cart_items_product_id` on `product_id`

  2. **event_attendees**
     - `idx_event_attendees_checked_in_by` on `checked_in_by`

  3. **events**
     - `idx_events_created_by` on `created_by`

  4. **favorites**
     - `idx_favorites_professor_id_fk` on `professor_id`
     - `idx_favorites_program_id_fk` on `program_id`
     - `idx_favorites_video_id_fk` on `video_id`

  5. **notifications**
     - `idx_notifications_professor_id_fk` on `professor_id`

  6. **products**
     - `idx_products_product_size_id_fk` on `product_size_id`

  7. **stripe_payments**
     - `idx_stripe_payments_subscription_id_fk` on `subscription_id`
     - `idx_stripe_payments_video_purchase_id_fk` on `video_purchase_id`

  8. **subscription_expiration_notifications_sent**
     - `idx_sub_exp_notif_professor_id` on `professor_id`

  ## Performance Impact
  
  These indexes will improve query performance when:
  - Joining tables on foreign keys
  - Filtering by foreign key relationships
  - Enforcing referential integrity
*/

-- cart_items
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id_fk 
ON cart_items(product_id);

-- event_attendees
CREATE INDEX IF NOT EXISTS idx_event_attendees_checked_in_by_fk 
ON event_attendees(checked_in_by);

-- events
CREATE INDEX IF NOT EXISTS idx_events_created_by_fk 
ON events(created_by);

-- favorites
CREATE INDEX IF NOT EXISTS idx_favorites_professor_id_fk 
ON favorites(professor_id);

CREATE INDEX IF NOT EXISTS idx_favorites_program_id_fk 
ON favorites(program_id);

CREATE INDEX IF NOT EXISTS idx_favorites_video_id_fk 
ON favorites(video_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_professor_id_fk 
ON notifications(professor_id);

-- products
CREATE INDEX IF NOT EXISTS idx_products_product_size_id_fk 
ON products(product_size_id);

-- stripe_payments
CREATE INDEX IF NOT EXISTS idx_stripe_payments_subscription_id_fk 
ON stripe_payments(subscription_id);

CREATE INDEX IF NOT EXISTS idx_stripe_payments_video_purchase_id_fk 
ON stripe_payments(video_purchase_id);

-- subscription_expiration_notifications_sent
CREATE INDEX IF NOT EXISTS idx_sub_exp_notif_professor_id_fk 
ON subscription_expiration_notifications_sent(professor_id);