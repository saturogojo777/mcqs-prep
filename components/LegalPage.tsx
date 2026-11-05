import type { ReactNode } from 'react'
import { T } from '@/components/text'

type Props = {
  title: string
  titleUr: string
  intro?: string
  children: ReactNode
}

/** Shared shell for the plain-English footer pages. */
export default function LegalPage({ title, titleUr, intro, children }: Props) {
  return (
    <div className="container page page--prose">
      <header className="page-head">
        <h1 className="page-title">
          <T en={title} ur={titleUr} />
        </h1>
      </header>
      <article className="prose">
        {intro && <p>{intro}</p>}
        {children}
      </article>
    </div>
  )
}
