import type { Metadata } from 'next'
import ListPage from '@/components/ListPage'
import { loadCatalog, EMPTY_CATALOG } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { absolute } from '@/lib/site'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'MCQ practice by exam — PPSC, FPSC, SPSC, NTS, CSS, MDCAT, Police, Teachers',
  description:
    'Pick your exam and practise free multiple choice questions online. PPSC, FPSC, SPSC, NTS/PTS/OTS, CSS/PMS, MDCAT/ECAT, Forces, Police and Teachers.',
  alternates: { canonical: absolute('/exams') },
}

export default async function ExamsPage() {
  const client = getServerSupabase()
  const catalog = client ? await loadCatalog(client) : EMPTY_CATALOG
  return (
    <ListPage
      kind="exam"
      items={catalog.exams}
      title="Choose your exam"
      titleUr="اپنا امتحان چنیں"
      intro="Tap an exam to choose how many questions you want and start."
      introUr="امتحان پر ٹیپ کریں، سوالات کی تعداد چنیں اور شروع کریں۔"
    />
  )
}
