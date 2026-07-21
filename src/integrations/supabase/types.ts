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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      client_error_logs: {
        Row: {
          context: Json | null
          created_at: string
          error_message: string
          id: string
          level: string
          route: string | null
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_message: string
          id?: string
          level?: string
          route?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_message?: string
          id?: string
          level?: string
          route?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      convoy_alerts: {
        Row: {
          convoy_id: string
          created_at: string
          display_name: string
          expires_at: string
          id: string
          kind: string
          payload: Json
          user_id: string
        }
        Insert: {
          convoy_id: string
          created_at?: string
          display_name: string
          expires_at?: string
          id?: string
          kind: string
          payload?: Json
          user_id: string
        }
        Update: {
          convoy_id?: string
          created_at?: string
          display_name?: string
          expires_at?: string
          id?: string
          kind?: string
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convoy_alerts_convoy_id_fkey"
            columns: ["convoy_id"]
            isOneToOne: false
            referencedRelation: "convoys"
            referencedColumns: ["id"]
          },
        ]
      }
      convoy_members: {
        Row: {
          convoy_id: string
          display_name: string
          id: string
          joined_at: string
          last_lat: number | null
          last_lng: number | null
          last_seen: string
          user_id: string
        }
        Insert: {
          convoy_id: string
          display_name: string
          id?: string
          joined_at?: string
          last_lat?: number | null
          last_lng?: number | null
          last_seen?: string
          user_id: string
        }
        Update: {
          convoy_id?: string
          display_name?: string
          id?: string
          joined_at?: string
          last_lat?: number | null
          last_lng?: number | null
          last_seen?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convoy_members_convoy_id_fkey"
            columns: ["convoy_id"]
            isOneToOne: false
            referencedRelation: "convoys"
            referencedColumns: ["id"]
          },
        ]
      }
      convoys: {
        Row: {
          code: string
          created_at: string
          ended_at: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          code: string
          created_at?: string
          ended_at?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          code?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hazard_reports: {
        Row: {
          confidence_score: number
          confirmed_count: number
          created_at: string
          denied_count: number
          expires_at: string
          id: string
          latitude: number
          longitude: number
          reported_by: string
          type: Database["public"]["Enums"]["hazard_type"]
        }
        Insert: {
          confidence_score?: number
          confirmed_count?: number
          created_at?: string
          denied_count?: number
          expires_at?: string
          id?: string
          latitude: number
          longitude: number
          reported_by: string
          type: Database["public"]["Enums"]["hazard_type"]
        }
        Update: {
          confidence_score?: number
          confirmed_count?: number
          created_at?: string
          denied_count?: number
          expires_at?: string
          id?: string
          latitude?: number
          longitude?: number
          reported_by?: string
          type?: Database["public"]["Enums"]["hazard_type"]
        }
        Relationships: []
      }
      hazard_votes: {
        Row: {
          created_at: string
          hazard_id: string
          id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          hazard_id: string
          id?: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          hazard_id?: string
          id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hazard_votes_hazard_id_fkey"
            columns: ["hazard_id"]
            isOneToOne: false
            referencedRelation: "hazard_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      official_radars: {
        Row: {
          date_installation: string | null
          id: string
          latitude: number
          longitude: number
          route: string | null
          source: string
          type: string | null
          updated_at: string
          vitesse_controlee: number | null
        }
        Insert: {
          date_installation?: string | null
          id: string
          latitude: number
          longitude: number
          route?: string | null
          source?: string
          type?: string | null
          updated_at?: string
          vitesse_controlee?: number | null
        }
        Update: {
          date_installation?: string | null
          id?: string
          latitude?: number
          longitude?: number
          route?: string | null
          source?: string
          type?: string | null
          updated_at?: string
          vitesse_controlee?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      roadbooks: {
        Row: {
          cover_hint: string | null
          created_at: string
          created_by: string
          description: string | null
          distance_km: number | null
          duration_days: number | null
          id: string
          is_public: boolean
          route_geojson: Json | null
          title: string
        }
        Insert: {
          cover_hint?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          distance_km?: number | null
          duration_days?: number | null
          id?: string
          is_public?: boolean
          route_geojson?: Json | null
          title: string
        }
        Update: {
          cover_hint?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          distance_km?: number | null
          duration_days?: number | null
          id?: string
          is_public?: boolean
          route_geojson?: Json | null
          title?: string
        }
        Relationships: []
      }
      trip_history: {
        Row: {
          alerts_received: number
          distance_km: number
          ended_at: string | null
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          alerts_received?: number
          distance_km?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          alerts_received?: number
          distance_km?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          alert_lead_time: string
          auto_recenter: boolean
          created_at: string
          map_theme: string
          moto_mode: boolean
          sound_alerts: boolean
          speed_unit: string
          updated_at: string
          user_id: string
          vibration_alerts: boolean
          voice_alerts: boolean
        }
        Insert: {
          alert_lead_time?: string
          auto_recenter?: boolean
          created_at?: string
          map_theme?: string
          moto_mode?: boolean
          sound_alerts?: boolean
          speed_unit?: string
          updated_at?: string
          user_id: string
          vibration_alerts?: boolean
          voice_alerts?: boolean
        }
        Update: {
          alert_lead_time?: string
          auto_recenter?: boolean
          created_at?: string
          map_theme?: string
          moto_mode?: boolean
          sound_alerts?: boolean
          speed_unit?: string
          updated_at?: string
          user_id?: string
          vibration_alerts?: boolean
          voice_alerts?: boolean
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_hazard: { Args: { hazard_id: string }; Returns: undefined }
      deny_hazard: { Args: { hazard_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_convoy_member: {
        Args: { _convoy: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      hazard_type:
        | "radar_fixe"
        | "radar_mobile"
        | "accident"
        | "travaux"
        | "obstacle"
        | "ralentissement"
        | "gravillons"
        | "chute_huile"
        | "animal_sauvage"
        | "chaussee_deformee"
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
      app_role: ["admin", "moderator", "user"],
      hazard_type: [
        "radar_fixe",
        "radar_mobile",
        "accident",
        "travaux",
        "obstacle",
        "ralentissement",
        "gravillons",
        "chute_huile",
        "animal_sauvage",
        "chaussee_deformee",
      ],
    },
  },
} as const
