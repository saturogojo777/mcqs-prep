import Link from 'next/link'
import { T } from '@/components/text'
import type { CatalogItem, ItemKind } from '@/lib/types'

type Props = {
  kind: ItemKind
  items: CatalogItem[]
  title: string
  titleUr: string
  intro: string
  introUr: string
}

/** One plain card per exam / subject / book, with its question count. */
export default function ListPage({ kind, items, title, titleUr, intro, introUr }: Props) {
  return (
    <div className="container page">
      <header className="page-head">
        <h1 className="page-title">
          <T en={title} ur={titleUr} />
        </h1>
        <p className="page-sub">
          <T en={intro} ur={introUr} />
        </p>
      </header>

      {items.length === 0 ? (
        <p className="empty">
          <T en="Nothing here yet." ur="ابھی یہاں کچھ نہیں۔" />
        </p>
      ) : (
        <ul className="item-list">
          {items.map((item) => {
            const empty = item.count === 0
            const body = (
              <>
                <span className="item-name">
                  {item.nameUr ? (
                    <T en={item.name} ur={item.nameUr} />
                  ) : (
                    item.name
                  )}
                </span>
                <span className="item-meta">
                  {empty ? (
                    <span className="pill-soon">
                      <T en="Coming soon" ur="جلد آ رہا ہے" />
                    </span>
                  ) : (
                    <span className="item-count">
                      <T
                        en={`${item.count} questions`}
                        ur={`${item.count} سوالات`}
                      />
                    </span>
                  )}
                </span>
              </>
            )

            return (
              <li key={item.key}>
                {empty ? (
                  <div className="item item--disabled" aria-disabled="true">
                    {body}
                  </div>
                ) : (
                  <Link className="item" href={`/practice/${kind}/${item.key}`}>
                    {body}
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
