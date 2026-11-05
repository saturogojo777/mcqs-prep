import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Breadcrumbs from '@/components/Breadcrumbs'
import PracticeFlow from '@/components/PracticeFlow'
import { EMPTY_CATALOG, findItem, isKind, loadCatalog, loadMockPatterns } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { SITE_NAME, absolute } from '@/lib/site'

export const revalidate = 300

type Params = { params: Promise<{ kind: string; key: string }> }

const KIND_LABEL: Record<string, { label: string; href: string }> = {
  exam: { label: 'Exams', href: '/exams' },
  subject: { label: 'Subjects', href: '/subjects' },
  book: { label: 'Books', href: '/books' },
}

async function itemFor(kind: string, key: string) {
  if (!isKind(kind)) return null
  const client = getServerSupabase()
  if (!client) return null
  const catalog = await loadCatalog(client).catch(() => EMPTY_CATALOG)
  return findItem(catalog, kind, key)
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { kind, key } = await params
  const item = await itemFor(kind, key)
  if (!item) return { title: 'Practice' }
  const path = `/practice/${kind}/${key}`
  const title = `${item.name} — practice ${item.count} MCQs online`
  const description = `Answer ${item.count} multiple choice questions for ${item.name} on ${SITE_NAME}. Choose 10, 20, 50 or 100 questions, practice mode or a timed mock test, with an explanation for every answer.`
  return {
    title,
    description,
    alternates: { canonical: absolute(path) },
    openGraph: { title, description, url: absolute(path) },
  }
}

export default async function PracticePage({ params }: Params) {
  const { kind, key } = await params
  if (!isKind(kind)) notFound()
  const item = await itemFor(kind, key)
  if (!item) notFound()

  const client = getServerSupabase()
  let pattern = null
  if (kind === 'exam' && client) {
    const patterns = await loadMockPatterns(client).catch(() => ({} as Record<string, never>))
    pattern = patterns[key] ?? null
  }

  const label = KIND_LABEL[kind]

  return (
    <>
      <Breadcrumbs trail={[{ href: label.href, name: label.label }, { href: `/practice/${kind}/${key}`, name: item.name }]} />
      <PracticeFlow
        mode={kind}
        title={item.name}
        titleUr={item.nameUr ?? item.name}
        itemKey={item.key}
        available={item.count}
        pattern={pattern}
      />
      <div className="container">
        <p className="page-foot-note">
          <Link href={label.href}>← {label.label}</Link> · <Link href="/progress">My progress</Link>
        </p>
      </div>
    </>
  )
}
