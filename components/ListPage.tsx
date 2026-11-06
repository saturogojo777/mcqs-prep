import Link from 'next/link'
import { Count, Num, T } from '@/components/text'
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

const GROUPS: Record<string, { one: string; many: string; oneUr: string; manyUr: string }> = {
  exam: { one: 'live exam', many: 'live exams', oneUr: 'فعال امتحان', manyUr: 'فعال امتحانات' },
  subject: { one: 'live subject', many: 'live subjects', oneUr: 'فعال مضمون', manyUr: 'فعال مضامین' },
  book: { one: 'live book', many: 'live books', oneUr: 'فعال کتاب', manyUr: 'فعال کتابیں' },
}

/** One card per exam / subject / book, with its question count. */
export default function ListPage({ kind, items, title, titleUr, intro, introUr }: Props) {
  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">
          <Count
            n={items.filter((item) => item.count > 0).length}
            one={GROUPS[kind].one}
            many={GROUPS[kind].many}
            oneUr={GROUPS[kind].oneUr}
            manyUr={GROUPS[kind].manyUr}
          />
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
        <ul className="item-grid" data-reveal>
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
                          <Count n={item.count} one="question" many="questions" oneUr="سوال" manyUr="سوالات" />
                        </span>
                        {kind === 'book' && item.chapters ? (
                          <span className="item-count item-count--muted">
                            <Count n={item.chapters} one="chapter" many="chapters" oneUr="باب" manyUr="ابواب" />
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
