import type { Metadata } from 'next'
import Home from '@/components/Home'
import { EMPTY_CATALOG, EMPTY_STATS, loadCatalog, loadStats } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, absolute } from '@/lib/site'

export const revalidate = 300

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: absolute('/') },
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is DailyTest free?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. Every question, explanation and mock test is free and needs no account.' },
    },
    {
      '@type': 'Question',
      name: 'Which exams are covered?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'PPSC, FPSC, SPSC, NTS/PTS/OTS, one-paper posts, CSS/PMS screening, Police, Teachers, Forces and MDCAT/ECAT.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do you follow the official test pattern?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Mock-test defaults are our own starting values. Verify the number of questions, time and negative marking with the official advertisement of your post.',
      },
    },
  ],
}

export default async function HomePage() {
  const client = getServerSupabase()
  const [catalog, stats] = client
    ? await Promise.all([
        loadCatalog(client).catch(() => EMPTY_CATALOG),
        loadStats(client).catch(() => EMPTY_STATS),
      ])
    : [EMPTY_CATALOG, EMPTY_STATS]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
      <Home catalog={catalog} stats={stats} />
    </>
  )
}
