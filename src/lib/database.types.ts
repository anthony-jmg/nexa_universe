export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academy_click_tracking: {
        Row: {
          content_id: string | null
          content_type: string
          created_at: string | null
          destination_url: string | null
          id: string
          professor_id: string
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          content_type: string
          created_at?: string | null
          destination_url?: string | null
          id?: string
          professor_id: string
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          content_type?: string
          created_at?: string | null
          destination_url?: string | null
          id?: string
          professor_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_click_tracking_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_event_tickets: {
        Row: {
          amount_due_now: number | null
          balance_payment_mode: string | null
          created_at: string | null
          deposit_amount: number | null
          event_ticket_type_id: string
          id: string
          price_snapshot: number | null
          purchase_type: string
          quantity: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_due_now?: number | null
          balance_payment_mode?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          event_ticket_type_id: string
          id?: string
          price_snapshot?: number | null
          purchase_type?: string
          quantity?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_due_now?: number | null
          balance_payment_mode?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          event_ticket_type_id?: string
          id?: string
          price_snapshot?: number | null
          purchase_type?: string
          quantity?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_event_tickets_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["event_ticket_type_id"]
          },
          {
            foreignKeyName: "cart_event_tickets_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          selected_size: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          selected_size?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          selected_size?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          attendee_email: string | null
          attendee_first_name: string | null
          attendee_last_name: string | null
          attendee_phone: string | null
          check_in_status: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string | null
          event_id: string
          event_ticket_type_id: string | null
          id: string
          pass_file_path: string | null
          pass_reference: string | null
          pass_status: string
          pass_uploaded_at: string | null
          purchased_at: string | null
          qr_code: string
          user_id: string
          weezevent_participant_id: string | null
          weezevent_sync_status: string
          weezevent_synced_at: string | null
          weezevent_ticket_id: string | null
        }
        Insert: {
          attendee_email?: string | null
          attendee_first_name?: string | null
          attendee_last_name?: string | null
          attendee_phone?: string | null
          check_in_status?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string | null
          event_id: string
          event_ticket_type_id?: string | null
          id?: string
          pass_file_path?: string | null
          pass_reference?: string | null
          pass_status?: string
          pass_uploaded_at?: string | null
          purchased_at?: string | null
          qr_code: string
          user_id: string
          weezevent_participant_id?: string | null
          weezevent_sync_status?: string
          weezevent_synced_at?: string | null
          weezevent_ticket_id?: string | null
        }
        Update: {
          attendee_email?: string | null
          attendee_first_name?: string | null
          attendee_last_name?: string | null
          attendee_phone?: string | null
          check_in_status?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string | null
          event_id?: string
          event_ticket_type_id?: string | null
          id?: string
          pass_file_path?: string | null
          pass_reference?: string | null
          pass_status?: string
          pass_uploaded_at?: string | null
          purchased_at?: string | null
          qr_code?: string
          user_id?: string
          weezevent_participant_id?: string | null
          weezevent_sync_status?: string
          weezevent_synced_at?: string | null
          weezevent_ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["event_ticket_type_id"]
          },
          {
            foreignKeyName: "event_attendees_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sold_out_interests: {
        Row: {
          created_at: string
          event_id: string
          event_ticket_type_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_ticket_type_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_ticket_type_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_sold_out_interests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sold_out_interests_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["event_ticket_type_id"]
          },
          {
            foreignKeyName: "event_sold_out_interests_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_price_tiers: {
        Row: {
          created_at: string
          display_order: number
          ends_at: string | null
          event_ticket_type_id: string
          id: string
          label: string
          price: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          ends_at?: string | null
          event_ticket_type_id: string
          id?: string
          label: string
          price: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          ends_at?: string | null
          event_ticket_type_id?: string
          id?: string
          label?: string
          price?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_price_tiers_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["event_ticket_type_id"]
          },
          {
            foreignKeyName: "event_ticket_price_tiers_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_types: {
        Row: {
          created_at: string | null
          display_order: number | null
          event_id: string
          features: string[] | null
          id: string
          is_active: boolean | null
          max_per_order: number | null
          member_price: number | null
          nexa_cost: number | null
          next_price: number | null
          price: number
          price_increase_date: string | null
          price_lock_deposit_amount: number
          price_lock_enabled: boolean
          price_lock_guarantee_days: number
          price_lock_opens_at: string | null
          quantity_available: number | null
          quantity_sold: number | null
          sale_end_date: string | null
          sale_start_date: string | null
          ticket_type_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          event_id: string
          features?: string[] | null
          id?: string
          is_active?: boolean | null
          max_per_order?: number | null
          member_price?: number | null
          nexa_cost?: number | null
          next_price?: number | null
          price?: number
          price_increase_date?: string | null
          price_lock_deposit_amount?: number
          price_lock_enabled?: boolean
          price_lock_guarantee_days?: number
          price_lock_opens_at?: string | null
          quantity_available?: number | null
          quantity_sold?: number | null
          sale_end_date?: string | null
          sale_start_date?: string | null
          ticket_type_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          event_id?: string
          features?: string[] | null
          id?: string
          is_active?: boolean | null
          max_per_order?: number | null
          member_price?: number | null
          nexa_cost?: number | null
          next_price?: number | null
          price?: number
          price_increase_date?: string | null
          price_lock_deposit_amount?: number
          price_lock_enabled?: boolean
          price_lock_guarantee_days?: number
          price_lock_opens_at?: string | null
          quantity_available?: number | null
          quantity_sold?: number | null
          sale_end_date?: string | null
          sale_start_date?: string | null
          ticket_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_ticket_types_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          description_en: string | null
          end_date: string | null
          event_status: string | null
          id: string
          is_active: boolean | null
          is_test: boolean
          location: string | null
          start_date: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description_en?: string | null
          end_date?: string | null
          event_status?: string | null
          id?: string
          is_active?: boolean | null
          is_test?: boolean
          location?: string | null
          start_date: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description_en?: string | null
          end_date?: string | null
          event_status?: string | null
          id?: string
          is_active?: boolean | null
          is_test?: boolean
          location?: string | null
          start_date?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          favorite_type: string
          id: string
          professor_id: string | null
          program_id: string | null
          user_id: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          favorite_type: string
          id?: string
          professor_id?: string | null
          program_id?: string | null
          user_id: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          favorite_type?: string
          id?: string
          professor_id?: string | null
          program_id?: string | null
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorites_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          item_id: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          item_id?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          item_id?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          new_status: string | null
          old_status: string | null
          order_id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          order_id: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          order_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_audit_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          deposit_amount: number | null
          details: Json | null
          event_ticket_type_id: string | null
          id: string
          item_type: string
          locked_price_snapshot: number | null
          order_id: string
          price_tier_id: string | null
          product_id: string | null
          professor_id: string | null
          program_id: string | null
          purchase_type: string | null
          quantity: number
          selected_size: string | null
          unit_price: number
          video_id: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_amount?: number | null
          details?: Json | null
          event_ticket_type_id?: string | null
          id?: string
          item_type: string
          locked_price_snapshot?: number | null
          order_id: string
          price_tier_id?: string | null
          product_id?: string | null
          professor_id?: string | null
          program_id?: string | null
          purchase_type?: string | null
          quantity?: number
          selected_size?: string | null
          unit_price: number
          video_id?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_amount?: number | null
          details?: Json | null
          event_ticket_type_id?: string | null
          id?: string
          item_type?: string
          locked_price_snapshot?: number | null
          order_id?: string
          price_tier_id?: string | null
          product_id?: string | null
          professor_id?: string | null
          program_id?: string | null
          purchase_type?: string | null
          quantity?: number
          selected_size?: string | null
          unit_price?: number
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["event_ticket_type_id"]
          },
          {
            foreignKeyName: "order_items_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_price_tier_id_fkey"
            columns: ["price_tier_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_price_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_price_tier_id_fkey"
            columns: ["price_tier_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["current_tier_id"]
          },
          {
            foreignKeyName: "order_items_price_tier_id_fkey"
            columns: ["price_tier_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["next_tier_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_member_order: boolean | null
          notes: string | null
          payment_intent_id: string | null
          shipping_address: string | null
          shipping_email: string | null
          shipping_name: string | null
          shipping_phone: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_member_order?: boolean | null
          notes?: string | null
          payment_intent_id?: string | null
          shipping_address?: string | null
          shipping_email?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_member_order?: boolean | null
          notes?: string | null
          payment_intent_id?: string | null
          shipping_address?: string | null
          shipping_email?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_line_items: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          item_id: string
          item_type: string
          order_item_id: string | null
          payment_id: string
          sale_date: string
          subscription_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          item_id: string
          item_type: string
          order_item_id?: string | null
          payment_id: string
          sale_date: string
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          item_id?: string
          item_type?: string
          order_item_id?: string | null
          payment_id?: string
          sale_date?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_line_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_line_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "professor_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_line_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_event_attendees: {
        Row: {
          attendee_email: string | null
          attendee_first_name: string | null
          attendee_last_name: string | null
          attendee_phone: string | null
          created_at: string | null
          event_id: string
          event_ticket_type_id: string
          expires_at: string
          id: string
          purchase_type: string
          qr_code: string
          reservation_id: string
          user_id: string
        }
        Insert: {
          attendee_email?: string | null
          attendee_first_name?: string | null
          attendee_last_name?: string | null
          attendee_phone?: string | null
          created_at?: string | null
          event_id: string
          event_ticket_type_id: string
          expires_at: string
          id?: string
          purchase_type?: string
          qr_code: string
          reservation_id: string
          user_id: string
        }
        Update: {
          attendee_email?: string | null
          attendee_first_name?: string | null
          attendee_last_name?: string | null
          attendee_phone?: string | null
          created_at?: string | null
          event_id?: string
          event_ticket_type_id?: string
          expires_at?: string
          id?: string
          purchase_type?: string
          qr_code?: string
          reservation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_event_attendees_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["event_ticket_type_id"]
          },
          {
            foreignKeyName: "pending_event_attendees_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lock_job_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      price_locks: {
        Row: {
          auto_balance_canceled_at: string | null
          auto_balance_consent_at: string | null
          auto_balance_debit_attempted_at: string | null
          auto_balance_failure_reason: string | null
          auto_balance_payment_at: string | null
          auto_balance_payment_intent_id: string | null
          auto_balance_payment_status: string | null
          balance_payment_mode: string
          cancelled_at: string | null
          created_at: string
          credit_attendee_id: string | null
          credit_consumed_at: string | null
          credit_consumed_payment_intent_id: string | null
          deposit_amount: number
          event_id: string
          event_ticket_type_id: string
          expires_at: string
          id: string
          locked_at: string
          locked_price: number
          order_item_id: string | null
          price_increase_date: string | null
          price_tier_id: string | null
          refund_processed_at: string | null
          remaining_amount: number
          selected_deposit_amount: number | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          total_paid: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_balance_canceled_at?: string | null
          auto_balance_consent_at?: string | null
          auto_balance_debit_attempted_at?: string | null
          auto_balance_failure_reason?: string | null
          auto_balance_payment_at?: string | null
          auto_balance_payment_intent_id?: string | null
          auto_balance_payment_status?: string | null
          balance_payment_mode?: string
          cancelled_at?: string | null
          created_at?: string
          credit_attendee_id?: string | null
          credit_consumed_at?: string | null
          credit_consumed_payment_intent_id?: string | null
          deposit_amount?: number
          event_id: string
          event_ticket_type_id: string
          expires_at: string
          id?: string
          locked_at?: string
          locked_price: number
          order_item_id?: string | null
          price_increase_date?: string | null
          price_tier_id?: string | null
          refund_processed_at?: string | null
          remaining_amount: number
          selected_deposit_amount?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          total_paid?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          auto_balance_canceled_at?: string | null
          auto_balance_consent_at?: string | null
          auto_balance_debit_attempted_at?: string | null
          auto_balance_failure_reason?: string | null
          auto_balance_payment_at?: string | null
          auto_balance_payment_intent_id?: string | null
          auto_balance_payment_status?: string | null
          balance_payment_mode?: string
          cancelled_at?: string | null
          created_at?: string
          credit_attendee_id?: string | null
          credit_consumed_at?: string | null
          credit_consumed_payment_intent_id?: string | null
          deposit_amount?: number
          event_id?: string
          event_ticket_type_id?: string
          expires_at?: string
          id?: string
          locked_at?: string
          locked_price?: number
          order_item_id?: string | null
          price_increase_date?: string | null
          price_tier_id?: string | null
          refund_processed_at?: string | null
          remaining_amount?: number
          selected_deposit_amount?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          total_paid?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_locks_credit_attendee_id_fkey"
            columns: ["credit_attendee_id"]
            isOneToOne: false
            referencedRelation: "event_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_locks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_locks_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["event_ticket_type_id"]
          },
          {
            foreignKeyName: "price_locks_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_locks_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_locks_price_tier_id_fkey"
            columns: ["price_tier_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_price_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_locks_price_tier_id_fkey"
            columns: ["price_tier_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["current_tier_id"]
          },
          {
            foreignKeyName: "price_locks_price_tier_id_fkey"
            columns: ["price_tier_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["next_tier_id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          order_index: number
          product_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          order_index?: number
          product_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          order_index?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sizes: {
        Row: {
          created_at: string | null
          id: string
          name: string
          order_index: number
          product_id: string
          stock_quantity: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          product_id: string
          stock_quantity?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          product_id?: string
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          member_price: number | null
          name: string
          order_index: number
          price: number
          product_type_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          member_price?: number | null
          name: string
          order_index?: number
          price?: number
          product_type_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          member_price?: number | null
          name?: string
          order_index?: number
          price?: number
          product_type_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          period_end: string
          period_start: string
          professor_id: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          period_end: string
          period_start: string
          professor_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          period_end?: string
          period_start?: string
          professor_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_payments_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancellation_feedback: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          price_paid: number | null
          professor_id: string
          started_at: string | null
          status: string
          stripe_subscription_id: string | null
          subscription_created_at: string | null
          user_id: string
          withdrawal_right_waived: boolean
          withdrawal_waiver_reason: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancellation_feedback?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          price_paid?: number | null
          professor_id: string
          started_at?: string | null
          status?: string
          stripe_subscription_id?: string | null
          subscription_created_at?: string | null
          user_id: string
          withdrawal_right_waived?: boolean
          withdrawal_waiver_reason?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          cancellation_feedback?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          price_paid?: number | null
          professor_id?: string
          started_at?: string | null
          status?: string
          stripe_subscription_id?: string | null
          subscription_created_at?: string | null
          user_id?: string
          withdrawal_right_waived?: boolean
          withdrawal_waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professor_subscriptions_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professors: {
        Row: {
          avatar_url: string | null
          badge_type: string | null
          bio: string | null
          bio_en: string | null
          created_at: string | null
          experience_years: number | null
          full_name: string
          id: string
          is_active: boolean
          is_featured: boolean | null
          is_founder: boolean | null
          platform_fee_percentage: number | null
          profile_id: string | null
          profile_video_url: string | null
          profile_video_urls: string[] | null
          specialties: string[] | null
          stripe_connect_account_id: string | null
          stripe_connect_charges_enabled: boolean | null
          stripe_connect_enabled: boolean | null
          stripe_connect_onboarding_completed: boolean | null
          subscriber_discount_percentage: number | null
          subscription_price: number | null
          updated_at: string
          website_cover_image: string | null
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          badge_type?: string | null
          bio?: string | null
          bio_en?: string | null
          created_at?: string | null
          experience_years?: number | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean | null
          is_founder?: boolean | null
          platform_fee_percentage?: number | null
          profile_id?: string | null
          profile_video_url?: string | null
          profile_video_urls?: string[] | null
          specialties?: string[] | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean | null
          stripe_connect_enabled?: boolean | null
          stripe_connect_onboarding_completed?: boolean | null
          subscriber_discount_percentage?: number | null
          subscription_price?: number | null
          updated_at?: string
          website_cover_image?: string | null
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          badge_type?: string | null
          bio?: string | null
          bio_en?: string | null
          created_at?: string | null
          experience_years?: number | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean | null
          is_founder?: boolean | null
          platform_fee_percentage?: number | null
          profile_id?: string | null
          profile_video_url?: string | null
          profile_video_urls?: string[] | null
          specialties?: string[] | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean | null
          stripe_connect_enabled?: boolean | null
          stripe_connect_onboarding_completed?: boolean | null
          subscriber_discount_percentage?: number | null
          subscription_price?: number | null
          updated_at?: string
          website_cover_image?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          platform_subscription_expires_at: string | null
          platform_subscription_price_paid: number | null
          platform_subscription_status: string
          professor_request_at: string | null
          professor_request_message: string | null
          professor_request_status: string | null
          role: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_cancel_at_period_end: boolean | null
          updated_at: string | null
          wants_to_be_professor: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          platform_subscription_expires_at?: string | null
          platform_subscription_price_paid?: number | null
          platform_subscription_status?: string
          professor_request_at?: string | null
          professor_request_message?: string | null
          professor_request_status?: string | null
          role?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_at_period_end?: boolean | null
          updated_at?: string | null
          wants_to_be_professor?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          platform_subscription_expires_at?: string | null
          platform_subscription_price_paid?: number | null
          platform_subscription_status?: string
          professor_request_at?: string | null
          professor_request_message?: string | null
          professor_request_status?: string | null
          role?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_at_period_end?: boolean | null
          updated_at?: string | null
          wants_to_be_professor?: boolean | null
        }
        Relationships: []
      }
      program_purchases: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          price_paid: number
          professor_id: string | null
          program_id: string
          purchased_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          price_paid?: number
          professor_id?: string | null
          program_id: string
          purchased_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          price_paid?: number
          professor_id?: string | null
          program_id?: string
          purchased_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_purchases_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_purchases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_videos: {
        Row: {
          order_index: number | null
          program_id: string
          video_id: string
        }
        Insert: {
          order_index?: number | null
          program_id: string
          video_id: string
        }
        Update: {
          order_index?: number | null
          program_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_videos_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string | null
          description: string | null
          duration_total_minutes: number | null
          external_url: string | null
          id: string
          is_active: boolean | null
          level: string
          order_index: number | null
          price: number | null
          professor_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          visibility: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_total_minutes?: number | null
          external_url?: string | null
          id?: string
          is_active?: boolean | null
          level?: string
          order_index?: number | null
          price?: number | null
          professor_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_total_minutes?: number | null
          external_url?: string | null
          id?: string
          is_active?: boolean | null
          level?: string
          order_index?: number | null
          price?: number | null
          professor_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          created_at: string | null
          expires_at: string
          id: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string | null
          expires_at?: string
          id?: string
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          created_at?: string | null
          expires_at?: string
          id?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          is_verified_purchase: boolean | null
          rating: number
          reviewable_id: string
          reviewable_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          is_verified_purchase?: boolean | null
          rating: number
          reviewable_id: string
          reviewable_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          is_verified_purchase?: boolean | null
          rating?: number
          reviewable_id?: string
          reviewable_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          created_at: string | null
          event_ticket_type_id: string | null
          expires_at: string
          id: string
          product_id: string | null
          quantity: number
          reservation_id: string
        }
        Insert: {
          created_at?: string | null
          event_ticket_type_id?: string | null
          expires_at: string
          id?: string
          product_id?: string | null
          quantity: number
          reservation_id: string
        }
        Update: {
          created_at?: string | null
          event_ticket_type_id?: string | null
          expires_at?: string
          id?: string
          product_id?: string | null
          quantity?: number
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_pricing_view"
            referencedColumns: ["event_ticket_type_id"]
          },
          {
            foreignKeyName: "stock_reservations_event_ticket_type_id_fkey"
            columns: ["event_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_checkout_sessions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          expires_at: string
          id: string
          metadata: Json | null
          payment_type: string
          status: string
          stripe_session_id: string
          target_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          expires_at: string
          id?: string
          metadata?: Json | null
          payment_type: string
          status?: string
          stripe_session_id: string
          target_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          expires_at?: string
          id?: string
          metadata?: Json | null
          payment_type?: string
          status?: string
          stripe_session_id?: string
          target_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stripe_customers: {
        Row: {
          created_at: string | null
          default_payment_method: string | null
          id: string
          metadata: Json | null
          stripe_customer_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_payment_method?: string | null
          id?: string
          metadata?: Json | null
          stripe_customer_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_payment_method?: string | null
          id?: string
          metadata?: Json | null
          stripe_customer_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stripe_payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          metadata: Json | null
          order_id: string | null
          payment_type: string
          price_lock_id: string | null
          program_purchase_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_intent_id: string
          subscription_id: string | null
          updated_at: string | null
          user_id: string
          video_purchase_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_type: string
          price_lock_id?: string | null
          program_purchase_id?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id: string
          subscription_id?: string | null
          updated_at?: string | null
          user_id: string
          video_purchase_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_type?: string
          price_lock_id?: string | null
          program_purchase_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
          video_purchase_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payments_price_lock_id_fkey"
            columns: ["price_lock_id"]
            isOneToOne: false
            referencedRelation: "price_locks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payments_program_purchase_id_fkey"
            columns: ["program_purchase_id"]
            isOneToOne: false
            referencedRelation: "program_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "professor_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payments_video_purchase_id_fkey"
            columns: ["video_purchase_id"]
            isOneToOne: false
            referencedRelation: "video_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end: string
          current_period_start: string
          id?: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          created_at: string | null
          description: string | null
          description_en: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      video_progress: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          last_watched_at: string | null
          progress_percentage: number | null
          updated_at: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          last_watched_at?: string | null
          progress_percentage?: number | null
          updated_at?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          last_watched_at?: string | null
          progress_percentage?: number | null
          updated_at?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_purchases: {
        Row: {
          amount_paid: number
          id: string
          purchased_at: string
          status: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          amount_paid: number
          id?: string
          purchased_at?: string
          status?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          amount_paid?: number
          id?: string
          purchased_at?: string
          status?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_purchases_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_views: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          last_position_seconds: number | null
          last_watched_at: string | null
          progress_percentage: number | null
          updated_at: string | null
          user_id: string
          video_id: string
          view_count: number | null
          watch_duration_seconds: number | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          last_position_seconds?: number | null
          last_watched_at?: string | null
          progress_percentage?: number | null
          updated_at?: string | null
          user_id: string
          video_id: string
          view_count?: number | null
          watch_duration_seconds?: number | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          last_position_seconds?: number | null
          last_watched_at?: string | null
          progress_percentage?: number | null
          updated_at?: string | null
          user_id?: string
          video_id?: string
          view_count?: number | null
          watch_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          category: string | null
          cloudflare_video_id: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          external_url: string | null
          id: string
          is_free: boolean | null
          level: string
          order_index: number | null
          price: number | null
          professor_id: string | null
          program_id: string | null
          program_order_index: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_url: string | null
          visibility: string | null
        }
        Insert: {
          category?: string | null
          cloudflare_video_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          external_url?: string | null
          id?: string
          is_free?: boolean | null
          level: string
          order_index?: number | null
          price?: number | null
          professor_id?: string | null
          program_id?: string | null
          program_order_index?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_url?: string | null
          visibility?: string | null
        }
        Update: {
          category?: string | null
          cloudflare_video_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          external_url?: string | null
          id?: string
          is_free?: boolean | null
          level?: string
          order_index?: number | null
          price?: number | null
          professor_id?: string | null
          program_id?: string | null
          program_order_index?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_url?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_waivers: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          order_id: string
          user_agent: string | null
          user_id: string
          waiver_accepted: boolean
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          order_id: string
          user_agent?: string | null
          user_id: string
          waiver_accepted?: boolean
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          order_id?: string
          user_agent?: string | null
          user_id?: string
          waiver_accepted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_waivers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_waivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      event_ticket_pricing_view: {
        Row: {
          current_price: number | null
          current_tier_id: string | null
          current_tier_label: string | null
          event_id: string | null
          event_ticket_type_id: string | null
          is_active: boolean | null
          next_price: number | null
          next_price_change_at: string | null
          next_tier_id: string | null
          price_lock_deposit_amount: number | null
          price_lock_enabled: boolean | null
          price_lock_expiration_basis: string | null
          price_lock_guarantee_days: number | null
          sale_end_date: string | null
          ticket_type_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_confirm_order_payment: {
        Args: { p_order_id: string }
        Returns: Json
      }
      admin_list_profiles: {
        Args: never
        Returns: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          platform_subscription_expires_at: string | null
          platform_subscription_price_paid: number | null
          platform_subscription_status: string
          professor_request_at: string | null
          professor_request_message: string | null
          professor_request_status: string | null
          role: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_cancel_at_period_end: boolean | null
          updated_at: string | null
          wants_to_be_professor: boolean | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      apply_price_increase: {
        Args: { p_event_ticket_type_id: string }
        Returns: {
          created_at: string | null
          display_order: number | null
          event_id: string
          features: string[] | null
          id: string
          is_active: boolean | null
          max_per_order: number | null
          member_price: number | null
          nexa_cost: number | null
          next_price: number | null
          price: number
          price_increase_date: string | null
          price_lock_deposit_amount: number
          price_lock_enabled: boolean
          price_lock_guarantee_days: number
          price_lock_opens_at: string | null
          quantity_available: number | null
          quantity_sold: number | null
          sale_end_date: string | null
          sale_start_date: string | null
          ticket_type_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_ticket_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_expired_orders: { Args: never; Returns: number }
      cancel_price_lock: {
        Args: { p_lock_id: string }
        Returns: {
          auto_balance_canceled_at: string | null
          auto_balance_consent_at: string | null
          auto_balance_debit_attempted_at: string | null
          auto_balance_failure_reason: string | null
          auto_balance_payment_at: string | null
          auto_balance_payment_intent_id: string | null
          auto_balance_payment_status: string | null
          balance_payment_mode: string
          cancelled_at: string | null
          created_at: string
          credit_attendee_id: string | null
          credit_consumed_at: string | null
          credit_consumed_payment_intent_id: string | null
          deposit_amount: number
          event_id: string
          event_ticket_type_id: string
          expires_at: string
          id: string
          locked_at: string
          locked_price: number
          order_item_id: string | null
          price_increase_date: string | null
          price_tier_id: string | null
          refund_processed_at: string | null
          remaining_amount: number
          selected_deposit_amount: number | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          total_paid: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "price_locks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_paid_order: {
        Args: {
          p_amount_paid: number
          p_order_id: string
          p_payment_intent_id: string
          p_user_id: string
        }
        Returns: string
      }
      claim_price_lock_auto_debit: {
        Args: { p_lock_id: string }
        Returns: number
      }
      cleanup_expired_checkout_sessions: { Args: never; Returns: undefined }
      cleanup_expired_reservations: { Args: never; Returns: number }
      complete_price_lock_attendees: {
        Args: { p_lock_id: string }
        Returns: number
      }
      consume_price_lock_credit: {
        Args: {
          p_amount: number
          p_lock_id: string
          p_payment_intent_id: string
          p_user_id: string
        }
        Returns: Json
      }
      convert_pending_to_actual_attendees: {
        Args: { p_order_id: string }
        Returns: number
      }
      create_stripe_price_lock_deposit: {
        Args: { p_amount: number; p_ticket_type_id: string; p_user_id: string }
        Returns: number
      }
      cron_debit_config: { Args: { p_key: string }; Returns: string }
      ensure_price_lock_attendee: {
        Args: { p_lock_id: string }
        Returns: string
      }
      expire_price_lock_if_due: {
        Args: { p_lock_id: string }
        Returns: boolean
      }
      expire_stale_price_locks: { Args: never; Returns: number }
      finalize_price_lock_auto_debit: {
        Args: {
          p_failure_reason?: string
          p_lock_id: string
          p_pi_id: string
          p_succeeded: boolean
        }
        Returns: undefined
      }
      get_academy_discovery_click_stats: {
        Args: never
        Returns: {
          professor_id: string
          profile_clicks: number
          website_clicks: number
        }[]
      }
      get_available_stock: { Args: { p_product_id: string }; Returns: number }
      get_available_stock_for_size: {
        Args: { p_product_id: string; p_size_name: string }
        Returns: number
      }
      get_event_credit: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: number
      }
      get_event_sold_out_interest_counts: {
        Args: { p_event_id: string }
        Returns: {
          event_ticket_type_id: string
          interest_count: number
        }[]
      }
      get_event_ticket_pricing: {
        Args: { p_event_ticket_type_id: string }
        Returns: {
          current_price: number
          current_tier_id: string
          current_tier_label: string
          next_price: number
          next_price_change_at: string
          next_tier_id: string
          price_lock_deposit_amount: number
          price_lock_enabled: boolean
          price_lock_expiration_basis: string
          price_lock_guarantee_days: number
          price_lock_opens_at: string
          sale_end_date: string
        }[]
      }
      get_my_expired_price_lock_reservation_ids: {
        Args: never
        Returns: string[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          platform_subscription_expires_at: string | null
          platform_subscription_price_paid: number | null
          platform_subscription_status: string
          professor_request_at: string | null
          professor_request_message: string | null
          professor_request_status: string | null
          role: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_cancel_at_period_end: boolean | null
          updated_at: string | null
          wants_to_be_professor: boolean | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_price_lock_balance_due: {
        Args: { p_lock_id: string }
        Returns: number
      }
      get_price_lock_refund_window_hours: { Args: never; Returns: number }
      get_price_lock_repurchase_quote: {
        Args: { p_lock_id: string; p_user_id?: string }
        Returns: Json
      }
      nexa_caller_is_admin: { Args: never; Returns: boolean }
      nexa_is_client_role: { Args: never; Returns: boolean }
      price_lock_public_price: {
        Args: { p_event_ticket_type_id: string }
        Returns: number
      }
      price_lock_refund_eligible: {
        Args: { p_lock_id: string }
        Returns: boolean
      }
      record_price_lock_payment: {
        Args: {
          p_amount: number
          p_auto_debit?: boolean
          p_lock_id: string
          p_stripe_payment_intent_id?: string
        }
        Returns: {
          auto_balance_canceled_at: string | null
          auto_balance_consent_at: string | null
          auto_balance_debit_attempted_at: string | null
          auto_balance_failure_reason: string | null
          auto_balance_payment_at: string | null
          auto_balance_payment_intent_id: string | null
          auto_balance_payment_status: string | null
          balance_payment_mode: string
          cancelled_at: string | null
          created_at: string
          credit_attendee_id: string | null
          credit_consumed_at: string | null
          credit_consumed_payment_intent_id: string | null
          deposit_amount: number
          event_id: string
          event_ticket_type_id: string
          expires_at: string
          id: string
          locked_at: string
          locked_price: number
          order_item_id: string | null
          price_increase_date: string | null
          price_tier_id: string | null
          refund_processed_at: string | null
          remaining_amount: number
          selected_deposit_amount: number | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          total_paid: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "price_locks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_stock_reservation: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      reserve_stock: {
        Args: { p_order_id: string; p_product_id: string; p_quantity: number }
        Returns: boolean
      }
    }
    Enums: {
      visibility_type:
        | "public"
        | "platform"
        | "paid"
        | "private"
        | "subscribers_only"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      visibility_type: [
        "public",
        "platform",
        "paid",
        "private",
        "subscribers_only",
      ],
    },
  },
} as const
