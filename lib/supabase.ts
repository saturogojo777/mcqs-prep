import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let cached: SupabaseClient | null = null

/** Browser client. Read-only for the public: every table is protected by RLS. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null
  if (!cached) {
    cached = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}

export type CatalogRow = {
  book_id: string
  title: string
  category_id: string | null
  category_name: string | null
  question_count: number
}
