import type { Metadata } from 'next'
import Link from 'next/link'
import { EMPTY_CATALOG, loadCatalog } from '@/lib/catalog'
import { getServerSupabase } from '@/lib/supabase'
import { absolute, SITE_NAME } from '@/lib/site'
import { Num, T } from '@/components/text'

export const metadata: Metadata = {
  title: 'Search',
  description: `Search ${SITE_NAME} exams, subjects and books.`,
  alternates: { canonical: absolute('/search') },
  robots: { index: false, follow: true },
}

type Props = { searchParams: Promise<{ q?: string }> }

const KIND = {
  exam: { en: 'Exam', ur: 'امتحان', href: '/exams' },
  subject: { en: 'Subject', ur: 'مضمون', href: '/subjects' },
  book: { en: 'Book', ur: 'کتاب', href: '/books' },
} as const

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams
  const term = (q ?? '').trim()
  const client = getServerSupabase()
  const catalog = client ? await loadCatalog(client).catch(() => EMPTY_CATALOG) : EMPTY_CATALOG

  const all = [
    ...catalog.exams.map((item) => ({ ...item, kind: 'exam' as const })),
    ...catalog.subjects.map((item) => ({ ...item, kind: 'subject' as const })),
    ...catalog.books.map((item) => ({ ...item, kind: 'book' as const })),
  ]

  const lower = term.toLowerCase()
  const results =
    term.length < 2
      ? []
      : all.filter(
          (item) =>
            item.count > 0 &&
            (item.name.toLowerCase().includes(lower) ||
              (item.nameUr ?? '').includes(term) ||
              item.key.toLowerCase().includes(lower)),
        )

  return (
    <div className="container page">
      <header className="page-head">
        <h1 className="page-title">
          <T en={term ? `Results for “${term}”` : 'Search'} ur={term ? `نتائج: ${term}` : 'تلاش'} />
        </h1>
        <p className="page-sub">
          {results.length > 0 ? (
            <T
              en={`${results.length} match${results.length === 1 ? '' : 'es'}`}
              ur={`${results.length} نتائج ملے`}
            />
          ) : (
            <T en="Type at least two letters in the search box above." ur="اوپر تلاش کے خانے میں کم از کم دو حروف لکھیں۔" />
          )}
        </p>
      </header>

      {results.length > 0 && (
        <ul className="item-grid">
          {results.map((item) => (
            <li key={`${item.kind}-${item.key}`}>
              <Link className="item" href={`/practice/${item.kind}/${item.key}`}>
                <span className="item-icon">
                  <span className="item-initial">{item.name.slice(0, 1)}</span>
                </span>
                <span className="item-body">
                  <span className="item-name">{item.nameUr ? <T en={item.name} ur={item.nameUr} /> : item.name}</span>
                  <span className="item-meta">
                    <span className="item-count">
                      <T en={KIND[item.kind].en} ur={KIND[item.kind].ur} /> · <Num>{item.count}</Num>{' '}
                      <T en="questions" ur="سوالات" />
                    </span>
                  </span>
                </span>
                <span className="item-go" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="page-foot-note">
        <Link href="/exams">
          <T en="Browse all exams" ur="تمام امتحانات دیکھیں" />
        </Link>{' '}
        ·{' '}
        <Link href="/subjects">
          <T en="Browse all subjects" ur="تمام مضامین دیکھیں" />
        </Link>
      </p>
    </div>
  )
}
