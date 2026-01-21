/*
  # Fix Function Search Paths

  This migration sets explicit search paths for all functions to prevent security
  vulnerabilities from role-mutable search paths.

  ## Security Impact

  Setting an explicit search_path prevents malicious users from creating objects
  in schemas earlier in the search path to intercept function calls.

  ## Functions Fixed

  All database functions now use an explicit `search_path = public, pg_catalog`
*/

-- Helper functions
ALTER FUNCTION generate_purchase_code() SET search_path = public, pg_catalog;
ALTER FUNCTION set_purchase_code() SET search_path = public, pg_catalog;
ALTER FUNCTION generate_qr_code_hash(uuid, text, text, text, uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION set_video_view_professor_id() SET search_path = public, pg_catalog;

-- Trigger functions
ALTER FUNCTION update_cart_items_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION update_event_attendees_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION update_review_helpful_count() SET search_path = public, pg_catalog;
ALTER FUNCTION update_orders_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION update_program_duration() SET search_path = public, pg_catalog;
ALTER FUNCTION update_cart_event_tickets_updated_at() SET search_path = public, pg_catalog;

-- Subscription and purchase validation
ALTER FUNCTION is_within_withdrawal_period(timestamptz) SET search_path = public, pg_catalog;
ALTER FUNCTION is_platform_subscription_active(profiles) SET search_path = public, pg_catalog;
ALTER FUNCTION is_professor_subscription_active(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION verify_purchase_on_review() SET search_path = public, pg_catalog;
ALTER FUNCTION user_has_platform_subscription(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION user_has_professor_subscription(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION user_has_program_purchase(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION user_has_video_purchase(uuid, uuid) SET search_path = public, pg_catalog;

-- Event management
ALTER FUNCTION check_in_attendee(text) SET search_path = public, pg_catalog;
ALTER FUNCTION validate_event_attendee() SET search_path = public, pg_catalog;
ALTER FUNCTION get_event_attendee_stats(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION convert_pending_to_actual_attendees(uuid) SET search_path = public, pg_catalog;

-- Cleanup functions
ALTER FUNCTION cleanup_expired_rate_limits() SET search_path = public, pg_catalog;
ALTER FUNCTION schedule_rate_limit_cleanup() SET search_path = public, pg_catalog;
ALTER FUNCTION cleanup_expired_orders() SET search_path = public, pg_catalog;
ALTER FUNCTION cleanup_expired_reservations() SET search_path = public, pg_catalog;
ALTER FUNCTION cleanup_expired_checkout_sessions() SET search_path = public, pg_catalog;

-- Stock management
ALTER FUNCTION get_available_stock(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION reserve_stock(uuid, uuid, integer) SET search_path = public, pg_catalog;
ALTER FUNCTION release_stock_reservation(uuid) SET search_path = public, pg_catalog;

-- Notifications
ALTER FUNCTION get_unread_notification_count(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION mark_all_notifications_read(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION check_and_send_expiration_notifications() SET search_path = public, pg_catalog;
ALTER FUNCTION notify_order_status_change() SET search_path = public, pg_catalog;
ALTER FUNCTION notify_followers_new_video() SET search_path = public, pg_catalog;
ALTER FUNCTION notify_followers_new_program() SET search_path = public, pg_catalog;

-- Order management
ALTER FUNCTION log_order_status_change() SET search_path = public, pg_catalog;
ALTER FUNCTION get_order_timeline(uuid) SET search_path = public, pg_catalog;

-- Withdrawal and refund
ALTER FUNCTION check_and_waive_platform_withdrawal_right(uuid, text) SET search_path = public, pg_catalog;
ALTER FUNCTION check_and_waive_professor_withdrawal_right(uuid, uuid, text) SET search_path = public, pg_catalog;
ALTER FUNCTION calculate_platform_refund_amount(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION calculate_professor_refund_amount(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION auto_waive_on_program_purchase() SET search_path = public, pg_catalog;
ALTER FUNCTION auto_waive_on_video_purchase() SET search_path = public, pg_catalog;

-- Validation and stats
ALTER FUNCTION validate_program_consistency(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION get_professor_program_stats(uuid) SET search_path = public, pg_catalog;

-- Admin and auth
ALTER FUNCTION user_is_admin(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION handle_new_user() SET search_path = public, pg_catalog;