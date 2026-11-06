import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Breadcrumbs from '@/components/Breadcrumbs'
import PracticeFlow from '@/components/PracticeFlow'
import { Num, T } from '@/components/text'
import { EMPTY_CATALOG, findItem, isKind, loadCatalog, loadMockPatterns, loadStats } from '@/lib/catalog'
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
  if (item.count === 0) {
    const title = `${item.name} — coming soon`
    const description = `${item.name} practice on ${SITE_NAME} is coming soon. New MCQ sets are added every week.`
    return {
      title,
      description,
      alternates: { canonical: absolute(path) },
      openGraph: { title, description, url: absolute(path) },
    }
  }
  const noun = item.count === 1 ? 'MCQ' : 'MCQs'
  const title = `${item.name} — practice ${item.count} ${noun} online`
  const description = `Answer ${item.count} multiple choice questions for ${item.name} on ${SITE_NAME}. Choose how many questions, practice mode or a timed mock test, with score review and explanations.`
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
  let libraryTotal: number | undefined
  if (client) {
    if (kind === 'exam') {
      const patterns = await loadMockPatterns(client).catch(() => ({} as Record<string, never>))
      pattern = patterns[key] ?? null
    }
    libraryTotal = await loadStats(client)
      .then((stats) => stats.questions)
      .catch(() => undefined)
  }

  const label = KIND_LABEL[kind]

  if (item.count === 0) {
    return (
      <>
        <Breadcrumbs trail={[{ href: label.href, name: label.label }, { href: `/practice/${kind}/${key}`, name: item.name }]} />
        <div className="container page">
          <div className="empty-state">
            <p className="pill-soon">
              <T en="Coming soon" ur="جلد آ رہا ہے" />
            </p>
            <h1 className="page-title">{item.nameUr ? <T en={item.name} ur={item.nameUr} /> : item.name}</h1>
            <p className="empty-body">
              <T
                en="No questions here yet. New sets are added every week."
                ur="ابھی یہاں کوئی سوال نہیں۔ نئے سیٹ ہر ہفتے شامل ہوتے ہیں۔"
              />
            </p>
            <p className="empty-actions">
              <Link href={label.href} className="btn btn-outline">
                <T en={`Back to ${label.label.toLowerCase()}`} ur="فہرست پر واپس" />
              </Link>
              <Link href="/" className="btn btn-dark">
                <T en="Home" ur="ہوم" />
              </Link>
            </p>
          </div>
        </div>
      </>
    )
  }

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
        libraryTotal={libraryTotal}
      />
      <div className="container">
        <p className="page-foot-note">
          <Link href={label.href}>← {label.label}</Link> · <Link href="/progress">My progress</Link> ·{' '}
          <Num>{item.count}</Num>{' '}
          <T
            en={item.count === 1 ? 'question in this pool' : 'questions in this pool'}
            ur={item.count === 1 ? 'سوال' : 'سوالات'}
          />
        </p>
      </div>
    </>
  )
}
