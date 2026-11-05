'use client'

import type { CSSProperties } from 'react'
import type { Book, Category } from '@/lib/catalog'
import type { CategoryProgress } from '@/lib/progress'
import type { Copy } from '@/lib/copy'
import type { Mode } from '@/lib/session'
import { IconArrowRight, topicIcon } from '@/components/icons'

type Props = {
  t: Copy
  books: Book[]
  categories: Category[]
  selectedBook: string | null
  onSelectBook: (id: string) => void
  progress: Record<string, CategoryProgress>
  answered: number
  accuracy: number
  resume: { category: Category; progress: CategoryProgress } | null
  loading: boolean
  error: string | null
  showResume: boolean
  onStart: (category: Category, mode: Mode) => void
  onContinue: () => void
}

export default function Home({
  t,
  books,
  categories,
  selectedBook,
  onSelectBook,
  progress,
  answered,
  accuracy,
  resume,
  loading,
  error,
  showResume,
  onStart,
  onContinue,
}: Props) {
  const totalQuestions = categories.reduce((sum, category) => sum + category.count, 0)

  return (
    <>
      <header className="home-head">
        <div>
          <h1 className="home-title">{t.pageTitle}</h1>
          <p className="home-sub">{t.pageSub}</p>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="stat-value num">{showResume ? answered : 0}</span>
            <span className="stat-label">{t.answeredLabel}</span>
          </div>
          <div className="stat">
            <span className="stat-value num">{showResume ? `${accuracy}%` : '0%'}</span>
            <span className="stat-label">{t.accuracyLabel}</span>
          </div>
        </div>
      </header>

      {books.length > 1 && (
        <div className="tabs" role="tablist" aria-label={t.book}>
          {books.map((book) => (
            <button
              key={book.id}
              type="button"
              role="tab"
              aria-selected={selectedBook === book.id}
              aria-pressed={selectedBook === book.id}
              onClick={() => onSelectBook(book.id)}
            >
              {book.title}
            </button>
          ))}
        </div>
      )}

      {resume && (
        <section className="resume" aria-labelledby="resume-title">
          <div className="resume-body">
            <p className="eyebrow">{t.continueTitle}</p>
            <h2 className="resume-title" id="resume-title">
              {resume.category.name}
            </h2>
            <div className="resume-progress">
              <div className="bar">
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((resume.progress.position / Math.max(1, resume.category.count)) * 100),
                    )}%`,
                  }}
                />
              </div>
              <p className="resume-meta">
                {t.continueMeta(resume.progress.position, resume.category.count)}
              </p>
            </div>
          </div>
          <div className="resume-action">
            <button type="button" className="btn btn-dark btn-lg btn-continue" onClick={onContinue}>
              {t.continueBtn}
              <IconArrowRight width={16} height={16} />
            </button>
          </div>
        </section>
      )}

      <div className="section-head">
        <h2 className="section-title">{t.topics}</h2>
        <span className="section-meta">
          <span className="num">{categories.length}</span> · {t.questions(totalQuestions)}
        </span>
      </div>

      {loading ? (
        <div className="empty">{t.loading}</div>
      ) : error ? (
        <div className="empty">{error}</div>
      ) : categories.length === 0 ? (
        <div className="empty">{t.noTopics}</div>
      ) : (
        <div className="topic-grid">
          {categories.map((category, index) => {
            const saved = progress[category.id]
            const done = saved?.answered ?? 0
            const pct = Math.min(100, Math.round((done / Math.max(1, category.count)) * 100))
            const Icon = topicIcon(category.name)
            return (
              <article
                className="topic-card"
                key={category.id}
                style={{ '--i': index } as CSSProperties}
              >
                <div className="topic-top">
                  <span className="topic-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="topic-count">{t.questions(category.count)}</span>
                </div>

                <h3 className="topic-name">{category.name}</h3>

                <div className="topic-progress">
                  <div className="bar" role="presentation">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className="topic-progress-meta">
                    <span className="num">
                      {done} / {category.count}
                    </span>
                    <span className="num">{pct}%</span>
                  </div>
                </div>

                <div className="topic-actions">
                  <button
                    type="button"
                    className="btn btn-dark btn-practice"
                    onClick={() => onStart(category, 'practice')}
                  >
                    {t.practice}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-test"
                    onClick={() => onStart(category, 'test')}
                  >
                    {t.test}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
