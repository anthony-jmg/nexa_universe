export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'student' | 'professor' | 'admin'
          platform_subscription_status: 'active' | 'inactive' | 'trial'
          platform_subscription_expires_at: string | null
          platform_subscription_price_paid: number
          stripe_subscription_id: string | null
          stripe_price_id: string | null
          subscription_cancel_at_period_end: boolean
          avatar_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          role?: 'student' | 'professor' | 'admin'
          platform_subscription_status?: 'active' | 'inactive' | 'trial'
          platform_subscription_expires_at?: string | null
          platform_subscription_price_paid?: number
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          subscription_cancel_at_period_end?: boolean
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'student' | 'professor' | 'admin'
          platform_subscription_status?: 'active' | 'inactive' | 'trial'
          platform_subscription_expires_at?: string | null
          platform_subscription_price_paid?: number
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          subscription_cancel_at_period_end?: boolean
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      professors: {
        Row: {
          id: string
          bio: string
          specialties: string[]
          experience_years: number
          profile_video_url: string
          is_featured: boolean
          is_founder: boolean
          subscription_price: number
          subscriber_discount_percentage: number
          badge_type: 'founder' | 'featured' | null
          created_at: string
        }
        Insert: {
          id: string
          bio?: string
          specialties?: string[]
          experience_years?: number
          profile_video_url?: string
          is_featured?: boolean
          is_founder?: boolean
          subscription_price?: number
          subscriber_discount_percentage?: number
          badge_type?: 'founder' | 'featured' | null
          created_at?: string
        }
        Update: {
          id?: string
          bio?: string
          specialties?: string[]
          experience_years?: number
          profile_video_url?: string
          is_featured?: boolean
          is_founder?: boolean
          subscription_price?: number
          subscriber_discount_percentage?: number
          badge_type?: 'founder' | 'featured' | null
          created_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          title: string
          description: string
          level: 'beginner' | 'intermediate' | 'advanced'
          duration_minutes: number
          video_url: string
          thumbnail_url: string
          order_index: number
          professor_id: string | null
          program_id: string | null
          program_order_index: number
          category: 'lesson' | 'single' | null
          price: number
          visibility: 'public' | 'platform' | 'paid' | 'private' | 'subscribers_only'
          cloudflare_video_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          level: 'beginner' | 'intermediate' | 'advanced'
          duration_minutes?: number
          video_url?: string
          thumbnail_url?: string
          order_index?: number
          professor_id?: string | null
          program_id?: string | null
          program_order_index?: number
          category?: 'lesson' | 'single' | null
          price?: number
          visibility?: 'public' | 'platform' | 'paid' | 'private' | 'subscribers_only'
          cloudflare_video_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          level?: 'beginner' | 'intermediate' | 'advanced'
          duration_minutes?: number
          video_url?: string
          thumbnail_url?: string
          order_index?: number
          professor_id?: string | null
          program_id?: string | null
          program_order_index?: number
          category?: 'lesson' | 'single' | null
          price?: number
          visibility?: 'public' | 'platform' | 'paid' | 'private' | 'subscribers_only'
          cloudflare_video_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      programs: {
        Row: {
          id: string
          title: string
          description: string
          level: 'beginner' | 'intermediate' | 'advanced'
          professor_id: string
          price: number
          thumbnail_url: string
          duration_total_minutes: number
          is_active: boolean
          order_index: number
          visibility: 'public' | 'platform' | 'paid' | 'private' | 'subscribers_only'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          level?: 'beginner' | 'intermediate' | 'advanced'
          professor_id: string
          price?: number
          thumbnail_url?: string
          duration_total_minutes?: number
          is_active?: boolean
          order_index?: number
          visibility?: 'public' | 'platform' | 'paid' | 'private' | 'subscribers_only'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          level?: 'beginner' | 'intermediate' | 'advanced'
          professor_id?: string
          price?: number
          thumbnail_url?: string
          duration_total_minutes?: number
          is_active?: boolean
          order_index?: number
          visibility?: 'public' | 'platform' | 'paid' | 'private' | 'subscribers_only'
          created_at?: string
          updated_at?: string
        }
      }
      program_purchases: {
        Row: {
          id: string
          user_id: string
          program_id: string
          professor_id: string | null
          price_paid: number
          status: 'active' | 'refunded' | 'expired'
          purchased_at: string
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          program_id: string
          professor_id?: string | null
          price_paid?: number
          status?: 'active' | 'refunded' | 'expired'
          purchased_at?: string
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          program_id?: string
          professor_id?: string | null
          price_paid?: number
          status?: 'active' | 'refunded' | 'expired'
          purchased_at?: string
          expires_at?: string | null
          created_at?: string
        }
      }
      video_purchases: {
        Row: {
          id: string
          user_id: string
          video_id: string
          amount_paid: number
          status: 'active' | 'refunded' | 'expired'
          purchased_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          amount_paid: number
          status?: 'active' | 'refunded' | 'expired'
          purchased_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          amount_paid?: number
          status?: 'active' | 'refunded' | 'expired'
          purchased_at?: string
        }
      }
      professor_subscriptions: {
        Row: {
          id: string
          user_id: string
          professor_id: string
          status: 'active' | 'inactive' | 'cancelled'
          price_paid: number
          stripe_subscription_id: string | null
          started_at: string
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          professor_id: string
          status?: 'active' | 'inactive' | 'cancelled'
          price_paid?: number
          stripe_subscription_id?: string | null
          started_at?: string
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          professor_id?: string
          status?: 'active' | 'inactive' | 'cancelled'
          price_paid?: number
          stripe_subscription_id?: string | null
          started_at?: string
          expires_at?: string | null
          created_at?: string
        }
      }
      video_views: {
        Row: {
          id: string
          user_id: string
          video_id: string
          progress_percentage: number
          completed: boolean
          view_count: number
          last_watched_at: string
          created_at: string
          updated_at: string
          last_position_seconds: number
          watch_duration_seconds: number
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          progress_percentage?: number
          completed?: boolean
          view_count?: number
          last_watched_at?: string
          created_at?: string
          updated_at?: string
          last_position_seconds?: number
          watch_duration_seconds?: number
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          progress_percentage?: number
          completed?: boolean
          view_count?: number
          last_watched_at?: string
          created_at?: string
          updated_at?: string
          last_position_seconds?: number
          watch_duration_seconds?: number
        }
      }
      events: {
        Row: {
          id: string
          title: string
          description: string
          location: string
          start_date: string
          end_date: string | null
          image_url: string
          is_active: boolean
          event_status: 'draft' | 'published' | 'cancelled' | 'completed'
          created_by: string | null
          max_attendees: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          location?: string
          start_date: string
          end_date?: string | null
          image_url?: string
          is_active?: boolean
          event_status?: 'draft' | 'published' | 'cancelled' | 'completed'
          created_by?: string | null
          max_attendees?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          location?: string
          start_date?: string
          end_date?: string | null
          image_url?: string
          is_active?: boolean
          event_status?: 'draft' | 'published' | 'cancelled' | 'completed'
          created_by?: string | null
          max_attendees?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      ticket_types: {
        Row: {
          id: string
          name: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          created_at?: string
        }
      }
      event_ticket_types: {
        Row: {
          id: string
          event_id: string
          ticket_type_id: string
          price: number
          member_price: number
          quantity_available: number | null
          quantity_sold: number
          max_per_order: number
          sales_start_date: string | null
          sales_end_date: string | null
          features: Json
          is_active: boolean
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          ticket_type_id: string
          price?: number
          member_price?: number
          quantity_available?: number | null
          quantity_sold?: number
          max_per_order?: number
          sales_start_date?: string | null
          sales_end_date?: string | null
          features?: Json
          is_active?: boolean
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          ticket_type_id?: string
          price?: number
          member_price?: number
          quantity_available?: number | null
          quantity_sold?: number
          max_per_order?: number
          sales_start_date?: string | null
          sales_end_date?: string | null
          features?: Json
          is_active?: boolean
          display_order?: number
          created_at?: string
        }
      }
      ticket_purchases: {
        Row: {
          id: string
          user_id: string
          ticket_type_id: string
          event_ticket_type_id: string | null
          quantity: number
          unit_price: number
          total_price: number
          status: 'pending' | 'confirmed' | 'cancelled' | 'refunded'
          purchase_code: string | null
          attendee_info: Json
          purchased_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ticket_type_id: string
          event_ticket_type_id?: string | null
          quantity?: number
          unit_price: number
          total_price: number
          status?: 'pending' | 'confirmed' | 'cancelled' | 'refunded'
          purchase_code?: string | null
          attendee_info?: Json
          purchased_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ticket_type_id?: string
          event_ticket_type_id?: string | null
          quantity?: number
          unit_price?: number
          total_price?: number
          status?: 'pending' | 'confirmed' | 'cancelled' | 'refunded'
          purchase_code?: string | null
          attendee_info?: Json
          purchased_at?: string
          created_at?: string
        }
      }
      event_attendees: {
        Row: {
          id: string
          event_id: string
          user_id: string
          event_ticket_type_id: string | null
          qr_code: string
          check_in_status: string
          checked_in_at: string | null
          checked_in_by: string | null
          purchased_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          event_ticket_type_id?: string | null
          qr_code: string
          check_in_status?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          purchased_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          event_ticket_type_id?: string | null
          qr_code?: string
          check_in_status?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          purchased_at?: string | null
          created_at?: string | null
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          product_type_id: string | null
          image_url: string | null
          stock_quantity: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price?: number
          product_type_id?: string | null
          image_url?: string | null
          stock_quantity?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          product_type_id?: string | null
          image_url?: string | null
          stock_quantity?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      product_types: {
        Row: {
          id: string
          name: string
          sizes: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          sizes?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          sizes?: string[] | null
          created_at?: string
        }
      }
      cart_items: {
        Row: {
          id: string
          user_id: string
          product_id: string
          quantity: number
          selected_size: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          quantity?: number
          selected_size?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          quantity?: number
          selected_size?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cart_event_tickets: {
        Row: {
          id: string
          user_id: string
          event_ticket_type_id: string
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_ticket_type_id: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_ticket_type_id?: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          user_id: string
          status: 'pending' | 'paid' | 'processing' | 'shipped' | 'completed' | 'cancelled'
          total_amount: number
          is_member_order: boolean
          shipping_name: string
          shipping_email: string
          shipping_phone: string
          shipping_address: string
          notes: string
          stripe_payment_intent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'completed' | 'cancelled'
          total_amount?: number
          is_member_order?: boolean
          shipping_name?: string
          shipping_email?: string
          shipping_phone?: string
          shipping_address?: string
          notes?: string
          stripe_payment_intent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'completed' | 'cancelled'
          total_amount?: number
          is_member_order?: boolean
          shipping_name?: string
          shipping_email?: string
          shipping_phone?: string
          shipping_address?: string
          notes?: string
          stripe_payment_intent_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
          details?: Json
          created_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          user_id: string
          reviewable_type: string
          reviewable_id: string
          rating: number
          comment: string
          is_verified_purchase: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          reviewable_type: string
          reviewable_id: string
          rating: number
          comment?: string
          is_verified_purchase?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          reviewable_type?: string
          reviewable_id?: string
          rating?: number
          comment?: string
          is_verified_purchase?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      review_helpful_votes: {
        Row: {
          id: string
          review_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          user_id?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          professor_id: string
          type: 'new_video' | 'new_program'
          title: string
          message: string
          link: string
          item_id: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          professor_id: string
          type: 'new_video' | 'new_program'
          title: string
          message: string
          link: string
          item_id: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          professor_id?: string
          type?: 'new_video' | 'new_program'
          title?: string
          message?: string
          link?: string
          item_id?: string
          is_read?: boolean
          created_at?: string
        }
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          favorite_type: 'video' | 'program' | 'professor'
          video_id: string | null
          program_id: string | null
          professor_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          favorite_type: 'video' | 'program' | 'professor'
          video_id?: string | null
          program_id?: string | null
          professor_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          favorite_type?: 'video' | 'program' | 'professor'
          video_id?: string | null
          program_id?: string | null
          professor_id?: string | null
          created_at?: string
        }
      }
      program_templates: {
        Row: {
          id: string
          name: string
          description: string
          program_visibility: 'public' | 'platform' | 'paid' | 'private' | 'subscribers_only'
          suggested_price: number
          use_case: string
          is_recommended: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          program_visibility?: 'public' | 'platform' | 'paid' | 'private' | 'subscribers_only'
          suggested_price?: number
          use_case: string
          is_recommended?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          program_visibility?: 'public' | 'platform' | 'paid' | 'private' | 'subscribers_only'
          suggested_price?: number
          use_case?: string
          is_recommended?: boolean
          created_at?: string
        }
      }
      stripe_customers: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string
          default_payment_method: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id: string
          default_payment_method?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_customer_id?: string
          default_payment_method?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      stripe_payments: {
        Row: {
          id: string
          user_id: string
          stripe_payment_intent_id: string
          stripe_customer_id: string | null
          amount: number
          currency: string
          status: string
          payment_type: string
          order_id: string | null
          subscription_id: string | null
          video_purchase_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_payment_intent_id: string
          stripe_customer_id?: string | null
          amount: number
          currency?: string
          status: string
          payment_type: string
          order_id?: string | null
          subscription_id?: string | null
          video_purchase_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_payment_intent_id?: string
          stripe_customer_id?: string | null
          amount?: number
          currency?: string
          status?: string
          payment_type?: string
          order_id?: string | null
          subscription_id?: string | null
          video_purchase_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      stripe_checkout_sessions: {
        Row: {
          id: string
          user_id: string
          stripe_session_id: string
          payment_type: string
          target_id: string | null
          amount: number
          currency: string
          status: string
          metadata: Json
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_session_id: string
          payment_type: string
          target_id?: string | null
          amount: number
          currency?: string
          status?: string
          metadata?: Json
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_session_id?: string
          payment_type?: string
          target_id?: string | null
          amount?: number
          currency?: string
          status?: string
          metadata?: Json
          expires_at?: string
          created_at?: string
        }
      }
      rate_limits: {
        Row: {
          id: string
          key: string
          count: number
          window_start: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          count?: number
          window_start?: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          key?: string
          count?: number
          window_start?: string
          expires_at?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
