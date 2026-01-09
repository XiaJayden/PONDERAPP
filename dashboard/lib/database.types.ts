// Minimal Supabase Database typing for this dashboard.
// If you later generate full types from Supabase, replace this file.

export type Database = {
  public: {
    Tables: {
      daily_prompts: {
        Row: {
          id: string | number;
          prompt_text: string;
          explanation_text: string | null;
          prompt_date: string;
          theme: string | null;
          display_order: number | null;
          is_active?: boolean | null;
          created_at?: string;
        };
        Insert: {
          id?: string | number;
          prompt_text: string;
          explanation_text?: string | null;
          prompt_date?: string;
          theme?: string | null;
          display_order?: number | null;
          is_active?: boolean | null;
        };
        Update: {
          prompt_text?: string;
          explanation_text?: string | null;
          prompt_date?: string;
          theme?: string | null;
          display_order?: number | null;
          is_active?: boolean | null;
        };
        Relationships: [];
      };
      user_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_type: string;
          event_name: string;
          metadata: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_type: string;
          event_name: string;
          metadata?: unknown;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          event_name?: string;
          metadata?: unknown;
        };
        Relationships: [];
      };
      user_feedback: {
        Row: {
          id: string;
          user_id: string | null;
          feedback_date: string;
          rating: number | null;
          responses: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          feedback_date: string;
          rating?: number | null;
          responses?: unknown;
          created_at?: string;
        };
        Update: {
          rating?: number | null;
          responses?: unknown;
        };
        Relationships: [];
      };
      dev_prompt_overrides: {
        Row: {
          id: string;
          user_id: string | null;
          force_open: boolean;
          force_closed: boolean;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          force_open?: boolean;
          force_closed?: boolean;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          force_open?: boolean;
          force_closed?: boolean;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      yim_posts: {
        Row: {
          id: string;
          author_id: string;
          prompt_id: string | number;
          created_at?: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          prompt_id: string | number;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};


