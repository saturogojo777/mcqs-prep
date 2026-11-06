import type { Metadata } from 'next'
import ListPage from '@/components/ListPage'
import { loadCatalog, EMPTY_CATALOG } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { SITE_NAME, absolute } from '@/lib/site'
import Breadcrumbs from '@/components/Breadcrumbs'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'MCQ practice by exam — PPSC, FPSC, SPSC, NTS, CSS, MDCAT, Forces, Police, Teachers',
  description:
    'Pick your exam and practise free multiple choice questions online. PPSC, FPSC, SPSC, NTS/PTS/OTS, CSS/PMS, MDCAT/ECAT, Forces, Police and Teachers.',
  alternates: { canonical: absolute('/exams') },
  openGraph: {
    title: `Exams · ${SITE_NAME}`,
    description: 'Free MCQ practice for every major Pakistani government exam.',
    url: absolute('/exams'),
  },
}

export default async function ExamsPage() {
  const client = getServerSupabase()
  const catalog = client ? await loadCatalog(client).catch(() => EMPTY_CATALOG) : EMPTY_CATALOG
  return (
    <>
      <Breadcrumbs trail={[{ href: '/exams', name: 'Exams' }]} />
      <ListPage
        kind="exam"
        items={catalog.exams}
        title="Choose your exam"
        titleUr="اپنا امتحان چنیں"
        intro="Tap an exam to choose how many questions you want and start."
        introUr="امتحان پر ٹیپ کریں، سوالات کی تعداد چنیں اور شروع کریں۔"
      />
    </>
  )
}
