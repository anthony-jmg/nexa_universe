/*
  # Add Performance Indexes for Frequently Queried Columns

  1. Purpose
    - Improve query performance by adding indexes on frequently queried columns
    - Optimize filtering and sorting operations
    - Reduce database load on common queries

  2. Indexes Added
    - programs: visibility, professor_id
    - videos: visibility, program_id, professor_id, level
    - professors: is_featured
    - events: event_status, start_date, location
    - event_ticket_types: event_id
    - event_attendees: user_id, event_id (via event_ticket_type_id), status
    - products: product_type_id, name
    - orders: user_id, status
    - order_items: order_id, product_id
    - professor_subscriptions: user_id, status, professor_id
    - video_views: user_id, video_id
    - favorites: user_id, favorite_type
    - cart_items: user_id

  3. Performance Impact
    - Faster filtering by visibility and status
    - Improved join performance on foreign keys
    - Quicker user-specific queries (favorites, orders, tickets)
    - Better event and subscription lookups
*/

CREATE INDEX IF NOT EXISTS idx_programs_visibility ON programs(visibility);
CREATE INDEX IF NOT EXISTS idx_programs_professor_id ON programs(professor_id);

CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility);
CREATE INDEX IF NOT EXISTS idx_videos_program_id ON videos(program_id);
CREATE INDEX IF NOT EXISTS idx_videos_professor_id ON videos(professor_id);
CREATE INDEX IF NOT EXISTS idx_videos_level ON videos(level);

CREATE INDEX IF NOT EXISTS idx_professors_is_featured ON professors(is_featured);

CREATE INDEX IF NOT EXISTS idx_events_event_status ON events(event_status);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location);

CREATE INDEX IF NOT EXISTS idx_event_ticket_types_event_id ON event_ticket_types(event_id);

CREATE INDEX IF NOT EXISTS idx_event_attendees_order_id ON event_attendees(order_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_ticket_type_id ON event_attendees(event_ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_status ON event_attendees(status);

CREATE INDEX IF NOT EXISTS idx_products_product_type_id ON products(product_type_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_professor_subscriptions_user_id ON professor_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_professor_subscriptions_status ON professor_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_professor_subscriptions_professor_id ON professor_subscriptions(professor_id);

CREATE INDEX IF NOT EXISTS idx_video_views_user_id ON video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON video_views(video_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_favorite_type ON favorites(favorite_type);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
