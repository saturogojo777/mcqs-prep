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

export type Mcq = {
  id: string
  question_en: string
  question_ur: string | null
  options: Record<string, string>
  correct_text: string
  explanation: string | null
  source_ref: string | null
}

export type Book = { id: string; title: string }
export type Category = { id: string; name: string; count: number; bookId: string }

/** Groups the flat catalog view into books -> categories. */
export function shapeCatalog(rows: CatalogRow[]): { books: Book[]; categories: Category[] } {
  const books: Book[] = []
  const categories: Category[] = []
  const seenBooks = new Set<string>()

  for (const row of rows) {
    if (!seenBooks.has(row.book_id)) {
      seenBooks.add(row.book_id)
      books.push({ id: row.book_id, title: row.title })
    }
    if (row.category_id && row.category_name) {
      categories.push({
        id: row.category_id,
        name: row.category_name,
        count: row.question_count,
        bookId: row.book_id,
      })
    }
  }
  return { books, categories }
}
