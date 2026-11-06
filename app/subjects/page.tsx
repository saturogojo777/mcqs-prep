import type { Metadata } from 'next'
import ListPage from '@/components/ListPage'
import Breadcrumbs from '@/components/Breadcrumbs'
import { EMPTY_CATALOG, loadCatalog } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { SITE_NAME, absolute } from '@/lib/site'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'MCQ practice by subject — General Knowledge, Pakistan Studies, Maths, English',
  description:
    'Practise free multiple choice questions by subject: General Knowledge, Pakistan Studies, Islamic Studies, Current Affairs, Geography, Mathematics, English, Urdu, Everyday Science and Computer Skills.',
  alternates: { canonical: absolute('/subjects') },
  openGraph: {
    title: `Subjects · ${SITE_NAME}`,
    description: 'Free MCQ practice by subject, with new sets added every week.',
    url: absolute('/subjects'),
  },
}

export default async function SubjectsPage() {
  const client = getServerSupabase()
  const catalog = client ? await loadCatalog(client).catch(() => EMPTY_CATALOG) : EMPTY_CATALOG
  return (
    <>
      <Breadcrumbs trail={[{ href: '/subjects', name: 'Subjects' }]} />
      <ListPage
        kind="subject"
        items={catalog.subjects}
        title="Choose your subject"
        titleUr="اپنا مضمون چنیں"
        intro="Pick a subject, then choose a test size that fits its question pool."
        introUr="مضمون چنیں، پھر اس کے سوالات کے مطابق ٹیسٹ کا حجم چنیں۔"
      />
    </>
  )
}
