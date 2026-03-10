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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          amount: number
          amount_usd: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          due_date: string | null
          exchange_rate_used: number | null
          id: string
          notes: string | null
          paid_amount: number | null
          reference_id: string | null
          reference_type: string | null
          status: string | null
          supplier_contact: string | null
          supplier_name: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          amount_usd?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_date?: string | null
          exchange_rate_used?: number | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          supplier_contact?: string | null
          supplier_name: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          amount_usd?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_date?: string | null
          exchange_rate_used?: number | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          supplier_contact?: string | null
          supplier_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      accounts_receivable: {
        Row: {
          amount: number
          amount_usd: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_name: string
          customer_phone: string | null
          due_date: string | null
          exchange_rate_used: number | null
          id: string
          notes: string | null
          paid_amount: number | null
          reference_id: string | null
          reference_type: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          amount_usd?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_name: string
          customer_phone?: string | null
          due_date?: string | null
          exchange_rate_used?: number | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          amount_usd?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_name?: string
          customer_phone?: string | null
          due_date?: string | null
          exchange_rate_used?: number | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      activity_feed: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          title: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          title: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_analysis_cache: {
        Row: {
          analysis_type: string
          cache_key: string
          created_at: string | null
          expires_at: string
          id: string
          result: Json
        }
        Insert: {
          analysis_type: string
          cache_key: string
          created_at?: string | null
          expires_at: string
          id?: string
          result: Json
        }
        Update: {
          analysis_type?: string
          cache_key?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          result?: Json
        }
        Relationships: []
      }
      ai_chat_analysis: {
        Row: {
          chat_id: string | null
          created_at: string | null
          id: string
          intent: string | null
          message_id: string | null
          model_used: string | null
          resolution_outcome: string | null
          response_confidence: number | null
          response_used: boolean | null
          sentiment: string | null
          suggested_response: string | null
          urgency: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          message_id?: string | null
          model_used?: string | null
          resolution_outcome?: string | null
          response_confidence?: number | null
          response_used?: boolean | null
          sentiment?: string | null
          suggested_response?: string | null
          urgency?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          message_id?: string | null
          model_used?: string | null
          resolution_outcome?: string | null
          response_confidence?: number | null
          response_used?: boolean | null
          sentiment?: string | null
          suggested_response?: string | null
          urgency?: string | null
        }
        Relationships: []
      }
      ali_ai_context_cache: {
        Row: {
          cache_key: string
          context_type: string
          created_at: string | null
          data: Json
          expires_at: string
          id: string
          user_role: string
        }
        Insert: {
          cache_key: string
          context_type: string
          created_at?: string | null
          data: Json
          expires_at: string
          id?: string
          user_role: string
        }
        Update: {
          cache_key?: string
          context_type?: string
          created_at?: string | null
          data?: Json
          expires_at?: string
          id?: string
          user_role?: string
        }
        Relationships: []
      }
      ali_ai_conversations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          message_count: number | null
          summary: string | null
          title: string | null
          topics: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_count?: number | null
          summary?: string | null
          title?: string | null
          topics?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_count?: number | null
          summary?: string | null
          title?: string | null
          topics?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ali_ai_digests: {
        Row: {
          content: string
          created_at: string
          digest_date: string
          digest_type: string
          id: string
          metrics: Json | null
          sent_via: string[] | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          digest_date?: string
          digest_type?: string
          id?: string
          metrics?: Json | null
          sent_via?: string[] | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          digest_date?: string
          digest_type?: string
          id?: string
          metrics?: Json | null
          sent_via?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      ali_ai_insights: {
        Row: {
          action_label: string | null
          action_url: string | null
          category: string
          created_at: string
          data: Json | null
          description: string
          expires_at: string | null
          id: string
          insight_type: string
          is_dismissed: boolean | null
          is_read: boolean | null
          read_at: string | null
          severity: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          category: string
          created_at?: string
          data?: Json | null
          description: string
          expires_at?: string | null
          id?: string
          insight_type: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          read_at?: string | null
          severity?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          category?: string
          created_at?: string
          data?: Json | null
          description?: string
          expires_at?: string | null
          id?: string
          insight_type?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          read_at?: string | null
          severity?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ali_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ali_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ali_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ali_ai_usage_logs: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          data_scopes_accessed: string[] | null
          id: string
          model_used: string | null
          query_complexity: string | null
          question_preview: string | null
          response_time_ms: number | null
          tokens_estimate: number | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          data_scopes_accessed?: string[] | null
          id?: string
          model_used?: string | null
          query_complexity?: string | null
          question_preview?: string | null
          response_time_ms?: number | null
          tokens_estimate?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          data_scopes_accessed?: string[] | null
          id?: string
          model_used?: string | null
          query_complexity?: string | null
          question_preview?: string | null
          response_time_ms?: number | null
          tokens_estimate?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ali_ai_usage_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ali_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ali_ai_user_preferences: {
        Row: {
          avg_query_complexity: string | null
          conversation_summaries: Json | null
          created_at: string
          favorite_topics: string[] | null
          id: string
          last_topics: string[] | null
          learned_context: Json | null
          preferred_detail_level: string | null
          preferred_language: string | null
          total_queries: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_query_complexity?: string | null
          conversation_summaries?: Json | null
          created_at?: string
          favorite_topics?: string[] | null
          id?: string
          last_topics?: string[] | null
          learned_context?: Json | null
          preferred_detail_level?: string | null
          preferred_language?: string | null
          total_queries?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_query_complexity?: string | null
          conversation_summaries?: Json | null
          created_at?: string
          favorite_topics?: string[] | null
          id?: string
          last_topics?: string[] | null
          learned_context?: Json | null
          preferred_detail_level?: string | null
          preferred_language?: string | null
          total_queries?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attribute_definitions: {
        Row: {
          attribute_key: string
          attribute_type: Database["public"]["Enums"]["attribute_type"]
          category_id: string | null
          created_at: string | null
          id: string
          is_filterable: boolean | null
          is_required: boolean | null
          is_variant: boolean | null
          name: string
          name_en: string | null
          name_ru: string | null
          options: Json | null
          sort_order: number | null
          unit: string | null
          validation_rules: Json | null
        }
        Insert: {
          attribute_key: string
          attribute_type?: Database["public"]["Enums"]["attribute_type"]
          category_id?: string | null
          created_at?: string | null
          id?: string
          is_filterable?: boolean | null
          is_required?: boolean | null
          is_variant?: boolean | null
          name: string
          name_en?: string | null
          name_ru?: string | null
          options?: Json | null
          sort_order?: number | null
          unit?: string | null
          validation_rules?: Json | null
        }
        Update: {
          attribute_key?: string
          attribute_type?: Database["public"]["Enums"]["attribute_type"]
          category_id?: string | null
          created_at?: string | null
          id?: string
          is_filterable?: boolean | null
          is_required?: boolean | null
          is_variant?: boolean | null
          name?: string
          name_en?: string | null
          name_ru?: string | null
          options?: Json | null
          sort_order?: number | null
          unit?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "attribute_definitions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_hierarchy"
            referencedColumns: ["id"]
          },
        ]
      }
      box_items: {
        Row: {
          box_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          status: string | null
          verified_china: boolean | null
          verified_uz: boolean | null
        }
        Insert: {
          box_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          status?: string | null
          verified_china?: boolean | null
          verified_uz?: boolean | null
        }
        Update: {
          box_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          status?: string | null
          verified_china?: boolean | null
          verified_uz?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "box_items_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "box_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      box_track_codes: {
        Row: {
          box_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          notes: string | null
          source: string | null
          track_code: string
        }
        Insert: {
          box_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          source?: string | null
          track_code: string
        }
        Update: {
          box_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          source?: string | null
          track_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "box_track_codes_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      boxes: {
        Row: {
          abusaxiy_receipt_number: string | null
          actual_arrival: string | null
          box_number: string
          china_verified_at: string | null
          china_verified_by: string | null
          created_at: string
          days_in_transit: number | null
          defect_count: number | null
          estimated_arrival: string | null
          height_cm: number | null
          id: string
          length_cm: number | null
          location: string | null
          missing_count: number | null
          notes: string | null
          package_type: string | null
          place_number: string | null
          product_description: string | null
          qr_code: string | null
          qr_data: Json | null
          sealed_at: string | null
          sealed_by: string | null
          shipping_cost: number | null
          status: string | null
          store_number: string | null
          store_phone: string | null
          updated_at: string
          verification_complete: boolean | null
          verification_required: boolean | null
          verification_session_id: string | null
          volume_m3: number | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          abusaxiy_receipt_number?: string | null
          actual_arrival?: string | null
          box_number: string
          china_verified_at?: string | null
          china_verified_by?: string | null
          created_at?: string
          days_in_transit?: number | null
          defect_count?: number | null
          estimated_arrival?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          location?: string | null
          missing_count?: number | null
          notes?: string | null
          package_type?: string | null
          place_number?: string | null
          product_description?: string | null
          qr_code?: string | null
          qr_data?: Json | null
          sealed_at?: string | null
          sealed_by?: string | null
          shipping_cost?: number | null
          status?: string | null
          store_number?: string | null
          store_phone?: string | null
          updated_at?: string
          verification_complete?: boolean | null
          verification_required?: boolean | null
          verification_session_id?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          abusaxiy_receipt_number?: string | null
          actual_arrival?: string | null
          box_number?: string
          china_verified_at?: string | null
          china_verified_by?: string | null
          created_at?: string
          days_in_transit?: number | null
          defect_count?: number | null
          estimated_arrival?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          location?: string | null
          missing_count?: number | null
          notes?: string | null
          package_type?: string | null
          place_number?: string | null
          product_description?: string | null
          qr_code?: string | null
          qr_data?: Json | null
          sealed_at?: string | null
          sealed_by?: string | null
          shipping_cost?: number | null
          status?: string | null
          store_number?: string | null
          store_phone?: string | null
          updated_at?: string
          verification_complete?: boolean | null
          verification_required?: boolean | null
          verification_session_id?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_boxes_verification_session"
            columns: ["verification_session_id"]
            isOneToOne: false
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_stats: {
        Row: {
          avg_transit_days: number | null
          calculated_at: string | null
          carrier: string
          created_at: string | null
          damage_rate: number | null
          id: string
          loss_rate: number | null
          max_transit_days: number | null
          min_transit_days: number | null
          on_time_rate: number | null
          total_boxes: number | null
          total_cost: number | null
          total_shipments: number | null
          total_volume_m3: number | null
          total_weight_kg: number | null
          updated_at: string | null
        }
        Insert: {
          avg_transit_days?: number | null
          calculated_at?: string | null
          carrier: string
          created_at?: string | null
          damage_rate?: number | null
          id?: string
          loss_rate?: number | null
          max_transit_days?: number | null
          min_transit_days?: number | null
          on_time_rate?: number | null
          total_boxes?: number | null
          total_cost?: number | null
          total_shipments?: number | null
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_transit_days?: number | null
          calculated_at?: string | null
          carrier?: string
          created_at?: string | null
          damage_rate?: number | null
          id?: string
          loss_rate?: number | null
          max_transit_days?: number | null
          min_transit_days?: number | null
          on_time_rate?: number | null
          total_boxes?: number | null
          total_cost?: number | null
          total_shipments?: number | null
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      categories_hierarchy: {
        Row: {
          created_at: string | null
          external_id: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          level: number
          name: string
          name_en: string | null
          name_ru: string | null
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          level?: number
          name: string
          name_en?: string | null
          name_ru?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          level?: number
          name?: string
          name_en?: string | null
          name_ru?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_hierarchy_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_hierarchy"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_status_history: {
        Row: {
          changed_by: string | null
          claim_id: string
          created_at: string | null
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
        }
        Insert: {
          changed_by?: string | null
          claim_id: string
          created_at?: string | null
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
        }
        Update: {
          changed_by?: string | null
          claim_id?: string
          created_at?: string | null
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_status_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "defect_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          name_ru: string | null
          name_uz: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          name_ru?: string | null
          name_uz: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          name_ru?: string | null
          name_uz?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      defect_claims: {
        Row: {
          abusaxiy_reference: string | null
          box_id: string | null
          claim_amount: number | null
          claim_currency: string | null
          claim_number: string
          compensation_amount: number | null
          compensation_currency: string | null
          created_at: string | null
          created_by: string | null
          defect_category_id: string | null
          defect_description: string | null
          id: string
          photo_urls: Json | null
          product_id: string | null
          product_item_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          submitted_to_abusaxiy: boolean | null
          updated_at: string | null
          verification_session_id: string | null
        }
        Insert: {
          abusaxiy_reference?: string | null
          box_id?: string | null
          claim_amount?: number | null
          claim_currency?: string | null
          claim_number: string
          compensation_amount?: number | null
          compensation_currency?: string | null
          created_at?: string | null
          created_by?: string | null
          defect_category_id?: string | null
          defect_description?: string | null
          id?: string
          photo_urls?: Json | null
          product_id?: string | null
          product_item_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          submitted_to_abusaxiy?: boolean | null
          updated_at?: string | null
          verification_session_id?: string | null
        }
        Update: {
          abusaxiy_reference?: string | null
          box_id?: string | null
          claim_amount?: number | null
          claim_currency?: string | null
          claim_number?: string
          compensation_amount?: number | null
          compensation_currency?: string | null
          created_at?: string | null
          created_by?: string | null
          defect_category_id?: string | null
          defect_description?: string | null
          id?: string
          photo_urls?: Json | null
          product_id?: string | null
          product_item_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          submitted_to_abusaxiy?: boolean | null
          updated_at?: string | null
          verification_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "defect_claims_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_claims_defect_category_id_fkey"
            columns: ["defect_category_id"]
            isOneToOne: false
            referencedRelation: "defect_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_claims_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_claims_product_item_id_fkey"
            columns: ["product_item_id"]
            isOneToOne: false
            referencedRelation: "product_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_claims_verification_session_id_fkey"
            columns: ["verification_session_id"]
            isOneToOne: false
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_sales: {
        Row: {
          created_at: string
          currency: string
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          exchange_rate_at_sale: number | null
          finance_transaction_id: string | null
          id: string
          movement_id: string | null
          notes: string | null
          payment_method: string
          payment_status: string
          price_usd: number | null
          product_id: string | null
          product_item_id: string | null
          product_name: string
          quantity: number
          receipt_number: string | null
          sold_by: string | null
          total_price: number
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          exchange_rate_at_sale?: number | null
          finance_transaction_id?: string | null
          id?: string
          movement_id?: string | null
          notes?: string | null
          payment_method?: string
          payment_status?: string
          price_usd?: number | null
          product_id?: string | null
          product_item_id?: string | null
          product_name: string
          quantity?: number
          receipt_number?: string | null
          sold_by?: string | null
          total_price: number
          unit_price: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          exchange_rate_at_sale?: number | null
          finance_transaction_id?: string | null
          id?: string
          movement_id?: string | null
          notes?: string | null
          payment_method?: string
          payment_status?: string
          price_usd?: number | null
          product_id?: string | null
          product_item_id?: string | null
          product_name?: string
          quantity?: number
          receipt_number?: string | null
          sold_by?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_sales_finance_transaction_id_fkey"
            columns: ["finance_transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_sales_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_sales_product_item_id_fkey"
            columns: ["product_item_id"]
            isOneToOne: false
            referencedRelation: "product_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_sales_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      excel_import_logs: {
        Row: {
          created_at: string
          errors: Json | null
          file_name: string
          id: string
          imported_by: string | null
          rows_failed: number | null
          rows_processed: number | null
          rows_success: number | null
        }
        Insert: {
          created_at?: string
          errors?: Json | null
          file_name: string
          id?: string
          imported_by?: string | null
          rows_failed?: number | null
          rows_processed?: number | null
          rows_success?: number | null
        }
        Update: {
          created_at?: string
          errors?: Json | null
          file_name?: string
          id?: string
          imported_by?: string | null
          rows_failed?: number | null
          rows_processed?: number | null
          rows_success?: number | null
        }
        Relationships: []
      }
      exchange_rates_history: {
        Row: {
          base_currency: string
          fetched_at: string
          id: string
          is_manual: boolean | null
          rates: Json
          source: string | null
        }
        Insert: {
          base_currency?: string
          fetched_at?: string
          id?: string
          is_manual?: boolean | null
          rates: Json
          source?: string | null
        }
        Update: {
          base_currency?: string
          fetched_at?: string
          id?: string
          is_manual?: boolean | null
          rates?: Json
          source?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_operational: boolean | null
          name: string
          name_uz: string | null
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_operational?: boolean | null
          name: string
          name_uz?: string | null
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_operational?: boolean | null
          name?: string
          name_uz?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      fbs_invoice_items: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          external_order_id: string | null
          id: string
          image_url: string | null
          invoice_id: string | null
          product_id: string | null
          product_title: string | null
          quantity: number | null
          sku_title: string | null
          variant_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          external_order_id?: string | null
          id?: string
          image_url?: string | null
          invoice_id?: string | null
          product_id?: string | null
          product_title?: string | null
          quantity?: number | null
          sku_title?: string | null
          variant_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          external_order_id?: string | null
          id?: string
          image_url?: string | null
          invoice_id?: string | null
          product_id?: string | null
          product_title?: string | null
          quantity?: number | null
          sku_title?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fbs_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fbs_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      fbs_invoices: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          id: string
          invoice_date: string | null
          invoice_id: string
          notes: string | null
          order_count: number | null
          platform: string | null
          status: string | null
          stock_deducted: boolean | null
          stock_deducted_at: string | null
          store_id: string | null
          store_name: string | null
          updated_at: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          id?: string
          invoice_date?: string | null
          invoice_id: string
          notes?: string | null
          order_count?: number | null
          platform?: string | null
          status?: string | null
          stock_deducted?: boolean | null
          stock_deducted_at?: string | null
          store_id?: string | null
          store_name?: string | null
          updated_at?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          id?: string
          invoice_date?: string | null
          invoice_id?: string
          notes?: string | null
          order_count?: number | null
          platform?: string | null
          status?: string | null
          stock_deducted?: boolean | null
          stock_deducted_at?: string | null
          store_id?: string | null
          store_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fbs_invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fbu_activity_log: {
        Row: {
          activity_date: string | null
          activity_type: string
          created_at: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          product_id: string | null
          product_title: string | null
          quantity: number | null
          sku_title: string | null
          status: string | null
          store_id: string | null
          total_amount: number | null
          unit_price: number | null
        }
        Insert: {
          activity_date?: string | null
          activity_type: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string | null
          product_title?: string | null
          quantity?: number | null
          sku_title?: string | null
          status?: string | null
          store_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
        }
        Update: {
          activity_date?: string | null
          activity_type?: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string | null
          product_title?: string | null
          quantity?: number | null
          sku_title?: string | null
          status?: string | null
          store_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fbu_activity_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fbu_order_date_cache: {
        Row: {
          accepted_date: string | null
          cached_at: string | null
          date_created: string | null
          order_id: string
          store_id: string | null
        }
        Insert: {
          accepted_date?: string | null
          cached_at?: string | null
          date_created?: string | null
          order_id: string
          store_id?: string | null
        }
        Update: {
          accepted_date?: string | null
          cached_at?: string | null
          date_created?: string | null
          order_id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fbu_order_date_cache_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          amount: number
          amount_usd: number | null
          category: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          exchange_rate_used: number | null
          id: string
          marketplace_commission: number | null
          marketplace_delivery_fee: number | null
          marketplace_store_id: string | null
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          amount_usd?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          exchange_rate_used?: number | null
          id?: string
          marketplace_commission?: number | null
          marketplace_delivery_fee?: number | null
          marketplace_store_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          amount_usd?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          exchange_rate_used?: number | null
          id?: string
          marketplace_commission?: number | null
          marketplace_delivery_fee?: number | null
          marketplace_store_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_marketplace_store_id_fkey"
            columns: ["marketplace_store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_forecasts: {
        Row: {
          ai_insights: string | null
          ai_model: string | null
          confidence: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          factors: Json | null
          forecast_type: string
          id: string
          period_end: string
          period_start: string
          predicted_amount: number
        }
        Insert: {
          ai_insights?: string | null
          ai_model?: string | null
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          factors?: Json | null
          forecast_type: string
          id?: string
          period_end: string
          period_start: string
          predicted_amount: number
        }
        Update: {
          ai_insights?: string | null
          ai_model?: string | null
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          factors?: Json | null
          forecast_type?: string
          id?: string
          period_end?: string
          period_start?: string
          predicted_amount?: number
        }
        Relationships: []
      }
      financial_periods: {
        Row: {
          accounts_payable_total: number | null
          accounts_receivable_total: number | null
          buying_cost: number | null
          calculated_at: string | null
          cash_inflow: number | null
          cash_outflow: number | null
          closing_inventory_value: number | null
          cost_of_goods_sold: number | null
          currency: string | null
          direct_sales_revenue: number | null
          domestic_shipping_cost: number | null
          gross_profit: number | null
          id: string
          inventory_end_value: number | null
          inventory_start_value: number | null
          marketing_expenses: number | null
          marketplace_revenue: number | null
          net_cash_flow: number | null
          net_profit: number | null
          opening_inventory_value: number | null
          operating_expenses: number | null
          other_expenses: number | null
          other_income: number | null
          payroll_expenses: number | null
          period_end: string
          period_start: string
          period_type: string
          rent_expenses: number | null
          revenue: number | null
          shipping_expenses: number | null
        }
        Insert: {
          accounts_payable_total?: number | null
          accounts_receivable_total?: number | null
          buying_cost?: number | null
          calculated_at?: string | null
          cash_inflow?: number | null
          cash_outflow?: number | null
          closing_inventory_value?: number | null
          cost_of_goods_sold?: number | null
          currency?: string | null
          direct_sales_revenue?: number | null
          domestic_shipping_cost?: number | null
          gross_profit?: number | null
          id?: string
          inventory_end_value?: number | null
          inventory_start_value?: number | null
          marketing_expenses?: number | null
          marketplace_revenue?: number | null
          net_cash_flow?: number | null
          net_profit?: number | null
          opening_inventory_value?: number | null
          operating_expenses?: number | null
          other_expenses?: number | null
          other_income?: number | null
          payroll_expenses?: number | null
          period_end: string
          period_start: string
          period_type: string
          rent_expenses?: number | null
          revenue?: number | null
          shipping_expenses?: number | null
        }
        Update: {
          accounts_payable_total?: number | null
          accounts_receivable_total?: number | null
          buying_cost?: number | null
          calculated_at?: string | null
          cash_inflow?: number | null
          cash_outflow?: number | null
          closing_inventory_value?: number | null
          cost_of_goods_sold?: number | null
          currency?: string | null
          direct_sales_revenue?: number | null
          domestic_shipping_cost?: number | null
          gross_profit?: number | null
          id?: string
          inventory_end_value?: number | null
          inventory_start_value?: number | null
          marketing_expenses?: number | null
          marketplace_revenue?: number | null
          net_cash_flow?: number | null
          net_profit?: number | null
          opening_inventory_value?: number | null
          operating_expenses?: number | null
          other_expenses?: number | null
          other_income?: number | null
          payroll_expenses?: number | null
          period_end?: string
          period_start?: string
          period_type?: string
          rent_expenses?: number | null
          revenue?: number | null
          shipping_expenses?: number | null
        }
        Relationships: []
      }
      handover_invoice_orders: {
        Row: {
          accepted: boolean | null
          created_at: string | null
          handover_invoice_id: string
          id: string
          order_number: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string | null
          handover_invoice_id: string
          id?: string
          order_number: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string | null
          handover_invoice_id?: string
          id?: string
          order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "handover_invoice_orders_handover_invoice_id_fkey"
            columns: ["handover_invoice_id"]
            isOneToOne: false
            referencedRelation: "handover_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_invoices: {
        Row: {
          created_at: string | null
          id: string
          invoice_date: string | null
          invoice_number: string
          matched_items_count: number | null
          not_accepted_count: number | null
          notes: string | null
          pdf_url: string | null
          pickup_point: string | null
          sender_name: string | null
          stock_deducted: boolean | null
          stock_deducted_at: string | null
          total_orders: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number: string
          matched_items_count?: number | null
          not_accepted_count?: number | null
          notes?: string | null
          pdf_url?: string | null
          pickup_point?: string | null
          sender_name?: string | null
          stock_deducted?: boolean | null
          stock_deducted_at?: string | null
          total_orders?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          matched_items_count?: number | null
          not_accepted_count?: number | null
          notes?: string | null
          pdf_url?: string | null
          pickup_point?: string | null
          sender_name?: string | null
          stock_deducted?: boolean | null
          stock_deducted_at?: string | null
          total_orders?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          created_by: string | null
          from_location_id: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string | null
          product_item_id: string | null
          quantity: number | null
          reference_id: string | null
          reference_type: string | null
          to_location_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id?: string | null
          product_item_id?: string | null
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          to_location_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          product_item_id?: string | null
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          to_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_item_id_fkey"
            columns: ["product_item_id"]
            isOneToOne: false
            referencedRelation: "product_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_reports: {
        Row: {
          ai_summary: string | null
          cash_flow: Json | null
          created_at: string
          expenses: number | null
          gross_profit: number | null
          id: string
          inventory_value: number | null
          investment_amount: number | null
          investor_id: string
          net_profit: number | null
          notes: string | null
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          profit_amount: number | null
          report_period: string
          report_type: string | null
          revenue: number | null
          roi_percentage: number | null
          status: string | null
        }
        Insert: {
          ai_summary?: string | null
          cash_flow?: Json | null
          created_at?: string
          expenses?: number | null
          gross_profit?: number | null
          id?: string
          inventory_value?: number | null
          investment_amount?: number | null
          investor_id: string
          net_profit?: number | null
          notes?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          profit_amount?: number | null
          report_period: string
          report_type?: string | null
          revenue?: number | null
          roi_percentage?: number | null
          status?: string | null
        }
        Update: {
          ai_summary?: string | null
          cash_flow?: Json | null
          created_at?: string
          expenses?: number | null
          gross_profit?: number | null
          id?: string
          inventory_value?: number | null
          investment_amount?: number | null
          investor_id?: string
          net_profit?: number | null
          notes?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          profit_amount?: number | null
          report_period?: string
          report_type?: string | null
          revenue?: number | null
          roi_percentage?: number | null
          status?: string | null
        }
        Relationships: []
      }
      marketplace_competitor_prices: {
        Row: {
          captured_at: string | null
          competitor_id: string | null
          discount_percent: number | null
          id: string
          original_price: number | null
          price: number
          rating: number | null
          review_count: number | null
          sales_count: number | null
          stock_status: string | null
        }
        Insert: {
          captured_at?: string | null
          competitor_id?: string | null
          discount_percent?: number | null
          id?: string
          original_price?: number | null
          price: number
          rating?: number | null
          review_count?: number | null
          sales_count?: number | null
          stock_status?: string | null
        }
        Update: {
          captured_at?: string | null
          competitor_id?: string | null
          discount_percent?: number | null
          id?: string
          original_price?: number | null
          price?: number
          rating?: number | null
          review_count?: number | null
          sales_count?: number | null
          stock_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_competitor_prices_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "marketplace_competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_competitors: {
        Row: {
          competitor_name: string
          competitor_product_url: string | null
          competitor_shop_name: string | null
          competitor_sku: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          listing_id: string | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          competitor_name: string
          competitor_product_url?: string | null
          competitor_shop_name?: string | null
          competitor_sku?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          listing_id?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          competitor_name?: string
          competitor_product_url?: string | null
          competitor_shop_name?: string | null
          competitor_sku?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          listing_id?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_competitors_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_competitors_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_finance_summary: {
        Row: {
          cancelled_count: number | null
          commission_total: number | null
          created_at: string | null
          currency: string | null
          delivered_count: number | null
          delivery_fees: number | null
          exchange_rate_used: number | null
          gross_revenue: number | null
          id: string
          items_sold: number | null
          marketing_fees: number | null
          net_revenue: number | null
          orders_count: number | null
          other_fees: number | null
          period_date: string
          period_type: string | null
          return_fees: number | null
          returned_count: number | null
          storage_fees: number | null
          store_id: string
          sync_source: string | null
          synced_at: string | null
          updated_at: string | null
          usd_equivalent: number | null
        }
        Insert: {
          cancelled_count?: number | null
          commission_total?: number | null
          created_at?: string | null
          currency?: string | null
          delivered_count?: number | null
          delivery_fees?: number | null
          exchange_rate_used?: number | null
          gross_revenue?: number | null
          id?: string
          items_sold?: number | null
          marketing_fees?: number | null
          net_revenue?: number | null
          orders_count?: number | null
          other_fees?: number | null
          period_date: string
          period_type?: string | null
          return_fees?: number | null
          returned_count?: number | null
          storage_fees?: number | null
          store_id: string
          sync_source?: string | null
          synced_at?: string | null
          updated_at?: string | null
          usd_equivalent?: number | null
        }
        Update: {
          cancelled_count?: number | null
          commission_total?: number | null
          created_at?: string | null
          currency?: string | null
          delivered_count?: number | null
          delivery_fees?: number | null
          exchange_rate_used?: number | null
          gross_revenue?: number | null
          id?: string
          items_sold?: number | null
          marketing_fees?: number | null
          net_revenue?: number | null
          orders_count?: number | null
          other_fees?: number | null
          period_date?: string
          period_type?: string | null
          return_fees?: number | null
          returned_count?: number | null
          storage_fees?: number | null
          store_id?: string
          sync_source?: string | null
          synced_at?: string | null
          updated_at?: string | null
          usd_equivalent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_finance_summary_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_forecasts: {
        Row: {
          actual_value: number | null
          ai_insights: string | null
          confidence: number | null
          factors: Json | null
          forecast_date: string
          forecast_type: string
          generated_at: string | null
          id: string
          listing_id: string | null
          predicted_value: number
          store_id: string | null
        }
        Insert: {
          actual_value?: number | null
          ai_insights?: string | null
          confidence?: number | null
          factors?: Json | null
          forecast_date: string
          forecast_type: string
          generated_at?: string | null
          id?: string
          listing_id?: string | null
          predicted_value: number
          store_id?: string | null
        }
        Update: {
          actual_value?: number | null
          ai_insights?: string | null
          confidence?: number | null
          factors?: Json | null
          forecast_date?: string
          forecast_type?: string
          generated_at?: string | null
          id?: string
          listing_id?: string | null
          predicted_value?: number
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_forecasts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_forecasts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category_title: string | null
          commission_rate: number | null
          compare_price: number | null
          cost_price: number | null
          created_at: string | null
          currency: string | null
          external_barcode: string | null
          external_offer_id: string | null
          external_product_id: string | null
          external_sku: string
          external_updated_at: string | null
          fulfillment_type: string | null
          id: string
          image_url: string | null
          last_synced_at: string | null
          link_strategy: string | null
          linked_at: string | null
          moderation_status: string | null
          price: number | null
          product_id: string | null
          product_rank: string | null
          status: string | null
          stock: number | null
          stock_fbs: number | null
          stock_fbu: number | null
          stock_fby: number | null
          store_id: string
          sync_error: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          category_title?: string | null
          commission_rate?: number | null
          compare_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          currency?: string | null
          external_barcode?: string | null
          external_offer_id?: string | null
          external_product_id?: string | null
          external_sku: string
          external_updated_at?: string | null
          fulfillment_type?: string | null
          id?: string
          image_url?: string | null
          last_synced_at?: string | null
          link_strategy?: string | null
          linked_at?: string | null
          moderation_status?: string | null
          price?: number | null
          product_id?: string | null
          product_rank?: string | null
          status?: string | null
          stock?: number | null
          stock_fbs?: number | null
          stock_fbu?: number | null
          stock_fby?: number | null
          store_id: string
          sync_error?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          category_title?: string | null
          commission_rate?: number | null
          compare_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          currency?: string | null
          external_barcode?: string | null
          external_offer_id?: string | null
          external_product_id?: string | null
          external_sku?: string
          external_updated_at?: string | null
          fulfillment_type?: string | null
          id?: string
          image_url?: string | null
          last_synced_at?: string | null
          link_strategy?: string | null
          linked_at?: string | null
          moderation_status?: string | null
          price?: number | null
          product_id?: string | null
          product_rank?: string | null
          status?: string | null
          stock?: number | null
          stock_fbs?: number | null
          stock_fbu?: number | null
          stock_fby?: number | null
          store_id?: string
          sync_error?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          accepted_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          commission: number | null
          created_at: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_cost: number | null
          delivery_fee: number | null
          delivery_type: string | null
          exchange_rate_at_order: number | null
          external_order_id: string
          fulfillment_status: string | null
          fulfillment_type: string | null
          id: string
          items: Json
          items_total: number | null
          last_synced_at: string | null
          notes: string | null
          order_number: string | null
          ordered_at: string | null
          payment_status: string | null
          profit: number | null
          shipped_at: string | null
          shipping_address: Json | null
          status: string
          storage_fee: number | null
          store_id: string
          substatus: string | null
          total_amount: number | null
          updated_at: string | null
          usd_equivalent: number | null
        }
        Insert: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          commission?: number | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_cost?: number | null
          delivery_fee?: number | null
          delivery_type?: string | null
          exchange_rate_at_order?: number | null
          external_order_id: string
          fulfillment_status?: string | null
          fulfillment_type?: string | null
          id?: string
          items?: Json
          items_total?: number | null
          last_synced_at?: string | null
          notes?: string | null
          order_number?: string | null
          ordered_at?: string | null
          payment_status?: string | null
          profit?: number | null
          shipped_at?: string | null
          shipping_address?: Json | null
          status: string
          storage_fee?: number | null
          store_id: string
          substatus?: string | null
          total_amount?: number | null
          updated_at?: string | null
          usd_equivalent?: number | null
        }
        Update: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          commission?: number | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_cost?: number | null
          delivery_fee?: number | null
          delivery_type?: string | null
          exchange_rate_at_order?: number | null
          external_order_id?: string
          fulfillment_status?: string | null
          fulfillment_type?: string | null
          id?: string
          items?: Json
          items_total?: number | null
          last_synced_at?: string | null
          notes?: string | null
          order_number?: string | null
          ordered_at?: string | null
          payment_status?: string | null
          profit?: number | null
          shipped_at?: string | null
          shipping_address?: Json | null
          status?: string
          storage_fee?: number | null
          store_id?: string
          substatus?: string | null
          total_amount?: number | null
          updated_at?: string | null
          usd_equivalent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_price_suggestions: {
        Row: {
          applied_at: string | null
          competitor_avg_price: number | null
          competitor_max_price: number | null
          competitor_min_price: number | null
          confidence: number | null
          created_at: string | null
          current_price: number | null
          expected_profit_change: string | null
          expected_sales_change: string | null
          expires_at: string | null
          id: string
          listing_id: string | null
          reasoning: string | null
          recommended_price: number | null
          status: string | null
          store_id: string | null
        }
        Insert: {
          applied_at?: string | null
          competitor_avg_price?: number | null
          competitor_max_price?: number | null
          competitor_min_price?: number | null
          confidence?: number | null
          created_at?: string | null
          current_price?: number | null
          expected_profit_change?: string | null
          expected_sales_change?: string | null
          expires_at?: string | null
          id?: string
          listing_id?: string | null
          reasoning?: string | null
          recommended_price?: number | null
          status?: string | null
          store_id?: string | null
        }
        Update: {
          applied_at?: string | null
          competitor_avg_price?: number | null
          competitor_max_price?: number | null
          competitor_min_price?: number | null
          confidence?: number | null
          created_at?: string | null
          current_price?: number | null
          expected_profit_change?: string | null
          expected_sales_change?: string | null
          expires_at?: string | null
          id?: string
          listing_id?: string | null
          reasoning?: string | null
          recommended_price?: number | null
          status?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_price_suggestions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_price_suggestions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_returns: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          external_order_id: string | null
          id: string
          image_url: string | null
          nakladnoy_id: string | null
          order_id: string | null
          platform: string
          product_id: string | null
          product_title: string
          quantity: number
          resolution: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          return_date: string | null
          return_reason: string | null
          return_type: string | null
          sku_title: string | null
          store_id: string | null
          store_name: string | null
          variant_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          external_order_id?: string | null
          id?: string
          image_url?: string | null
          nakladnoy_id?: string | null
          order_id?: string | null
          platform?: string
          product_id?: string | null
          product_title: string
          quantity?: number
          resolution?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          return_date?: string | null
          return_reason?: string | null
          return_type?: string | null
          sku_title?: string | null
          store_id?: string | null
          store_name?: string | null
          variant_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          external_order_id?: string | null
          id?: string
          image_url?: string | null
          nakladnoy_id?: string | null
          order_id?: string | null
          platform?: string
          product_id?: string | null
          product_title?: string
          quantity?: number
          resolution?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          return_date?: string | null
          return_reason?: string | null
          return_type?: string | null
          sku_title?: string | null
          store_id?: string | null
          store_name?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_returns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_returns_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sales_analytics: {
        Row: {
          avg_order_value: number | null
          commission: number | null
          created_at: string | null
          date: string
          id: string
          orders_count: number | null
          profit: number | null
          returns_count: number | null
          revenue: number | null
          store_id: string | null
          top_product_id: string | null
          units_sold: number | null
          updated_at: string | null
        }
        Insert: {
          avg_order_value?: number | null
          commission?: number | null
          created_at?: string | null
          date: string
          id?: string
          orders_count?: number | null
          profit?: number | null
          returns_count?: number | null
          revenue?: number | null
          store_id?: string | null
          top_product_id?: string | null
          units_sold?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_order_value?: number | null
          commission?: number | null
          created_at?: string | null
          date?: string
          id?: string
          orders_count?: number | null
          profit?: number | null
          returns_count?: number | null
          revenue?: number | null
          store_id?: string | null
          top_product_id?: string | null
          units_sold?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sales_analytics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_stores: {
        Row: {
          api_key_secret_name: string
          auto_sync_enabled: boolean | null
          business_id: string | null
          campaign_id: string | null
          created_at: string | null
          fbs_campaign_id: string | null
          fby_campaign_id: string | null
          fulfillment_type: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          next_sync_at: string | null
          platform: string
          seller_id: string | null
          shop_id: string | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_secret_name: string
          auto_sync_enabled?: boolean | null
          business_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          fbs_campaign_id?: string | null
          fby_campaign_id?: string | null
          fulfillment_type?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          next_sync_at?: string | null
          platform: string
          seller_id?: string | null
          shop_id?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_secret_name?: string
          auto_sync_enabled?: boolean | null
          business_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          fbs_campaign_id?: string | null
          fby_campaign_id?: string | null
          fulfillment_type?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          next_sync_at?: string | null
          platform?: string
          seller_id?: string | null
          shop_id?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      marketplace_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          fulfillment_type: string | null
          id: string
          records_created: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string | null
          status: string
          store_id: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          fulfillment_type?: string | null
          id?: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status: string
          store_id: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          fulfillment_type?: string | null
          id?: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
          store_id?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sync_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sync_queue: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          new_value: number | null
          old_value: number | null
          processed_at: string | null
          product_id: string | null
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          new_value?: number | null
          old_value?: number | null
          processed_at?: string | null
          product_id?: string | null
          status?: string
          sync_type?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          new_value?: number | null
          old_value?: number | null
          processed_at?: string | null
          product_id?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sync_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_status: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_status_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          body: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata: Json | null
          read_at: string | null
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          is_active: boolean | null
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_cards: {
        Row: {
          bank_name: string
          card_holder: string
          card_number: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          bank_name?: string
          card_holder: string
          card_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
        }
        Update: {
          bank_name?: string
          card_holder?: string
          card_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      product_items: {
        Row: {
          box_id: string | null
          cost_breakdown: Json | null
          created_at: string | null
          domestic_shipping_cost: number | null
          exchange_rate_at_purchase: number | null
          exchange_rate_at_sale: number | null
          final_cost_usd: number | null
          id: string
          international_shipping_cost: number | null
          item_uuid: string
          location: string | null
          marketplace: string | null
          notes: string | null
          product_id: string
          sold_at: string | null
          sold_currency: string | null
          sold_price: number | null
          sold_price_usd: number | null
          status: string | null
          unit_cost: number | null
          unit_cost_currency: string | null
          unit_cost_usd: number | null
          updated_at: string | null
          variant_id: string | null
          volume_m3: number | null
          warehouse_location_id: string | null
          weight_grams: number | null
        }
        Insert: {
          box_id?: string | null
          cost_breakdown?: Json | null
          created_at?: string | null
          domestic_shipping_cost?: number | null
          exchange_rate_at_purchase?: number | null
          exchange_rate_at_sale?: number | null
          final_cost_usd?: number | null
          id?: string
          international_shipping_cost?: number | null
          item_uuid: string
          location?: string | null
          marketplace?: string | null
          notes?: string | null
          product_id: string
          sold_at?: string | null
          sold_currency?: string | null
          sold_price?: number | null
          sold_price_usd?: number | null
          status?: string | null
          unit_cost?: number | null
          unit_cost_currency?: string | null
          unit_cost_usd?: number | null
          updated_at?: string | null
          variant_id?: string | null
          volume_m3?: number | null
          warehouse_location_id?: string | null
          weight_grams?: number | null
        }
        Update: {
          box_id?: string | null
          cost_breakdown?: Json | null
          created_at?: string | null
          domestic_shipping_cost?: number | null
          exchange_rate_at_purchase?: number | null
          exchange_rate_at_sale?: number | null
          final_cost_usd?: number | null
          id?: string
          international_shipping_cost?: number | null
          item_uuid?: string
          location?: string | null
          marketplace?: string | null
          notes?: string | null
          product_id?: string
          sold_at?: string | null
          sold_currency?: string | null
          sold_price?: number | null
          sold_price_usd?: number | null
          status?: string | null
          unit_cost?: number | null
          unit_cost_currency?: string | null
          unit_cost_usd?: number | null
          updated_at?: string | null
          variant_id?: string | null
          volume_m3?: number | null
          warehouse_location_id?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_items_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_items_warehouse_location_id_fkey"
            columns: ["warehouse_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          cost_price: number | null
          cost_price_currency: string | null
          created_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          price: number | null
          product_id: string
          selling_price: number | null
          sku: string
          stock_quantity: number | null
          updated_at: string | null
          variant_attributes: Json
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          cost_price?: number | null
          cost_price_currency?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          price?: number | null
          product_id: string
          selling_price?: number | null
          sku: string
          stock_quantity?: number | null
          updated_at?: string | null
          variant_attributes?: Json
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          cost_price?: number | null
          cost_price_currency?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          price?: number | null
          product_id?: string
          selling_price?: number | null
          sku?: string
          stock_quantity?: number | null
          updated_at?: string | null
          variant_attributes?: Json
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          avg_daily_sales: number | null
          barcode: string | null
          brand: string | null
          category: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          custom_attributes: Json | null
          dimensions_cm: Json | null
          domestic_shipping_total: number | null
          gallery_urls: Json | null
          has_variants: boolean | null
          id: string
          last_forecast_date: string | null
          main_image_url: string | null
          marketplace_ready: boolean | null
          model: string | null
          name: string
          notes: string | null
          price: number | null
          price_source: string | null
          purchase_currency: string | null
          purchase_exchange_rate: number | null
          purchase_price_usd: number | null
          purchased_at: string | null
          quantity: number | null
          selling_price: number | null
          shipping_cost_to_china: number | null
          source: string | null
          status: string | null
          store_category_id: string | null
          store_description: string | null
          store_visible: boolean | null
          tashkent_manual_stock: number | null
          tashkent_section: string | null
          updated_at: string
          uuid: string
          warehouse_price: number | null
          weight: number | null
        }
        Insert: {
          avg_daily_sales?: number | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          custom_attributes?: Json | null
          dimensions_cm?: Json | null
          domestic_shipping_total?: number | null
          gallery_urls?: Json | null
          has_variants?: boolean | null
          id?: string
          last_forecast_date?: string | null
          main_image_url?: string | null
          marketplace_ready?: boolean | null
          model?: string | null
          name: string
          notes?: string | null
          price?: number | null
          price_source?: string | null
          purchase_currency?: string | null
          purchase_exchange_rate?: number | null
          purchase_price_usd?: number | null
          purchased_at?: string | null
          quantity?: number | null
          selling_price?: number | null
          shipping_cost_to_china?: number | null
          source?: string | null
          status?: string | null
          store_category_id?: string | null
          store_description?: string | null
          store_visible?: boolean | null
          tashkent_manual_stock?: number | null
          tashkent_section?: string | null
          updated_at?: string
          uuid: string
          warehouse_price?: number | null
          weight?: number | null
        }
        Update: {
          avg_daily_sales?: number | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          custom_attributes?: Json | null
          dimensions_cm?: Json | null
          domestic_shipping_total?: number | null
          gallery_urls?: Json | null
          has_variants?: boolean | null
          id?: string
          last_forecast_date?: string | null
          main_image_url?: string | null
          marketplace_ready?: boolean | null
          model?: string | null
          name?: string
          notes?: string | null
          price?: number | null
          price_source?: string | null
          purchase_currency?: string | null
          purchase_exchange_rate?: number | null
          purchase_price_usd?: number | null
          purchased_at?: string | null
          quantity?: number | null
          selling_price?: number | null
          shipping_cost_to_china?: number | null
          source?: string | null
          status?: string | null
          store_category_id?: string | null
          store_description?: string | null
          store_visible?: boolean | null
          tashkent_manual_stock?: number | null
          tashkent_section?: string | null
          updated_at?: string
          uuid?: string
          warehouse_price?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_hierarchy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_category_id_fkey"
            columns: ["store_category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          language: string | null
          notification_preferences: Json | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          language?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          language?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_order_amount: number | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_amount?: number | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_amount?: number | null
          used_count?: number | null
        }
        Relationships: []
      }
      shift_handoffs: {
        Row: {
          content: string
          created_at: string
          expires_at: string | null
          from_user_id: string
          id: string
          is_read: boolean | null
          location: string
          priority: string | null
          read_at: string | null
          read_by: string | null
          title: string
          to_role: string | null
          to_user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          expires_at?: string | null
          from_user_id: string
          id?: string
          is_read?: boolean | null
          location: string
          priority?: string | null
          read_at?: string | null
          read_by?: string | null
          title: string
          to_role?: string | null
          to_user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          expires_at?: string | null
          from_user_id?: string
          id?: string
          is_read?: boolean | null
          location?: string
          priority?: string | null
          read_at?: string | null
          read_by?: string | null
          title?: string
          to_role?: string | null
          to_user_id?: string | null
        }
        Relationships: []
      }
      shipment_boxes: {
        Row: {
          box_id: string
          created_at: string
          id: string
          shipment_id: string
        }
        Insert: {
          box_id: string
          created_at?: string
          id?: string
          shipment_id: string
        }
        Update: {
          box_id?: string
          created_at?: string
          id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_boxes_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_boxes_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          actual_transit_days: number | null
          arrival_date: string | null
          carrier: string | null
          created_at: string
          created_by: string | null
          departure_date: string | null
          estimated_arrival: string | null
          id: string
          notes: string | null
          predicted_arrival: string | null
          prediction_confidence: number | null
          shipment_number: string
          status: string | null
          total_places: number | null
          total_volume_m3: number | null
          total_weight_kg: number | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          actual_transit_days?: number | null
          arrival_date?: string | null
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          departure_date?: string | null
          estimated_arrival?: string | null
          id?: string
          notes?: string | null
          predicted_arrival?: string | null
          prediction_confidence?: number | null
          shipment_number: string
          status?: string | null
          total_places?: number | null
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          actual_transit_days?: number | null
          arrival_date?: string | null
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          departure_date?: string | null
          estimated_arrival?: string | null
          id?: string
          notes?: string | null
          predicted_arrival?: string | null
          prediction_confidence?: number | null
          shipment_number?: string
          status?: string | null
          total_places?: number | null
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          current_stock: number
          id: string
          is_resolved: boolean | null
          notes: string | null
          product_id: string
          resolved_at: string | null
          resolved_by: string | null
          threshold: number
          variant_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          current_stock: number
          id?: string
          is_resolved?: boolean | null
          notes?: string | null
          product_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          threshold: number
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          current_stock?: number
          id?: string
          is_resolved?: boolean | null
          notes?: string | null
          product_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          threshold?: number
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_audit_log: {
        Row: {
          change_amount: number | null
          change_source: string
          created_at: string | null
          id: string
          new_stock: number | null
          old_stock: number | null
          product_id: string
          reference_id: string | null
        }
        Insert: {
          change_amount?: number | null
          change_source?: string
          created_at?: string | null
          id?: string
          new_stock?: number | null
          old_stock?: number | null
          product_id: string
          reference_id?: string | null
        }
        Update: {
          change_amount?: number | null
          change_source?: string
          created_at?: string | null
          id?: string
          new_stock?: number | null
          old_stock?: number | null
          product_id?: string
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_audit_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_categories: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_ru: string
          name_uz: string
          parent_id: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_ru: string
          name_uz: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_ru?: string
          name_uz?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          new_status: Database["public"]["Enums"]["store_order_status"]
          notes: string | null
          old_status: Database["public"]["Enums"]["store_order_status"] | null
          order_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["store_order_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["store_order_status"] | null
          order_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["store_order_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["store_order_status"] | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          confirmed_by: string | null
          created_at: string | null
          customer_address: string | null
          customer_card_number: string | null
          customer_name: string
          customer_phone: string
          delivery_fee: number | null
          delivery_type:
            | Database["public"]["Enums"]["store_delivery_type"]
            | null
          discount_amount: number | null
          id: string
          items: Json
          notes: string | null
          order_number: string | null
          payment_type: Database["public"]["Enums"]["store_payment_type"] | null
          paynet_invoice_url: string | null
          paynet_status: string | null
          paynet_transaction_id: string | null
          promo_code: string | null
          status: Database["public"]["Enums"]["store_order_status"] | null
          subtotal: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          confirmed_by?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_card_number?: string | null
          customer_name: string
          customer_phone: string
          delivery_fee?: number | null
          delivery_type?:
            | Database["public"]["Enums"]["store_delivery_type"]
            | null
          discount_amount?: number | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string | null
          payment_type?:
            | Database["public"]["Enums"]["store_payment_type"]
            | null
          paynet_invoice_url?: string | null
          paynet_status?: string | null
          paynet_transaction_id?: string | null
          promo_code?: string | null
          status?: Database["public"]["Enums"]["store_order_status"] | null
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          confirmed_by?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_card_number?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number | null
          delivery_type?:
            | Database["public"]["Enums"]["store_delivery_type"]
            | null
          discount_amount?: number | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string | null
          payment_type?:
            | Database["public"]["Enums"]["store_payment_type"]
            | null
          paynet_invoice_url?: string | null
          paynet_status?: string | null
          paynet_transaction_id?: string | null
          promo_code?: string | null
          status?: Database["public"]["Enums"]["store_order_status"] | null
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      store_profit_distribution: {
        Row: {
          created_at: string | null
          id: string
          investor_share_pct: number
          investor_user_id: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          investor_share_pct?: number
          investor_user_id?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          investor_share_pct?: number
          investor_user_id?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_profit_distribution_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      system_map_connections: {
        Row: {
          color: string | null
          created_at: string | null
          dashed: boolean | null
          from_node: string
          id: string
          opacity: number | null
          to_node: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          dashed?: boolean | null
          from_node: string
          id?: string
          opacity?: number | null
          to_node: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          dashed?: boolean | null
          from_node?: string
          id?: string
          opacity?: number | null
          to_node?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_map_connections_from_node_fkey"
            columns: ["from_node"]
            isOneToOne: false
            referencedRelation: "system_map_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_map_connections_to_node_fkey"
            columns: ["to_node"]
            isOneToOne: false
            referencedRelation: "system_map_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      system_map_nodes: {
        Row: {
          color: string
          created_at: string | null
          id: string
          label: string
          ring: number
          sector: number
          text_color: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          id: string
          label: string
          ring: number
          sector: number
          text_color?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          label?: string
          ring?: number
          sector?: number
          text_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      task_activity_log: {
        Row: {
          action: string
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          dependency_type: string | null
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          dependency_type?: string | null
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          dependency_type?: string | null
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          created_by: string
          default_entity_type: string | null
          default_location: string | null
          default_priority: string | null
          description: string | null
          description_template: string | null
          estimated_duration_hours: number | null
          id: string
          is_active: boolean | null
          name: string
          title_template: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_entity_type?: string | null
          default_location?: string | null
          default_priority?: string | null
          description?: string | null
          description_template?: string | null
          estimated_duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          title_template: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_entity_type?: string | null
          default_location?: string | null
          default_priority?: string | null
          description?: string | null
          description_template?: string | null
          estimated_duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          title_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_recurring: boolean | null
          location: string | null
          next_occurrence: string | null
          parent_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurring_pattern: Json | null
          status: Database["public"]["Enums"]["task_status"]
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          next_occurrence?: string | null
          parent_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurring_pattern?: Json | null
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          next_occurrence?: string | null
          parent_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurring_pattern?: Json | null
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          attachments: Json | null
          channel: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean | null
          is_pinned: boolean | null
          mentions: string[] | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          channel?: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          mentions?: string[] | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          channel?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          mentions?: string[] | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_users: {
        Row: {
          created_at: string | null
          id: string
          is_verified: boolean | null
          language: string | null
          notify_arrivals: boolean | null
          notify_daily_summary: boolean | null
          notify_defects: boolean | null
          notify_low_stock: boolean | null
          notify_marketplace_orders: boolean | null
          notify_messages: boolean | null
          notify_shipments: boolean | null
          notify_tasks: boolean | null
          telegram_chat_id: string
          telegram_username: string | null
          updated_at: string | null
          user_id: string | null
          verification_code: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          language?: string | null
          notify_arrivals?: boolean | null
          notify_daily_summary?: boolean | null
          notify_defects?: boolean | null
          notify_low_stock?: boolean | null
          notify_marketplace_orders?: boolean | null
          notify_messages?: boolean | null
          notify_shipments?: boolean | null
          notify_tasks?: boolean | null
          telegram_chat_id: string
          telegram_username?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_code?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          language?: string | null
          notify_arrivals?: boolean | null
          notify_daily_summary?: boolean | null
          notify_defects?: boolean | null
          notify_low_stock?: boolean | null
          notify_marketplace_orders?: boolean | null
          notify_messages?: boolean | null
          notify_shipments?: boolean | null
          notify_tasks?: boolean | null
          telegram_chat_id?: string
          telegram_username?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_code?: string | null
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          location: string | null
          metadata: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          location?: string | null
          metadata?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          location?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          current_activity: string | null
          current_entity_id: string | null
          current_entity_type: string | null
          id: string
          last_seen_at: string
          location: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_activity?: string | null
          current_entity_id?: string | null
          current_entity_type?: string | null
          id?: string
          last_seen_at?: string
          location?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_activity?: string | null
          current_entity_id?: string | null
          current_entity_type?: string | null
          id?: string
          last_seen_at?: string
          location?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      uzum_category_commissions: {
        Row: {
          category_name: string
          category_name_uz: string | null
          commission_rate: number
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          category_name: string
          category_name_uz?: string | null
          commission_rate: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          category_name?: string
          category_name_uz?: string | null
          commission_rate?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      variant_sku_mappings: {
        Row: {
          created_at: string
          external_sku: string
          id: string
          store_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          external_sku: string
          id?: string
          store_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          external_sku?: string
          id?: string
          store_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_sku_mappings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_sku_mappings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_items: {
        Row: {
          ai_confidence: number | null
          ai_processed_at: string | null
          ai_suggestion: string | null
          created_at: string | null
          defect_type: string | null
          id: string
          notes: string | null
          photo_urls: Json | null
          product_item_id: string
          session_id: string
          status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_processed_at?: string | null
          ai_suggestion?: string | null
          created_at?: string | null
          defect_type?: string | null
          id?: string
          notes?: string | null
          photo_urls?: Json | null
          product_item_id: string
          session_id: string
          status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_processed_at?: string | null
          ai_suggestion?: string | null
          created_at?: string | null
          defect_type?: string | null
          id?: string
          notes?: string | null
          photo_urls?: Json | null
          product_item_id?: string
          session_id?: string
          status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_items_product_item_id_fkey"
            columns: ["product_item_id"]
            isOneToOne: false
            referencedRelation: "product_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_sessions: {
        Row: {
          box_id: string
          completed_at: string | null
          created_at: string | null
          defective_count: number | null
          id: string
          missing_count: number | null
          notes: string | null
          ok_count: number | null
          started_at: string | null
          status: string | null
          total_items: number | null
          updated_at: string | null
          verified_by: string | null
          verified_count: number | null
        }
        Insert: {
          box_id: string
          completed_at?: string | null
          created_at?: string | null
          defective_count?: number | null
          id?: string
          missing_count?: number | null
          notes?: string | null
          ok_count?: number | null
          started_at?: string | null
          status?: string | null
          total_items?: number | null
          updated_at?: string | null
          verified_by?: string | null
          verified_count?: number | null
        }
        Update: {
          box_id?: string
          completed_at?: string | null
          created_at?: string | null
          defective_count?: number | null
          id?: string
          missing_count?: number | null
          notes?: string | null
          ok_count?: number | null
          started_at?: string | null
          status?: string | null
          total_items?: number | null
          updated_at?: string | null
          verified_by?: string | null
          verified_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_sessions_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locations: {
        Row: {
          capacity: number | null
          category_id: string | null
          created_at: string | null
          current_count: number | null
          id: string
          is_active: boolean | null
          position: string | null
          shelf: string | null
          updated_at: string | null
          warehouse_id: string
          zone: string
        }
        Insert: {
          capacity?: number | null
          category_id?: string | null
          created_at?: string | null
          current_count?: number | null
          id?: string
          is_active?: boolean | null
          position?: string | null
          shelf?: string | null
          updated_at?: string | null
          warehouse_id: string
          zone: string
        }
        Update: {
          capacity?: number | null
          category_id?: string | null
          created_at?: string | null
          current_count?: number | null
          id?: string
          is_active?: boolean | null
          position?: string | null
          shelf?: string | null
          updated_at?: string | null
          warehouse_id?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_hierarchy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          location: string
          name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          location: string
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          location?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_distribute_box_shipping_cost: {
        Args: {
          p_box_id: string
          p_shipping_cost: number
          p_usd_to_uzs?: number
          p_volume_m3?: number
        }
        Returns: Json
      }
      confirm_arrived_products: {
        Args: { p_item_ids: string[] }
        Returns: Json
      }
      decrement_tashkent_stock: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_variant_id?: string
        }
        Returns: undefined
      }
      distribute_international_shipping: {
        Args: { p_box_ids: string[]; p_total_shipping_cost: number }
        Returns: undefined
      }
      distribute_shipping_by_weight: {
        Args: { p_box_ids: string[]; p_total_shipping_cost: number }
        Returns: undefined
      }
      generate_receipt_number: { Args: never; Returns: string }
      get_daily_finance_summary: { Args: { p_date: string }; Returns: Json }
      get_finance_balance: { Args: never; Returns: Json }
      get_orders_by_sku: {
        Args: {
          p_fulfillment_type?: string
          p_product_id?: string
          p_sku: string
          p_store_id: string
        }
        Returns: {
          accepted_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          commission: number | null
          created_at: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_cost: number | null
          delivery_fee: number | null
          delivery_type: string | null
          exchange_rate_at_order: number | null
          external_order_id: string
          fulfillment_status: string | null
          fulfillment_type: string | null
          id: string
          items: Json
          items_total: number | null
          last_synced_at: string | null
          notes: string | null
          order_number: string | null
          ordered_at: string | null
          payment_status: string | null
          profit: number | null
          shipped_at: string | null
          shipping_address: Json | null
          status: string
          storage_fee: number | null
          store_id: string
          substatus: string | null
          total_amount: number | null
          updated_at: string | null
          usd_equivalent: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "marketplace_orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_tashkent_stock: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_variant_id?: string
        }
        Returns: undefined
      }
      mark_box_arrived_on_scan:
        | { Args: { p_box_id: string }; Returns: Json }
        | { Args: { p_box_id: string; p_user_id: string }; Returns: Json }
      suggest_products_from_listings: {
        Args: never
        Returns: {
          external_barcode: string
          external_sku: string
          listing_count: number
          store_names: string
          suggested_name: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "rahbar"
        | "bosh_admin"
        | "xitoy_manager"
        | "xitoy_packer"
        | "xitoy_receiver"
        | "uz_manager"
        | "uz_receiver"
        | "uz_quality"
        | "manager"
        | "kuryer"
        | "moliya_xodimi"
        | "investor"
      attribute_type:
        | "text"
        | "number"
        | "select"
        | "multi_select"
        | "boolean"
        | "date"
        | "color"
        | "size"
      listing_status:
        | "draft"
        | "pending"
        | "active"
        | "paused"
        | "rejected"
        | "sold_out"
      store_delivery_type: "delivery" | "pickup"
      store_order_status:
        | "new"
        | "confirmed"
        | "preparing"
        | "delivering"
        | "delivered"
        | "cancelled"
      store_payment_type: "cash" | "card" | "transfer"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "review" | "done" | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "rahbar",
        "bosh_admin",
        "xitoy_manager",
        "xitoy_packer",
        "xitoy_receiver",
        "uz_manager",
        "uz_receiver",
        "uz_quality",
        "manager",
        "kuryer",
        "moliya_xodimi",
        "investor",
      ],
      attribute_type: [
        "text",
        "number",
        "select",
        "multi_select",
        "boolean",
        "date",
        "color",
        "size",
      ],
      listing_status: [
        "draft",
        "pending",
        "active",
        "paused",
        "rejected",
        "sold_out",
      ],
      store_delivery_type: ["delivery", "pickup"],
      store_order_status: [
        "new",
        "confirmed",
        "preparing",
        "delivering",
        "delivered",
        "cancelled",
      ],
      store_payment_type: ["cash", "card", "transfer"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "done", "cancelled"],
    },
  },
} as const
