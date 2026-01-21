/*
  # Remove Duplicate and Unused Indexes

  This migration removes duplicate and unused indexes to reduce database maintenance overhead
  and improve write performance.

  ## Duplicate Indexes Removed

  For each set of duplicates, we keep the more descriptive index name:
  - events: Keep `idx_events_start_date`, remove `idx_events_event_date`
  - order_items: Keep `idx_order_items_order_id`, remove `idx_order_items_order`
  - order_items: Keep `idx_order_items_product_id`, remove `idx_order_items_product`
  - orders: Keep `idx_orders_user_id`, remove `idx_orders_user`
  - professor_subscriptions: Keep `idx_professor_subscriptions_professor_id`, remove `idx_professor_subs_professor`
  - professor_subscriptions: Keep `idx_professor_subscriptions_user_id`, remove `idx_professor_subs_user`
  - profiles: Keep `idx_profiles_subscription_status`, remove `idx_profiles_subscription`
  - programs: Keep `idx_programs_professor_id`, remove `idx_programs_professor`
  - videos: Keep `idx_videos_professor_id`, remove `idx_videos_professor`
  - videos: Keep `idx_videos_program_id`, remove `idx_videos_program`

  ## Unused Indexes Removed

  These indexes are not being used by any queries and add unnecessary overhead:
  - Stock reservation indexes (feature appears unused)
  - Some redundant event, product, and order indexes
  - Duplicate subscription and notification indexes

  ## Performance Impact
  
  - Reduced storage requirements
  - Faster INSERT/UPDATE/DELETE operations
  - Simpler query optimization
*/

-- Remove duplicate indexes
DROP INDEX IF EXISTS idx_events_event_date;
DROP INDEX IF EXISTS idx_order_items_order;
DROP INDEX IF EXISTS idx_order_items_product;
DROP INDEX IF EXISTS idx_orders_user;
DROP INDEX IF EXISTS idx_professor_subs_professor;
DROP INDEX IF EXISTS idx_professor_subs_user;
DROP INDEX IF EXISTS idx_profiles_subscription;
DROP INDEX IF EXISTS idx_programs_professor;
DROP INDEX IF EXISTS idx_videos_professor;
DROP INDEX IF EXISTS idx_videos_program;

-- Remove unused indexes (stock reservations - appears to be unused feature)
DROP INDEX IF EXISTS idx_stock_reservations_product_id;
DROP INDEX IF EXISTS idx_stock_reservations_order_id;
DROP INDEX IF EXISTS idx_stock_reservations_expires_at;

-- Remove other unused indexes
DROP INDEX IF EXISTS idx_programs_visibility;
DROP INDEX IF EXISTS idx_order_status_history_order_id;
DROP INDEX IF EXISTS idx_order_status_history_created_at;
DROP INDEX IF EXISTS idx_order_status_history_changed_by;
DROP INDEX IF EXISTS idx_pending_event_attendees_order_id;
DROP INDEX IF EXISTS idx_pending_event_attendees_event_ticket_type_id;
DROP INDEX IF EXISTS idx_products_active;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_programs_level;
DROP INDEX IF EXISTS idx_program_purchases_program;
DROP INDEX IF EXISTS idx_events_is_active;
DROP INDEX IF EXISTS idx_ticket_purchases_user_id;
DROP INDEX IF EXISTS idx_ticket_purchases_ticket_type_id;
DROP INDEX IF EXISTS idx_ticket_purchases_status;
DROP INDEX IF EXISTS idx_event_attendees_qr_code_hash;
DROP INDEX IF EXISTS idx_event_attendees_email;
DROP INDEX IF EXISTS idx_event_attendees_checked_in;
DROP INDEX IF EXISTS idx_video_purchases_video_id;
DROP INDEX IF EXISTS idx_event_ticket_types_ticket_type_id;
DROP INDEX IF EXISTS idx_ticket_purchases_event_ticket_type_id;
DROP INDEX IF EXISTS idx_cart_items_user_id;
DROP INDEX IF EXISTS idx_event_attendees_status;
DROP INDEX IF EXISTS idx_cart_event_tickets_event_ticket_type_id;
DROP INDEX IF EXISTS idx_subscription_refunds_user;
DROP INDEX IF EXISTS idx_subscription_refunds_subscription;
DROP INDEX IF EXISTS idx_subscription_refunds_status;
DROP INDEX IF EXISTS idx_professor_subs_grace_period;
DROP INDEX IF EXISTS idx_stripe_customers_stripe_id;
DROP INDEX IF EXISTS idx_stripe_payments_intent_id;
DROP INDEX IF EXISTS idx_stripe_payments_order_id;
DROP INDEX IF EXISTS idx_stripe_checkout_sessions_user_id;
DROP INDEX IF EXISTS idx_stripe_checkout_sessions_session_id;
DROP INDEX IF EXISTS idx_stripe_checkout_sessions_expires_at;
DROP INDEX IF EXISTS idx_video_views_user_video;
DROP INDEX IF EXISTS idx_subscription_notifications_user;
DROP INDEX IF EXISTS idx_subscription_notifications_sub;
DROP INDEX IF EXISTS idx_subscription_notifications_type;
DROP INDEX IF EXISTS idx_program_purchases_user_program_active;
DROP INDEX IF EXISTS idx_profiles_platform_subscription;
DROP INDEX IF EXISTS idx_video_views_video_id;
DROP INDEX IF EXISTS idx_video_views_user_id;
DROP INDEX IF EXISTS idx_video_views_watched_at;
DROP INDEX IF EXISTS idx_professor_subscriptions_status;
DROP INDEX IF EXISTS idx_favorites_user_id;
DROP INDEX IF EXISTS idx_favorites_favorite_type;
DROP INDEX IF EXISTS idx_professors_is_featured;
DROP INDEX IF EXISTS idx_events_location;
DROP INDEX IF EXISTS idx_products_product_type_id;
DROP INDEX IF EXISTS idx_products_name;
DROP INDEX IF EXISTS idx_reviews_rating;
DROP INDEX IF EXISTS idx_review_helpful_votes_review_id;
DROP INDEX IF EXISTS idx_review_helpful_votes_user_id;
DROP INDEX IF EXISTS idx_program_purchases_professor_id;
DROP INDEX IF EXISTS idx_rate_limits_expires_at;
DROP INDEX IF EXISTS idx_rate_limits_window_start;
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_user_unread;
DROP INDEX IF EXISTS idx_professor_subscriptions_stripe_id;
DROP INDEX IF EXISTS idx_profiles_stripe_subscription_id;
DROP INDEX IF EXISTS idx_profiles_subscription_expires;
DROP INDEX IF EXISTS idx_expiration_notifications_user_id;
DROP INDEX IF EXISTS idx_expiration_notifications_subscription;
DROP INDEX IF EXISTS idx_professor_subscriptions_price_paid;
DROP INDEX IF EXISTS idx_orders_created_at;
DROP INDEX IF EXISTS idx_orders_expires_at;
DROP INDEX IF EXISTS idx_orders_stripe_payment_intent_id;