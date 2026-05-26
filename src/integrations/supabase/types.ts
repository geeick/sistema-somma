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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      campaign_participants: {
        Row: {
          campaign_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_costs"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          artist: string | null
          audio_reference: string | null
          audio_url: string | null
          audio_urls: Json | null
          brief: string | null
          budget: number | null
          client: string | null
          code: string | null
          created_at: string
          created_by: string | null
          end_date: string
          example_urls: Json | null
          id: string
          max_posts_per_creator: number | null
          min_posts_per_creator: number | null
          payout_model: string | null
          platforms: Database["public"]["Enums"]["platform_type"][] | null
          recommended_tags: string[] | null
          required_tags: string[] | null
          rules: Json | null
          start_date: string
          status: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          artist?: string | null
          audio_reference?: string | null
          audio_url?: string | null
          audio_urls?: Json | null
          brief?: string | null
          budget?: number | null
          client?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          example_urls?: Json | null
          id?: string
          max_posts_per_creator?: number | null
          min_posts_per_creator?: number | null
          payout_model?: string | null
          platforms?: Database["public"]["Enums"]["platform_type"][] | null
          recommended_tags?: string[] | null
          required_tags?: string[] | null
          rules?: Json | null
          start_date: string
          status?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          artist?: string | null
          audio_reference?: string | null
          audio_url?: string | null
          audio_urls?: Json | null
          brief?: string | null
          budget?: number | null
          client?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          example_urls?: Json | null
          id?: string
          max_posts_per_creator?: number | null
          min_posts_per_creator?: number | null
          payout_model?: string | null
          platforms?: Database["public"]["Enums"]["platform_type"][] | null
          recommended_tags?: string[] | null
          required_tags?: string[] | null
          rules?: Json | null
          start_date?: string
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string | null
          error_code: string
          error_message: string
          error_stack: string | null
          id: string
          metadata: Json | null
          page_url: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_code: string
          error_message: string
          error_stack?: string | null
          id?: string
          metadata?: Json | null
          page_url?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_code?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          metadata?: Json | null
          page_url?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean | null
          id: string
          key: string
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean | null
          id?: string
          key: string
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean | null
          id?: string
          key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ledger: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          ref_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          ref_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          ref_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_tags: {
        Row: {
          page_id: string
          tag_id: string
        }
        Insert: {
          page_id: string
          tag_id: string
        }
        Update: {
          page_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_tags_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          average_views: number | null
          created_at: string
          follower_count: number | null
          handle: string
          id: string
          platform: Database["public"]["Enums"]["platform_type"]
          status: string | null
          tags: string[] | null
          updated_at: string
          url: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          average_views?: number | null
          created_at?: string
          follower_count?: number | null
          handle: string
          id?: string
          platform: Database["public"]["Enums"]["platform_type"]
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          url: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          average_views?: number | null
          created_at?: string
          follower_count?: number | null
          handle?: string
          id?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          url?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_tiers: {
        Row: {
          created_at: string | null
          id: string
          max_views: number | null
          min_views: number
          payout_brl: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_views?: number | null
          min_views: number
          payout_brl: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_views?: number | null
          min_views?: number
          payout_brl?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance_available: number | null
          balance_total: number | null
          cpf: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string
          legal_name: string | null
          phone: string | null
          pix_key: string | null
          terms_accepted_at: string | null
          total_earnings: number | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          balance_available?: number | null
          balance_total?: number | null
          cpf?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          legal_name?: string | null
          phone?: string | null
          pix_key?: string | null
          terms_accepted_at?: string | null
          total_earnings?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          balance_available?: number | null
          balance_total?: number | null
          cpf?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          legal_name?: string | null
          phone?: string | null
          pix_key?: string | null
          terms_accepted_at?: string | null
          total_earnings?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      rankings: {
        Row: {
          campaign_id: string
          id: string
          provisional_payout: number | null
          score: number | null
          tier: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          provisional_payout?: number | null
          score?: number | null
          tier?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          provisional_payout?: number | null
          score?: number | null
          tier?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rankings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_costs"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "rankings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshots: {
        Row: {
          comments: number | null
          id: string
          likes: number | null
          shares: number | null
          submission_id: string
          timestamp: string
          views: number | null
        }
        Insert: {
          comments?: number | null
          id?: string
          likes?: number | null
          shares?: number | null
          submission_id: string
          timestamp?: string
          views?: number | null
        }
        Update: {
          comments?: number | null
          id?: string
          likes?: number | null
          shares?: number | null
          submission_id?: string
          timestamp?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "active_campaign_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshots_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      strikes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          level: string
          reason: string
          removed_at: string | null
          removed_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          level: string
          reason: string
          removed_at?: string | null
          removed_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          level?: string
          reason?: string
          removed_at?: string | null
          removed_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          approved_at: string | null
          audio_verified: boolean | null
          campaign_id: string | null
          description: string | null
          id: string
          page_id: string | null
          paid_at: string | null
          payment_amount: number | null
          platform: Database["public"]["Enums"]["platform_type"]
          post_url: string | null
          reason_code: string | null
          status: Database["public"]["Enums"]["video_status"] | null
          thumbnail_url: string | null
          title: string
          uploaded_at: string | null
          user_id: string
          video_url: string | null
          views_count: number | null
        }
        Insert: {
          approved_at?: string | null
          audio_verified?: boolean | null
          campaign_id?: string | null
          description?: string | null
          id?: string
          page_id?: string | null
          paid_at?: string | null
          payment_amount?: number | null
          platform: Database["public"]["Enums"]["platform_type"]
          post_url?: string | null
          reason_code?: string | null
          status?: Database["public"]["Enums"]["video_status"] | null
          thumbnail_url?: string | null
          title: string
          uploaded_at?: string | null
          user_id: string
          video_url?: string | null
          views_count?: number | null
        }
        Update: {
          approved_at?: string | null
          audio_verified?: boolean | null
          campaign_id?: string | null
          description?: string | null
          id?: string
          page_id?: string | null
          paid_at?: string | null
          payment_amount?: number | null
          platform?: Database["public"]["Enums"]["platform_type"]
          post_url?: string | null
          reason_code?: string | null
          status?: Database["public"]["Enums"]["video_status"] | null
          thumbnail_url?: string | null
          title?: string
          uploaded_at?: string | null
          user_id?: string
          video_url?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_costs"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_templates: {
        Row: {
          body_md: string
          created_at: string | null
          id: string
          key: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          body_md: string
          created_at?: string | null
          id?: string
          key: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          body_md?: string
          created_at?: string | null
          id?: string
          key?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          slug: string
          synonyms: string[] | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          slug: string
          synonyms?: string[] | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          synonyms?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          active: boolean | null
          created_at: string | null
          events: string[]
          id: string
          secret: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          events: string[]
          id?: string
          secret?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          events?: string[]
          id?: string
          secret?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          approved_at: string | null
          id: string
          paid_at: string | null
          pix_key: string
          receipt_ref: string | null
          requested_at: string
          status: string | null
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          id?: string
          paid_at?: string | null
          pix_key: string
          receipt_ref?: string | null
          requested_at?: string
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          id?: string
          paid_at?: string | null
          pix_key?: string
          receipt_ref?: string | null
          requested_at?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_campaign_submissions: {
        Row: {
          campaign_id: string | null
          campaign_status: string | null
          campaign_title: string | null
          id: string | null
          payment_amount: number | null
          platform: Database["public"]["Enums"]["platform_type"] | null
          post_url: string | null
          status: Database["public"]["Enums"]["video_status"] | null
          uploaded_at: string | null
          user_id: string | null
          views_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_costs"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_costs: {
        Row: {
          budget: number | null
          campaign_id: string | null
          code: string | null
          remaining_budget: number | null
          title: string | null
          total_cost: number | null
          total_submissions: number | null
          total_views: number | null
        }
        Relationships: []
      }
      creator_count_v: {
        Row: {
          creator_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_provisional_payout: { Args: never; Returns: undefined }
      compute_payout: { Args: { views_count: number }; Returns: number }
      expire_past_campaigns: { Args: never; Returns: undefined }
      finalize_submission_payout: {
        Args: { sub_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { uid: string }; Returns: boolean }
      reverse_submission_payout: {
        Args: { submission_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "finance" | "creator"
      platform_type: "instagram" | "tiktok" | "youtube_shorts" | "twitter"
      video_status: "pending" | "approved" | "rejected" | "paid" | "deleted"
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
      app_role: ["admin", "finance", "creator"],
      platform_type: ["instagram", "tiktok", "youtube_shorts", "twitter"],
      video_status: ["pending", "approved", "rejected", "paid", "deleted"],
    },
  },
} as const
