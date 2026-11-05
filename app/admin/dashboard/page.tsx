'use client'

import { Fragment, useEffect, useState } from 'react'
import AdminFrame from '@/components/admin/AdminFrame'

type Overview = {
  totals: { questions: number; needsReview: number; explained: number; openReports: number }
  books: Array<{
    book: string
    total: number
    needsReview: number
    chapters: Array<{ chapter: string; total: number; needsReview: number }>
  }>
  needsReview: Array<{ id: string; question: string; answer: string; book: string; chapter: string; level: string; difficulty: string }>
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    fetch('/api/admin/overview')
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? 'Failed')
        return response.json() as Promise<Overview>
      })
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const verify = async (id: string) => {
    setBusy(id)
    await fetch('/api/admin/mcq', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, action: 'verify' }),
    })
    setBusy(null)
    load()
  }

  return (
    <AdminFrame title="Dashboard" subtitle="Questions per book and chapter, and everything waiting for a human.">
      {error && <p className="note err">{error}</p>}
      {!data && !error && <p className="note">Loading…</p>}
      {data && (
        <>
          <div className="summary">
            <span className="pill">{data.totals.questions} MCQs</span>
            <span className="pill">{data.totals.explained} with explanations</span>
            <span className="pill">{data.totals.needsReview} needs review</span>
            <span className="pill">{data.totals.openReports} open reports</span>
          </div>

          <section className="card">
            <h2 className="card-title">Books</h2>
            <div className="table-wrap">
              <table className="rows">
                <thead>
                  <tr>
                    <th>Book / chapter</th>
                    <th>MCQs</th>
                    <th>Needs review</th>
                  </tr>
                </thead>
                <tbody>
                  {data.books.map((book) => (
                    <Fragment key={book.book}>
                      <tr className="row-total">
                        <td data-label="Book">
                          <strong>{book.book}</strong>
                        </td>
                        <td data-label="MCQs">{book.total}</td>
                        <td data-label="Needs review">{book.needsReview}</td>
                      </tr>
                      {book.chapters.map((chapter) => (
                        <tr key={`${book.book}-${chapter.chapter}`}>
                          <td data-label="Chapter">— {chapter.chapter}</td>
                          <td data-label="MCQs">{chapter.total}</td>
                          <td data-label="Needs review">{chapter.needsReview}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2 className="card-title">Needs review ({data.needsReview.length})</h2>
            {data.needsReview.length === 0 ? (
              <p className="note">Nothing waiting. Every question is marked verified.</p>
            ) : (
              <ul className="admin-list">
                {data.needsReview.map((row) => (
                  <li key={row.id}>
                    <p className="admin-q">{row.question}</p>
                    <p className="admin-meta">
                      {row.book} · {row.chapter} · {row.level} / {row.difficulty} · answer: {row.answer}
                    </p>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={busy === row.id}
                        onClick={() => void verify(row.id)}
                      >
                        Mark verified
                      </button>
                      <a className="btn btn-ghost btn-sm" href={`/admin/reports?q=${encodeURIComponent(row.id)}`}>
                        Open in reports
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdminFrame>
  )
}
