export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      brands: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          shopify_domain: string | null;
          settings: Json | null;
          brand_voice_json: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          shopify_domain?: string | null;
          settings?: Json | null;
          brand_voice_json?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          shopify_domain?: string | null;
          settings?: Json | null;
          brand_voice_json?: Json | null;
          created_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          brand_id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          created_at: string;
          total_spent: number;
          order_count: number;
          last_order_at: string | null;
          last_visit_at: string | null;
          total_visits: number;
          klaviyo_id: string | null;
          email_consent: string | null;
          predicted_gender: string | null;
        };
        Insert: {
          id?: string;
          brand_id: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string;
          total_spent?: number;
          order_count?: number;
          last_order_at?: string | null;
          last_visit_at?: string | null;
          total_visits?: number;
          klaviyo_id?: string | null;
          email_consent?: string | null;
          predicted_gender?: string | null;
        };
        Update: {
          id?: string;
          brand_id?: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string;
          total_spent?: number;
          order_count?: number;
          last_order_at?: string | null;
          last_visit_at?: string | null;
          total_visits?: number;
          klaviyo_id?: string | null;
          email_consent?: string | null;
          predicted_gender?: string | null;
        };
      };
      orders: {
        Row: {
          id: string;
          customer_id: string;
          total: number;
          created_at: string;
          items: Json;
          shopify_order_id: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          total: number;
          created_at?: string;
          items?: Json;
          shopify_order_id?: string | null;
        };
        Update: {
          id?: string;
          customer_id?: string;
          total?: number;
          created_at?: string;
          items?: Json;
          shopify_order_id?: string | null;
        };
      };
      receipts: {
        Row: {
          id: string;
          order_id: string;
          customer_id: string;
          file_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          customer_id: string;
          file_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          customer_id?: string;
          file_url?: string | null;
          created_at?: string;
        };
      };
      web_sessions: {
        Row: {
          id: string;
          customer_id: string;
          started_at: string;
          pageviews: number;
          products_viewed: Json;
          duration_seconds: number;
        };
        Insert: {
          id?: string;
          customer_id: string;
          started_at?: string;
          pageviews?: number;
          products_viewed?: Json;
          duration_seconds?: number;
        };
        Update: {
          id?: string;
          customer_id?: string;
          started_at?: string;
          pageviews?: number;
          products_viewed?: Json;
          duration_seconds?: number;
        };
      };
      products: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          price: number;
          image_url: string | null;
          category: string | null;
          shopify_product_id: string | null;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          price?: number;
          image_url?: string | null;
          category?: string | null;
          shopify_product_id?: string | null;
        };
        Update: {
          id?: string;
          brand_id?: string;
          name?: string;
          price?: number;
          image_url?: string | null;
          category?: string | null;
          shopify_product_id?: string | null;
        };
      };
      segments: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          description: string;
          mood_gradient: string;
          customer_count: number;
          avg_ltv: number;
          ai_suggestion: string;
          criteria_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          description?: string;
          mood_gradient?: string;
          customer_count?: number;
          avg_ltv?: number;
          ai_suggestion?: string;
          criteria_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          name?: string;
          description?: string;
          mood_gradient?: string;
          customer_count?: number;
          avg_ltv?: number;
          ai_suggestion?: string;
          criteria_json?: Json;
          created_at?: string;
        };
      };
      segment_memberships: {
        Row: {
          id: string;
          segment_id: string;
          customer_id: string;
          probability_to_purchase: number;
          predicted_next_product_id: string | null;
        };
        Insert: {
          id?: string;
          segment_id: string;
          customer_id: string;
          probability_to_purchase?: number;
          predicted_next_product_id?: string | null;
        };
        Update: {
          id?: string;
          segment_id?: string;
          customer_id?: string;
          probability_to_purchase?: number;
          predicted_next_product_id?: string | null;
        };
      };
      campaigns: {
        Row: {
          id: string;
          brand_id: string;
          segment_id: string | null;
          channel: string;
          subject: string | null;
          body: string | null;
          scheduled_at: string | null;
          status: string;
          ai_generated: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          segment_id?: string | null;
          channel?: string;
          subject?: string | null;
          body?: string | null;
          scheduled_at?: string | null;
          status?: string;
          ai_generated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          segment_id?: string | null;
          channel?: string;
          subject?: string | null;
          body?: string | null;
          scheduled_at?: string | null;
          status?: string;
          ai_generated?: boolean;
          created_at?: string;
        };
      };
      launches: {
        Row: {
          id: string;
          brand_id: string;
          product_id: string | null;
          launch_date: string | null;
          target_segments: Json;
          campaign_sequence_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          product_id?: string | null;
          launch_date?: string | null;
          target_segments?: Json;
          campaign_sequence_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          product_id?: string | null;
          launch_date?: string | null;
          target_segments?: Json;
          campaign_sequence_json?: Json;
          created_at?: string;
        };
      };
      ai_insights: {
        Row: {
          id: string;
          brand_id: string;
          type: string;
          title: string;
          body: string;
          action_label: string | null;
          priority: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          type?: string;
          title: string;
          body: string;
          action_label?: string | null;
          priority?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          type?: string;
          title?: string;
          body?: string;
          action_label?: string | null;
          priority?: number;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type Receipt = Database["public"]["Tables"]["receipts"]["Row"];
export type WebSession = Database["public"]["Tables"]["web_sessions"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Segment = Database["public"]["Tables"]["segments"]["Row"];
export type SegmentMembership = Database["public"]["Tables"]["segment_memberships"]["Row"];
export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type Launch = Database["public"]["Tables"]["launches"]["Row"];
export type AiInsight = Database["public"]["Tables"]["ai_insights"]["Row"];
