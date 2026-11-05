'use client'

import { useEffect, useState } from 'react'
import AdminFrame from '@/components/admin/AdminFrame'

type PatternRow = {
  exam_id: string
  slug: string
  exam: string
  question_count: number
  minutes: number
  marks_per_question: number
  negative_marking: number
  passing_percentage: number
}

type Draft = Record<string, PatternRow>

export default function AdminPatternsPage() {
  const [rows, setRows] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/overview')
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? 'Failed')
        return response.json() as Promise<{ patterns: PatternRow[] }>
      })
      .then((data) => {
        const map: Draft = {}
        for (const row of data.patterns) map[row.slug] = row
        setRows(map)
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const update = (slug: string, field: keyof PatternRow, value: number) => {
    setRows((current) =>
      current ? { ...current, [slug]: { ...current[slug], [field]: value } } : current,
    )
  }

  const save = async (slug: string) => {
    if (!rows) return
    const row = rows[slug]
    const response = await fetch('/api/admin/patterns', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        examSlug: slug,
        questionCount: row.question_count,
        minutes: row.minutes,
        marksPerQuestion: row.marks_per_question,
        negativeMarking: row.negative_marking,
        passingPercentage: row.passing_percentage,
      }),
    })
    setSaved(response.ok ? slug : null)
  }

  const FIELDS: Array<{ key: keyof PatternRow; label: string }> = [
    { key: 'question_count', label: 'Questions' },
    { key: 'minutes', label: 'Minutes' },
    { key: 'marks_per_question', label: 'Marks / question' },
    { key: 'negative_marking', label: 'Negative' },
    { key: 'passing_percentage', label: 'Pass %' },
  ]

  return (
    <AdminFrame
      title="Test patterns"
      subtitle="These numbers drive the mock test. They are our defaults, never an official announcement — the student screen says so."
    >
      {error && <p className="note err">{error}</p>}
      {!rows && !error && <p className="note">Loading…</p>}
      {rows && (
        <section className="card">
          <div className="table-wrap">
            <table className="rows">
              <thead>
                <tr>
                  <th>Exam</th>
                  {FIELDS.map((field) => (
                    <th key={field.key}>{field.label}</th>
                  ))}
                  <th>Save</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(rows).map((row) => (
                  <tr key={row.slug}>
                    <td data-label="Exam">
                      <strong>{row.exam}</strong>
                    </td>
                    {FIELDS.map((field) => (
                      <td key={field.key} data-label={field.label}>
                        <input
                          className="input-sm"
                          type="number"
                          min={0}
                          value={row[field.key] as number}
                          onChange={(event) => update(row.slug, field.key, Number(event.target.value))}
                        />
                      </td>
                    ))}
                    <td data-label="Save">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => void save(row.slug)}>
                        {saved === row.slug ? 'Saved' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Negative marking and pass percentage are stored per exam. Defaults stay at 100 questions, 120 minutes, 1 mark,
            no negative marking and 50% to pass until you change them.
          </p>
        </section>
      )}
    </AdminFrame>
  )
}
