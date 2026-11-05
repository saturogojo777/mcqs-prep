import { cache } from 'react'
import { loadCatalog } from '@/lib/catalog'
import type { SearchEntry } from '@/components/site/SearchBox'
import { getServerSupabase } from '@/lib/supabase'

/**
 * The header search index: every exam, subject and book in one small list.
 * Cached per request so the header and any page share one database read.
 */
export const getSearchIndex = cache(async (): Promise<SearchEntry[]> => {
  const client = getServerSupabase()
  if (!client) return []
  try {
    const catalog = await loadCatalog(client)
    return [
      ...catalog.exams.map((entry) => ({
        kind: 'exam' as const,
        key: entry.key,
        name: entry.name,
        nameUr: entry.nameUr,
        count: entry.count,
        href: `/practice/exam/${entry.key}`,
      })),
      ...catalog.subjects.map((entry) => ({
        kind: 'subject' as const,
        key: entry.key,
        name: entry.name,
        nameUr: entry.nameUr,
        count: entry.count,
        href: `/practice/subject/${entry.key}`,
      })),
      ...catalog.books.map((entry) => ({
        kind: 'book' as const,
        key: entry.key,
        name: entry.name,
        nameUr: entry.nameUr,
        count: entry.count,
        href: `/practice/book/${entry.key}`,
      })),
    ].filter((entry) => entry.count > 0 || entry.kind !== 'subject')
  } catch {
    return []
  }
})
