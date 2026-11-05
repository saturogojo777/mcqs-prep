import { createClient } from '@supabase/supabase-js'
import PracticeApp from '@/components/PracticeApp'
import type { CatalogRow } from '@/lib/supabase'

// The catalog changes only when a book is imported, so cache it briefly.
export const revalidate = 30

async function getCatalog(): Promise<CatalogRow[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await supabase.from('catalog').select('*')
    if (error || !data) return null
    return data as CatalogRow[]
  } catch {
    return null
  }
}

export default async function Page() {
  const catalog = await getCatalog()
  return <PracticeApp initialCatalog={catalog} />
}
