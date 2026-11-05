'use client'

import { useEffect, useState } from 'react'
import AdminFrame from '@/components/admin/AdminFrame'

type Report = {
  id: string
  mcq_id: string | null
  reason: string
  note: string | null
  status: string
  created_at: string
  question: string | null
  correct_text: string | null
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ question_en: '', correct_text: '', explanation: '' })

  const load = () => {
    fetch('/api/admin/overview')
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? 'Failed')
        return response.json() as Promise<{ reports: Report[] }>
      })
      .then((data) => setReports(data.reports))
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const patch = async (id: string, status: string) => {
    await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  const remove = async (id: string) => {
    await fetch('/api/admin/reports', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const saveQuestion = async (mcqId: string) => {
    const response = await fetch('/api/admin/mcq', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: mcqId, ...draft }),
    })
    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      setError(data.error ?? 'Could not save.')
      return
    }
    setEditing(null)
    load()
  }

  return (
    <AdminFrame title="Reports" subtitle="Every wrong-question report sent from the quiz.">
      {error && <p className="note err">{error}</p>}
      {!reports && !error && <p className="note">Loading…</p>}
      {reports && reports.length === 0 && <p className="note">No reports yet.</p>}
      {reports && reports.length > 0 && (
        <ul className="admin-list">
          {reports.map((report) => (
            <li key={report.id} className={report.status === 'open' ? undefined : 'admin-list-item--muted'}>
              <p className="admin-q">{report.question ?? '(question deleted)'}</p>
              <p className="admin-meta">
                {new Date(report.created_at).toLocaleString('en-PK')} · {report.reason} · {report.status}
                {report.correct_text ? ` · marked answer: ${report.correct_text}` : ''}
              </p>
              {report.note && <p className="admin-note">“{report.note}”</p>}
              <div className="admin-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void patch(report.id, 'fixed')}>
                  Fixed
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void patch(report.id, 'ignored')}>
                  Ignore
                </button>
                {report.mcq_id && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (editing === report.mcq_id) {
                        setEditing(null)
                        return
                      }
                      setEditing(report.mcq_id)
                      setDraft({
                        question_en: report.question ?? '',
                        correct_text: report.correct_text ?? '',
                        explanation: '',
                      })
                    }}
                  >
                    {editing === report.mcq_id ? 'Close editor' : 'Edit question'}
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(report.id)}>
                  Delete report
                </button>
              </div>

              {editing === report.mcq_id && (
                <div className="admin-editor">
                  <label className="field">
                    <span>Question (English)</span>
                    <textarea
                      rows={2}
                      value={draft.question_en}
                      onChange={(event) => setDraft({ ...draft, question_en: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Correct answer text</span>
                    <input
                      value={draft.correct_text}
                      onChange={(event) => setDraft({ ...draft, correct_text: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Explanation</span>
                    <textarea
                      rows={2}
                      value={draft.explanation}
                      onChange={(event) => setDraft({ ...draft, explanation: event.target.value })}
                    />
                  </label>
                  <div className="admin-actions">
                    <button type="button" className="btn btn-dark btn-sm" onClick={() => void saveQuestion(report.mcq_id!)}>
                      Save question
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        if (!report.mcq_id) return
                        await fetch('/api/admin/mcq', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ id: report.mcq_id, action: 'delete' }),
                        })
                        setEditing(null)
                        load()
                      }}
                    >
                      Delete question
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  )
}
