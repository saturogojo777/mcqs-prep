import type { Metadata } from 'next'
import ListPage from '@/components/ListPage'
import Breadcrumbs from '@/components/Breadcrumbs'
import { EMPTY_CATALOG, loadCatalog } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { SITE_NAME, absolute } from '@/lib/site'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'MCQ books — one book per subject, chapter by chapter',
  description:
    'Work through a whole book: General Knowledge, Pakistan Studies, Islamic Studies, Current Affairs, Geography, Mathematics, English, Urdu, Everyday Science and Computer Skills.',
  alternates: { canonical: absolute('/books') },
  openGraph: {
    title: `Books · ${SITE_NAME}`,
    description: 'Chapter-by-chapter MCQ books. Live books are open now; the rest arrive week by week.',
    url: absolute('/books'),
  },
}

export default async function BooksPage() {
  const client = getServerSupabase()
  const catalog = client ? await loadCatalog(client).catch(() => EMPTY_CATALOG) : EMPTY_CATALOG
  return (
    <>
      <Breadcrumbs trail={[{ href: '/books', name: 'Books' }]} />
      <ListPage
        kind="book"
        items={catalog.books}
        title="Choose your book"
        titleUr="اپنی کتاب چنیں"
        intro="A book runs chapter by chapter. Start anywhere and come back to the ones that need work."
        introUr="کتاب باب بہ باب چلتی ہے۔ کہیں سے بھی شروع کریں اور کمزور ابواب پر واپس آئیں۔"
      />
    </>
  )
}
