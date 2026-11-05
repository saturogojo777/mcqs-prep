import type { Metadata } from 'next'
import ListPage from '@/components/ListPage'
import { loadCatalog, EMPTY_CATALOG } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { absolute } from '@/lib/site'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'MCQ practice by book',
  description: 'Every book on DailyTest with its question count. Pick a book and practise it from start to finish.',
  alternates: { canonical: absolute('/books') },
}

export default async function BooksPage() {
  const client = getServerSupabase()
  const catalog = client ? await loadCatalog(client) : EMPTY_CATALOG
  return (
    <ListPage
      kind="book"
      items={catalog.books}
      title="Choose your book"
      titleUr="اپنی کتاب چنیں"
      intro="Every book with its question count. Practise any part of it."
      introUr="ہر کتاب اور اس کے سوالات کی تعداد۔ جتنا چاہیں مشق کریں۔"
    />
  )
}
