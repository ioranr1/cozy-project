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
      access_tokens: {
        Row: {
          created_at: string
          created_by_profile_id: string
          current_views: number
          device_id: string
          expires_at: string
          id: string
          is_revoked: boolean
          max_views: number | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          current_views?: number
          device_id: string
          expires_at: string
          id?: string
          is_revoked?: boolean
          max_views?: number | null
          token?: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          current_views?: number
          device_id?: string
          expires_at?: string
          id?: string
          is_revoked?: boolean
          max_views?: number | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_tokens_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_tokens_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_events: {
        Row: {
          ai_confidence: number | null
          ai_is_real: boolean | null
          ai_summary: string | null
          archived_at: string
          created_at: string
          device_id: string
          event_type: string
          id: string
          original_event_id: string
          severity: string | null
          viewed_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_is_real?: boolean | null
          ai_summary?: string | null
          archived_at?: string
          created_at: string
          device_id: string
          event_type: string
          id?: string
          original_event_id: string
          severity?: string | null
          viewed_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_is_real?: boolean | null
          ai_summary?: string | null
          archived_at?: string
          created_at?: string
          device_id?: string
          event_type?: string
          id?: string
          original_event_id?: string
          severity?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_desync_reports: {
        Row: {
          created_at: string
          device_id: string
          id: string
          issue: string
          reporter_profile_id: string
          resolved_at: string | null
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          issue: string
          reporter_profile_id: string
          resolved_at?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          issue?: string
          reporter_profile_id?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camera_desync_reports_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_desync_reports_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commands: {
        Row: {
          command: string
          created_at: string
          device_id: string
          error_message: string | null
          handled: boolean
          handled_at: string | null
          id: string
          requester_profile_id: string | null
          status: string
        }
        Insert: {
          command: string
          created_at?: string
          device_id: string
          error_message?: string | null
          handled?: boolean
          handled_at?: string | null
          id?: string
          requester_profile_id?: string | null
          status?: string
        }
        Update: {
          command?: string
          created_at?: string
          device_id?: string
          error_message?: string | null
          handled?: boolean
          handled_at?: string | null
          id?: string
          requester_profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_notification_state: {
        Row: {
          created_at: string
          device_id: string
          last_whatsapp_sent_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id: string
          last_whatsapp_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          last_whatsapp_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_notification_state_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_status: {
        Row: {
          baby_monitor_enabled: boolean
          created_at: string
          device_id: string
          device_mode: string
          id: string
          is_armed: boolean
          last_command: string | null
          last_command_at: string | null
          motion_enabled: boolean
          security_enabled: boolean
          sound_enabled: boolean
          updated_at: string
        }
        Insert: {
          baby_monitor_enabled?: boolean
          created_at?: string
          device_id: string
          device_mode?: string
          id?: string
          is_armed?: boolean
          last_command?: string | null
          last_command_at?: string | null
          motion_enabled?: boolean
          security_enabled?: boolean
          sound_enabled?: boolean
          updated_at?: string
        }
        Update: {
          baby_monitor_enabled?: boolean
          created_at?: string
          device_id?: string
          device_mode?: string
          id?: string
          is_armed?: boolean
          last_command?: string | null
          last_command_at?: string | null
          motion_enabled?: boolean
          security_enabled?: boolean
          sound_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_status_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          device_auth_token: string | null
          device_auth_token_created_at: string | null
          device_name: string
          device_type: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          device_auth_token?: string | null
          device_auth_token_created_at?: string | null
          device_name: string
          device_type: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string
          device_auth_token?: string | null
          device_auth_token_created_at?: string | null
          device_name?: string
          device_type?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          created_at: string
          device_id: string
          ended_at: string | null
          expires_at: string
          id: string
          max_duration_seconds: number
          started_at: string
          status: string
          viewer_profile_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          ended_at?: string | null
          expires_at: string
          id?: string
          max_duration_seconds?: number
          started_at?: string
          status?: string
          viewer_profile_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          max_duration_seconds?: number
          started_at?: string
          status?: string
          viewer_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_viewer_profile_id_fkey"
            columns: ["viewer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_config: {
        Row: {
          config: Json
          created_at: string
          device_id: string
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          device_id: string
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          device_id?: string
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_config_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_config_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_events: {
        Row: {
          ai_confidence: number | null
          ai_is_real: boolean | null
          ai_summary: string | null
          ai_validated: boolean | null
          ai_validated_at: string | null
          created_at: string
          device_id: string
          event_type: string
          has_local_clip: boolean
          id: string
          labels: Json
          local_clip_duration_seconds: number | null
          local_clip_filename: string | null
          metadata: Json | null
          notification_sent: boolean
          notification_sent_at: string | null
          notification_type: string | null
          reminder_sent: boolean
          reminder_sent_at: string | null
          severity: string | null
          snapshot_url: string | null
          viewed_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_is_real?: boolean | null
          ai_summary?: string | null
          ai_validated?: boolean | null
          ai_validated_at?: string | null
          created_at?: string
          device_id: string
          event_type: string
          has_local_clip?: boolean
          id?: string
          labels?: Json
          local_clip_duration_seconds?: number | null
          local_clip_filename?: string | null
          metadata?: Json | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          notification_type?: string | null
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          severity?: string | null
          snapshot_url?: string | null
          viewed_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_is_real?: boolean | null
          ai_summary?: string | null
          ai_validated?: boolean | null
          ai_validated_at?: string | null
          created_at?: string
          device_id?: string
          event_type?: string
          has_local_clip?: boolean
          id?: string
          labels?: Json
          local_clip_duration_seconds?: number | null
          local_clip_filename?: string | null
          metadata?: Json | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          notification_type?: string | null
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          severity?: string | null
          snapshot_url?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number | null
          code: string
          country_code: string
          created_at: string
          expires_at: string
          id: string
          phone_number: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          code: string
          country_code: string
          created_at?: string
          expires_at: string
          id?: string
          phone_number: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          code?: string
          country_code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone_number?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      pairing_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          profile_id: string
          used_at: string | null
          used_by_device_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          profile_id: string
          used_at?: string | null
          used_by_device_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          profile_id?: string
          used_at?: string | null
          used_by_device_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pairing_codes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pairing_codes_used_by_device_id_fkey"
            columns: ["used_by_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_away_enabled: boolean
          country_code: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone_number: string
          phone_verified: boolean | null
          preferred_language: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auto_away_enabled?: boolean
          country_code?: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone_number: string
          phone_verified?: boolean | null
          preferred_language?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auto_away_enabled?: boolean
          country_code?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone_number?: string
          phone_verified?: boolean | null
          preferred_language?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rtc_sessions: {
        Row: {
          created_at: string | null
          device_id: string
          ended_at: string | null
          fail_reason: string | null
          id: string
          status: string
          viewer_id: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          ended_at?: string | null
          fail_reason?: string | null
          id?: string
          status?: string
          viewer_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          ended_at?: string | null
          fail_reason?: string | null
          id?: string
          status?: string
          viewer_id?: string
        }
        Relationships: []
      }
      rtc_signals: {
        Row: {
          created_at: string | null
          from_role: string
          id: number
          payload: Json
          session_id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          from_role: string
          id?: never
          payload: Json
          session_id: string
          type: string
        }
        Update: {
          created_at?: string | null
          from_role?: string
          id?: never
          payload?: Json
          session_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rtc_signals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "rtc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          expires_at: string
          id: string
          last_used_at: string
          profile_id: string
          session_token: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          expires_at: string
          id?: string
          last_used_at?: string
          profile_id: string
          session_token?: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          expires_at?: string
          id?: string
          last_used_at?: string
          profile_id?: string
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_whatsapp_send_slot: {
        Args: { p_cooldown_ms?: number; p_device_id: string }
        Returns: boolean
      }
      get_profile_auto_away: {
        Args: { _profile_id: string }
        Returns: {
          auto_away_enabled: boolean
          profile_exists: boolean
        }[]
      }
      profile_exists: { Args: { _profile_id: string }; Returns: boolean }
      validate_access_token: {
        Args: { p_token: string }
        Returns: {
          device_id: string
          is_valid: boolean
          reason: string
        }[]
      }
      validate_user_session: {
        Args: { p_token: string }
        Returns: {
          is_valid: boolean
          profile_data: Json
          profile_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
