import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          goal_pct: number | null
          icon: string | null
          parent_id: string | null
          exclude_from_goals: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color: string
          goal_pct?: number | null
          icon?: string | null
          parent_id?: string | null
          exclude_from_goals?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          goal_pct?: number | null
          icon?: string | null
          parent_id?: string | null
          exclude_from_goals?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          category_id: string
          start_time: string
          end_time: string | null
          duration_seconds: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          start_time: string
          end_time?: string | null
          duration_seconds?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          start_time?: string
          end_time?: string | null
          duration_seconds?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          category_id: string
          text: string
          completed: boolean
          total_seconds: number
          is_active: boolean
          last_start_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          text: string
          completed?: boolean
          total_seconds?: number
          is_active?: boolean
          last_start_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          text?: string
          completed?: boolean
          total_seconds?: number
          is_active?: boolean
          last_start_time?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      vision_photos: {
        Row: {
          id: string
          user_id: string
          src: string
          alt: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          src: string
          alt: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          src?: string
          alt?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
