import type { Metadata } from 'next'
import ListPage from '@/components/ListPage'
import { loadCatalog, EMPTY_CATALOG } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { absolute } from '@/lib/site'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'MCQ practice by subject — Pakistan Studies, Maths, English, Science',
  description:
    'Practise free MCQs subject by subject: General Knowledge, Pakistan Studies, Islamic Studies, Current Affairs, Geography, Mathematics, English, Urdu, Everyday Science and Computer Skills.',
  alternates: { canonical: absolute('/subjects') },
}

export default async function SubjectsPage() {
  const client = getServerSupabase()
  const catalog = client ? await loadCatalog(client) : EMPTY_CATALOG
  return (
    <ListPage
      kind="subject"
      items={catalog.subjects}
      title="Choose your subject"
      titleUr="اپنا مضمون چنیں"
      intro="Practise one subject at a time, from ten questions to the whole set."
      introUr="ایک وقت میں ایک مضمون، دس سوالات سے پورے سیٹ تک۔"
    />
  )
}
