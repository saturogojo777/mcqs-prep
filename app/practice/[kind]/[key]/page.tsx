import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PracticeFlow from '@/components/PracticeFlow'
import { EMPTY_CATALOG, findItem, isKind, loadCatalog } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { SITE_NAME } from '@/lib/site'

export const revalidate = 300

type Params = { params: Promise<{ kind: string; key: string }> }

async function itemFor(kind: string, key: string) {
  if (!isKind(kind)) return null
  const client = getServerSupabase()
  if (!client) return null
  const catalog = client ? await loadCatalog(client) : EMPTY_CATALOG
  return findItem(catalog, kind, key)
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { kind, key } = await params
  const item = await itemFor(kind, key)
  if (!item) return { title: 'Practice' }
  return {
    title: `${item.name} — practice ${item.count} MCQs`,
    description: `Answer ${item.count} multiple choice questions for ${item.name} on ${SITE_NAME}. Choose 10, 20, 50 or 100 questions.`,
  }
}

export default async function PracticePage({ params }: Params) {
  const { kind, key } = await params
  if (!isKind(kind)) notFound()
  const item = await itemFor(kind, key)
  if (!item) {
    return (
      <div className="container page">
        <h1 className="page-title">Not found</h1>
        <p className="page-sub">That practice set is not available.</p>
        <Link href="/" className="back-link">
          Home
        </Link>
      </div>
    )
  }

  return (
    <PracticeFlow
      mode={kind}
      title={item.name}
      titleUr={item.nameUr ?? item.name}
      itemKey={item.key}
      available={item.count}
    />
  )
}
