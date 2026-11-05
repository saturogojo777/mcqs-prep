'use client'

import { useEffect, useState } from 'react'
import { IconLogo } from '@/components/icons'

type PreviewRow = {
  line: number
  status: 'new' | 'duplicate' | 'invalid'
  question_en: string
  book: string
  category: string
  answer: string
  messages: string[]
}

type Summary = {
  total: number
  newCount: number
  duplicateCount: number
  invalidCount: number
  inFileDuplicates: number
  truncated: boolean
  rows: PreviewRow[]
}

type ImportResult = {
  imported: number
  skippedDuplicates: number
  skippedInvalid: number
  books: string[]
  categories: string[]
}

const TEMPLATE_COLUMNS =
  'book, category, question_en, question_ur, option_a, option_b, option_c, option_d, correct_answer, explanation'
const TEMPLATE_URL =
  'https://docs.google.com/spreadsheets/d/13d2QDw9kvtUgHj-YofgBuwZPJIQMHJu05Qd-XlNhLV8/edit'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <header className="nav">
        <div className="container nav-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <IconLogo />
            </span>
            <span className="brand-name">Admin import</span>
          </div>
        </div>
      </header>
      <main className="main">
        <div className="container container--narrow">{children}</div>
      </main>
      <footer className="footer">
        <div className="container">MCQ Practice</div>
      </footer>
    </div>
  )
}

export default function AdminPage() {
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [loginEmail, setLoginEmail] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)

  const [tab, setTab] = useState<'sheet' | 'text'>('sheet')
  const [sheetUrl, setSheetUrl] = useState('')
  const [pasted, setPasted] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [book, setBook] = useState('')
  const [category, setCategory] = useState('')

  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/me')
      .then((res) => res.json())
      .then((data: { email: string | null }) => setEmail(data.email ?? null))
      .catch(() => setEmail(null))
  }, [])

  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoggingIn(true)
    setLoginError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, key: accessKey }),
      })
      const data = (await res.json()) as { email?: string; error?: string }
      if (!res.ok) {
        setLoginError(data.error ?? 'Could not sign in.')
        return
      }
      setEmail(data.email ?? loginEmail)
      setAccessKey('')
    } catch {
      setLoginError('Network error. Try again.')
    } finally {
      setLoggingIn(false)
    }
  }

  const logout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' })
    setEmail(null)
    setSummary(null)
    setResult(null)
  }

  const source = () =>
    tab === 'sheet' ? { kind: 'url', value: sheetUrl } : { kind: 'text', value: pasted }

  const runPreview = async () => {
    setPreviewing(true)
    setError(null)
    setSummary(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: source(), book, category }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Preview failed.')
        return
      }
      setSummary(data as Summary)
    } catch {
      setError('Network error while reading the source.')
    } finally {
      setPreviewing(false)
    }
  }

  const runImport = async () => {
    setImporting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: source(), book, category }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Import failed.')
        return
      }
      setResult(data as ImportResult)
      setSummary(null)
    } catch {
      setError('Network error during import.')
    } finally {
      setImporting(false)
    }
  }

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setPasted(text)
    setFileName(file.name)
    setTab('text')
  }

  if (email === undefined) {
    return (
      <Shell>
        <div className="empty">Loading…</div>
      </Shell>
    )
  }

  if (email === null) {
    return (
      <Shell>
        <div className="admin-head">
          <div>
            <h1 className="admin-title">Sign in</h1>
            <p className="home-sub">Only the admin account can import questions.</p>
          </div>
        </div>
        <form className="card" onSubmit={login}>
          <label className="field">
            <span>Your email</span>
            <input
              type="email"
              autoComplete="username"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Access key</span>
            <input
              type="password"
              autoComplete="current-password"
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
              required
            />
          </label>
          {loginError && <p className="note err">{loginError}</p>}
          <button className="btn btn-dark btn-block" type="submit" disabled={loggingIn}>
            {loggingIn ? 'Checking…' : 'Sign in'}
          </button>
        </form>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="admin-head">
        <div>
          <h1 className="admin-title">Import questions</h1>
          <p className="home-sub">Signed in as {email}</p>
        </div>
        <button className="btn btn-outline" type="button" onClick={logout}>
          Sign out
        </button>
      </div>

      <section className="card">
        <h2 className="card-title">Source</h2>
        <p className="card-sub">Paste a Google Sheet link, rows, or upload a JSON / CSV file.</p>

        <div className="tabs">
          <button type="button" aria-pressed={tab === 'sheet'} onClick={() => setTab('sheet')}>
            Google Sheet link
          </button>
          <button type="button" aria-pressed={tab === 'text'} onClick={() => setTab('text')}>
            Paste / upload file
          </button>
        </div>

        {tab === 'sheet' ? (
          <label className="field">
            <span>Sheet link</span>
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={sheetUrl}
              onChange={(event) => setSheetUrl(event.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="field">
              <span>Rows (CSV, TSV or JSON)</span>
              <textarea
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                placeholder={`${TEMPLATE_COLUMNS}\nGeneral Knowledge,Science,Water is made of?,پانی کیا ہے؟,H2O,CO2,O2,NaCl,A,`}
              />
            </label>
            <label className="field">
              <span>…or pick a file {fileName ? `(${fileName})` : ''}</span>
              <input type="file" accept=".csv,.tsv,.txt,.json" onChange={onFile} />
            </label>
          </>
        )}

        <div className="field-row">
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Default book (optional)</span>
            <input
              type="text"
              placeholder="e.g. General Knowledge (500 Questions)"
              value={book}
              onChange={(event) => setBook(event.target.value)}
            />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Default category (optional)</span>
            <input
              type="text"
              placeholder="e.g. Science & Computer"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </label>
        </div>

        <p className="note">
          Columns: <code>{TEMPLATE_COLUMNS}</code>. <code>book</code> and <code>category</code> fall
          back to the defaults above. Answers can be a letter (A–D) or the exact option text; they are
          always stored as the option text.
        </p>
        <p className="note">
          Starting a new book? Copy the{' '}
          <a href={TEMPLATE_URL} target="_blank" rel="noreferrer">
            Google Sheet template
          </a>
          . For the link import to work, share the sheet as “Anyone with the link → Viewer” (or paste
          the rows instead).
        </p>

        <div style={{ marginTop: 18 }}>
          <button className="btn btn-dark" type="button" onClick={runPreview} disabled={previewing}>
            {previewing ? 'Checking rows…' : 'Preview'}
          </button>
        </div>

        {error && <p className="note err">{error}</p>}
      </section>

      {summary && (
        <section className="card">
          <h2 className="card-title">Preview</h2>
          <div className="summary">
            <span className="pill">{summary.total} rows</span>
            <span className="pill new">{summary.newCount} new</span>
            <span className="pill">{summary.duplicateCount} duplicates</span>
            <span className="pill">{summary.invalidCount} invalid</span>
          </div>

          {summary.newCount > 0 ? (
            <button className="btn btn-dark" type="button" onClick={runImport} disabled={importing}>
              {importing
                ? 'Importing…'
                : `Import ${summary.newCount} new question${summary.newCount === 1 ? '' : 's'}`}
            </button>
          ) : (
            <p className="note">Nothing new to import.</p>
          )}

          {summary.truncated && (
            <p className="note">
              Showing the first {summary.rows.length} rows. The import uses every row.
            </p>
          )}

          <div className="table-wrap">
            <table className="rows">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Status</th>
                  <th>Question</th>
                  <th>Book</th>
                  <th>Category</th>
                  <th>Answer</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row.line}>
                    <td data-label="Row">{row.line}</td>
                    <td data-label="Status">
                      <span className={`badge ${row.status}`}>{row.status}</span>
                    </td>
                    <td className="qcell" data-label="Question">
                      {row.question_en || '—'}
                    </td>
                    <td data-label="Book">{row.book || '—'}</td>
                    <td data-label="Category">{row.category || '—'}</td>
                    <td data-label="Answer">{row.answer || '—'}</td>
                    <td className={row.status === 'invalid' ? 'err-cell' : undefined} data-label="Notes">
                      {row.messages.join('; ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result && (
        <section className="card">
          <h2 className="card-title">Imported</h2>
          <p className="note" style={{ marginTop: 0 }}>
            {result.imported} question{result.imported === 1 ? '' : 's'} added.
            {result.skippedDuplicates > 0 && ` ${result.skippedDuplicates} duplicate(s) skipped.`}
            {result.skippedInvalid > 0 && ` ${result.skippedInvalid} invalid row(s) rejected.`}
          </p>
          {result.categories.length > 0 && (
            <p className="note">
              Books: {result.books.join(', ') || '—'}
              <br />
              Categories: {result.categories.join(', ') || '—'}
            </p>
          )}
          <div style={{ marginTop: 18 }}>
            <button className="btn btn-outline" type="button" onClick={() => setResult(null)}>
              Import another file
            </button>
          </div>
        </section>
      )}
    </Shell>
  )
}
