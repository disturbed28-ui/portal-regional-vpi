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
      cargos: {
        Row: {
          created_at: string | null
          grau: string
          id: string
          nivel: number | null
          nome: string
        }
        Insert: {
          created_at?: string | null
          grau: string
          id?: string
          nivel?: number | null
          nome: string
        }
        Update: {
          created_at?: string | null
          grau?: string
          id?: string
          nivel?: number | null
          nome?: string
        }
        Relationships: []
      }
      comandos: {
        Row: {
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      divisoes: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          regional_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          regional_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          regional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "divisoes_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divisoes_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["regional_id"]
          },
        ]
      }
      funcoes: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      profile_history: {
        Row: {
          alterado_por: string | null
          created_at: string | null
          id: string
          observacao: string | null
          profile_id: string
          status_anterior: string
          status_novo: string
        }
        Insert: {
          alterado_por?: string | null
          created_at?: string | null
          id?: string
          observacao?: string | null
          profile_id: string
          status_anterior: string
          status_novo: string
        }
        Update: {
          alterado_por?: string | null
          created_at?: string | null
          id?: string
          observacao?: string | null
          profile_id?: string
          status_anterior?: string
          status_novo?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          cargo_id: string | null
          comando_id: string | null
          created_at: string
          data_entrada: string | null
          divisao: string | null
          divisao_id: string | null
          funcao: string | null
          funcao_id: string | null
          grau: string | null
          id: string
          name: string
          nome_colete: string | null
          observacao: string | null
          photo_url: string | null
          profile_status: string
          regional: string | null
          regional_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          cargo_id?: string | null
          comando_id?: string | null
          created_at?: string
          data_entrada?: string | null
          divisao?: string | null
          divisao_id?: string | null
          funcao?: string | null
          funcao_id?: string | null
          grau?: string | null
          id: string
          name?: string
          nome_colete?: string | null
          observacao?: string | null
          photo_url?: string | null
          profile_status?: string
          regional?: string | null
          regional_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          cargo_id?: string | null
          comando_id?: string | null
          created_at?: string
          data_entrada?: string | null
          divisao?: string | null
          divisao_id?: string | null
          funcao?: string | null
          funcao_id?: string | null
          grau?: string | null
          id?: string
          name?: string
          nome_colete?: string | null
          observacao?: string | null
          photo_url?: string | null
          profile_status?: string
          regional?: string | null
          regional_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_comando_id_fkey"
            columns: ["comando_id"]
            isOneToOne: false
            referencedRelation: "comandos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_comando_id_fkey"
            columns: ["comando_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["comando_id"]
          },
          {
            foreignKeyName: "profiles_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
          },
          {
            foreignKeyName: "profiles_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["regional_id"]
          },
        ]
      }
      regionais: {
        Row: {
          comando_id: string
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          comando_id: string
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          comando_id?: string
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "regionais_comando_id_fkey"
            columns: ["comando_id"]
            isOneToOne: false
            referencedRelation: "comandos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regionais_comando_id_fkey"
            columns: ["comando_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["comando_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_estrutura_completa: {
        Row: {
          comando: string | null
          comando_id: string | null
          divisao: string | null
          divisao_id: string | null
          regional: string | null
          regional_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    },
  },
} as const
