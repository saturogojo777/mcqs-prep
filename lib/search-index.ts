import { cache } from 'react'
import { EMPTY_CATALOG, loadCatalog } from '@/lib/catalog'
import type { Catalog } from '@/lib/types'
import type { SearchEntry } from '@/components/site/SearchBox'
import { getServerSupabase } from '@/lib/supabase'

/**
 * One cached catalog read per request. The header search, the footer and any
 * page share it, so every list on the site comes from the same data.
 */
export const getCatalog = cache(async (): Promise<Catalog> => {
  const client = getServerSupabase()
  if (!client) return EMPTY_CATALOG
  try {
    return await loadCatalog(client)
  } catch {
    return EMPTY_CATALOG
  }
})

/**
 * The header search index: every exam, subject and book in one small list.
 * Empty subjects and books stay out of suggestions (their list pages say
 * "Coming soon"); exams always stay searchable.
 */
export const getSearchIndex = cache(async (): Promise<SearchEntry[]> => {
  const catalog = await getCatalog()
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
  ].filter((entry) => entry.count > 0 || entry.kind === 'exam')
})
