import Link from 'next/link'
import { Num, T } from '@/components/text'
import ExamIcon from '@/components/ExamIcon'
import type { CatalogItem, ItemKind } from '@/lib/types'

type Props = {
  kind: ItemKind
  items: CatalogItem[]
  title: string
  titleUr: string
  intro: string
  introUr: string
}

const GROUPS: Record<string, { title: string; titleUr: string }> = {
  exam: { title: 'exams', titleUr: 'امتحانات' },
  subject: { title: 'subjects', titleUr: 'مضامین' },
  book: { title: 'books', titleUr: 'کتابیں' },
}

/** One card per exam / subject / book, with its question count. */
export default function ListPage({ kind, items, title, titleUr, intro, introUr }: Props) {
  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">
          <T en={`${items.filter((item) => item.count > 0).length} ${GROUPS[kind].title}`} ur={GROUPS[kind].titleUr} />
        </p>
        <h1 className="page-title">
          <T en={title} ur={titleUr} />
        </h1>
        <p className="page-sub">
          <T en={intro} ur={introUr} />
        </p>
      </header>

      {items.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">
            <T en="Nothing here yet" ur="ابھی یہاں کچھ نہیں" />
          </p>
          <p className="empty-body">
            <T en="New sets are added every week." ur="نئے سیٹ ہر ہفتے شامل ہوتے ہیں۔" />
          </p>
          <Link href="/" className="btn btn-outline">
            <T en="Back to home" ur="ہوم پر واپس" />
          </Link>
        </div>
      ) : (
        <ul className="item-grid">
          {items.map((item) => {
            const empty = item.count === 0
            return (
              <li key={item.key}>
                {empty ? (
                  <div className="item item--disabled" aria-disabled="true">
                    <span className="item-icon">
                      {kind === 'exam' ? <ExamIcon slug={item.key} size={18} /> : null}
                    </span>
                    <span className="item-body">
                      <span className="item-name">{item.nameUr ? <T en={item.name} ur={item.nameUr} /> : item.name}</span>
                      <span className="item-meta">
                        <span className="pill-soon">
                          <T en="Coming soon" ur="جلد آ رہا ہے" />
                        </span>
                      </span>
                    </span>
                  </div>
                ) : (
                  <Link className="item" href={`/practice/${kind}/${item.key}`}>
                    <span className="item-icon">
                      {kind === 'exam' ? <ExamIcon slug={item.key} size={18} /> : null}
                      {kind === 'subject' ? <span className="item-initial">{item.name.slice(0, 1)}</span> : null}
                      {kind === 'book' ? <span className="item-initial">{item.name.slice(0, 1)}</span> : null}
                    </span>
                    <span className="item-body">
                      <span className="item-name">{item.nameUr ? <T en={item.name} ur={item.nameUr} /> : item.name}</span>
                      <span className="item-meta">
                        <span className="item-count">
                          <Num>{item.count}</Num> <T en="questions" ur="سوالات" />
                        </span>
                        {kind === 'book' && item.chapters ? (
                          <span className="item-count item-count--muted">
                            <Num>{item.chapters}</Num> <T en="chapters" ur="ابواب" />
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="item-go" aria-hidden="true">
                      →
                    </span>
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
