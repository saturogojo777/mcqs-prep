import type { MetadataRoute } from 'next'
import { EMPTY_CATALOG, loadCatalog } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { absolute } from '@/lib/site'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const client = getServerSupabase()
  const catalog = client ? await loadCatalog(client).catch(() => EMPTY_CATALOG) : EMPTY_CATALOG
  const now = new Date()

  const pages: MetadataRoute.Sitemap = [
    { url: absolute('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absolute('/exams'), lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: absolute('/subjects'), lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: absolute('/books'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: absolute('/today'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: absolute('/about'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: absolute('/contact'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: absolute('/privacy'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: absolute('/terms'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: absolute('/disclaimer'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]

  const items = [
    ...catalog.exams.map((item) => absolute(`/practice/exam/${item.key}`)),
    ...catalog.subjects.filter((item) => item.count > 0).map((item) => absolute(`/practice/subject/${item.key}`)),
    ...catalog.books.map((item) => absolute(`/practice/book/${item.key}`)),
  ].map((url) => ({ url, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 }))

  return [...pages, ...items]
}
