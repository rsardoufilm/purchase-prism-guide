export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      expense_items: {
        Row: {
          category: string | null;
          created_at: string;
          expense_id: string;
          id: string;
          normalized_name: string | null;
          quantity: number;
          raw_name: string;
          total_price: number;
          unit: string | null;
          unit_price: number;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          expense_id: string;
          id?: string;
          normalized_name?: string | null;
          quantity?: number;
          raw_name: string;
          total_price?: number;
          unit?: string | null;
          unit_price?: number;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          expense_id?: string;
          id?: string;
          normalized_name?: string | null;
          quantity?: number;
          raw_name?: string;
          total_price?: number;
          unit?: string | null;
          unit_price?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_items_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          category: string | null;
          created_at: string;
          expense_date: string;
          expense_time: string | null;
          id: string;
          merchant_document: string | null;
          merchant_name: string;
          notes: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"];
          source: Database["public"]["Enums"]["expense_source"];
          storage_path: string | null;
          total_amount: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          expense_date?: string;
          expense_time?: string | null;
          id?: string;
          merchant_document?: string | null;
          merchant_name: string;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          source?: Database["public"]["Enums"]["expense_source"];
          storage_path?: string | null;
          total_amount?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          expense_date?: string;
          expense_time?: string | null;
          id?: string;
          merchant_document?: string | null;
          merchant_name?: string;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          source?: Database["public"]["Enums"]["expense_source"];
          storage_path?: string | null;
          total_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          daily_summary_hour: number;
          enabled_daily_summary: boolean;
          enabled_health_alert: boolean;
          enabled_recurring: boolean;
          enabled_subscription: boolean;
          enabled_weekly_summary: boolean;
          lead_days: number;
          quiet_end_hour: number | null;
          quiet_start_hour: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          daily_summary_hour?: number;
          enabled_daily_summary?: boolean;
          enabled_health_alert?: boolean;
          enabled_recurring?: boolean;
          enabled_subscription?: boolean;
          enabled_weekly_summary?: boolean;
          lead_days?: number;
          quiet_end_hour?: number | null;
          quiet_start_hour?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          daily_summary_hour?: number;
          enabled_daily_summary?: boolean;
          enabled_health_alert?: boolean;
          enabled_recurring?: boolean;
          enabled_subscription?: boolean;
          enabled_weekly_summary?: boolean;
          lead_days?: number;
          quiet_end_hour?: number | null;
          quiet_start_hour?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      product_normalization: {
        Row: {
          confidence: number;
          created_at: string;
          id: string;
          normalized_name: string;
          raw_name: string;
        };
        Insert: {
          confidence?: number;
          created_at?: string;
          id?: string;
          normalized_name: string;
          raw_name: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          id?: string;
          normalized_name?: string;
          raw_name?: string;
        };
        Relationships: [];
      };
      product_prices: {
        Row: {
          created_at: string;
          expense_item_id: string | null;
          id: string;
          merchant_name: string;
          normalized_name: string;
          purchase_date: string;
          quantity: number;
          unit: string | null;
          unit_price: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expense_item_id?: string | null;
          id?: string;
          merchant_name: string;
          normalized_name: string;
          purchase_date: string;
          quantity?: number;
          unit?: string | null;
          unit_price: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expense_item_id?: string | null;
          id?: string;
          merchant_name?: string;
          normalized_name?: string;
          purchase_date?: string;
          quantity?: number;
          unit?: string | null;
          unit_price?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_prices_expense_item_id_fkey";
            columns: ["expense_item_id"];
            isOneToOne: false;
            referencedRelation: "expense_items";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_expenses: {
        Row: {
          active: boolean;
          amount: number;
          category: string | null;
          created_at: string;
          due_day: number | null;
          frequency: Database["public"]["Enums"]["recurrence_frequency"];
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          amount?: number;
          category?: string | null;
          created_at?: string;
          due_day?: number | null;
          frequency?: Database["public"]["Enums"]["recurrence_frequency"];
          id?: string;
          name: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          amount?: number;
          category?: string | null;
          created_at?: string;
          due_day?: number | null;
          frequency?: Database["public"]["Enums"]["recurrence_frequency"];
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          active: boolean;
          amount: number;
          created_at: string;
          frequency: Database["public"]["Enums"]["recurrence_frequency"];
          id: string;
          name: string;
          next_due_date: string | null;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          amount?: number;
          created_at?: string;
          frequency?: Database["public"]["Enums"]["recurrence_frequency"];
          id?: string;
          name: string;
          next_due_date?: string | null;
          user_id: string;
        };
        Update: {
          active?: boolean;
          amount?: number;
          created_at?: string;
          frequency?: Database["public"]["Enums"]["recurrence_frequency"];
          id?: string;
          name?: string;
          next_due_date?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_notifications: {
        Row: {
          created_at: string;
          dedupe_key: string | null;
          id: string;
          message: string;
          read: boolean;
          related_id: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          message: string;
          read?: boolean;
          related_id?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          message?: string;
          read?: boolean;
          related_id?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      expense_source: "manual" | "photo" | "pdf";
      payment_method:
        | "pix"
        | "credito"
        | "debito"
        | "dinheiro"
        | "vale_alimentacao"
        | "vale_refeicao"
        | "outros";
      recurrence_frequency:
        | "semanal"
        | "mensal"
        | "bimestral"
        | "trimestral"
        | "semestral"
        | "anual";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      expense_source: ["manual", "photo", "pdf"],
      payment_method: [
        "pix",
        "credito",
        "debito",
        "dinheiro",
        "vale_alimentacao",
        "vale_refeicao",
        "outros",
      ],
      recurrence_frequency: ["semanal", "mensal", "bimestral", "trimestral", "semestral", "anual"],
    },
  },
} as const;
