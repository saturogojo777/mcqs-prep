'use client'

import { useEffect, useState } from 'react'

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

const TEMPLATE_COLUMNS = 'book, category, question_en, question_ur, option_a, option_b, option_c, option_d, correct_answer, explanation'

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
      <div className="shell admin-wrap">
        <p className="lede">Loading…</p>
      </div>
    )
  }

  if (email === null) {
    return (
      <div className="shell admin-wrap">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">MCQ</span>
            <h1>Admin import</h1>
          </div>
        </header>
        <form className="card admin-card" onSubmit={login}>
          <label className="field">
            <span>Your email</span>
            <input
              type="email"
              autoComplete="username"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Access key</span>
            <input
              type="password"
              autoComplete="current-password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              required
            />
          </label>
          {loginError && <p className="note err">{loginError}</p>}
          <button className="primary" type="submit" disabled={loggingIn}>
            {loggingIn ? 'Checking…' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="shell admin-wrap">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">MCQ</span>
          <h1>Admin import</h1>
        </div>
        <button className="lang-toggle" type="button" onClick={logout}>
          Sign out
        </button>
      </header>

      <p className="lede">Signed in as {email}</p>

      <section className="card admin-card">
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
              onChange={(e) => setSheetUrl(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="field">
              <span>Rows (CSV, TSV or JSON)</span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={`${TEMPLATE_COLUMNS}\nGeneral Knowledge,Science,Water is made of?,پانی کیا ہے؟,H2O,CO2,O2,NaCl,A,`}
              />
            </label>
            <label className="field">
              <span>…or pick a file {fileName ? `(${fileName})` : ''}</span>
              <input type="file" accept=".csv,.tsv,.txt,.json" onChange={onFile} />
            </label>
          </>
        )}

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Default book (optional)</span>
            <input
              type="text"
              placeholder="e.g. General Knowledge (500 Questions)"
              value={book}
              onChange={(e) => setBook(e.target.value)}
            />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Default category (optional)</span>
            <input
              type="text"
              placeholder="e.g. Science & Computer"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
        </div>

        <p className="note" style={{ marginTop: 12 }}>
          Columns: <code>{TEMPLATE_COLUMNS}</code>. <code>book</code> and <code>category</code> fall
          back to the defaults above. Answers can be a letter (A–D) or the exact option text; they are
          always stored as the option text.
        </p>

        <button className="primary" type="button" onClick={runPreview} disabled={previewing}>
          {previewing ? 'Checking rows…' : 'Preview'}
        </button>

        {error && <p className="note err">{error}</p>}
      </section>

      {summary && (
        <section className="card admin-card" style={{ marginTop: 14 }}>
          <div className="summary">
            <span className="pill">{summary.total} rows</span>
            <span className="pill new">{summary.newCount} new</span>
            <span className="pill dup">{summary.duplicateCount} duplicates</span>
            <span className="pill bad">{summary.invalidCount} invalid</span>
          </div>

          {summary.newCount > 0 ? (
            <button className="primary" type="button" onClick={runImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${summary.newCount} new question${summary.newCount === 1 ? '' : 's'}`}
            </button>
          ) : (
            <p className="note">Nothing new to import.</p>
          )}

          {summary.truncated && (
            <p className="note" style={{ marginTop: 10 }}>
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
                    <td>{row.line}</td>
                    <td>
                      <span className={`badge ${row.status}`}>{row.status}</span>
                    </td>
                    <td className="qcell">{row.question_en || '—'}</td>
                    <td>{row.book || '—'}</td>
                    <td>{row.category || '—'}</td>
                    <td>{row.answer || '—'}</td>
                    <td>{row.messages.join('; ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result && (
        <section className="card admin-card" style={{ marginTop: 14 }}>
          <p className="note ok">
            Imported {result.imported} question{result.imported === 1 ? '' : 's'}.
            {result.skippedDuplicates > 0 && ` Skipped ${result.skippedDuplicates} duplicate(s).`}
            {result.skippedInvalid > 0 && ` Rejected ${result.skippedInvalid} invalid row(s).`}
          </p>
          {result.categories.length > 0 && (
            <p className="note">
              Books: {result.books.join(', ') || '—'}
              <br />
              Categories: {result.categories.join(', ') || '—'}
            </p>
          )}
          <button className="primary ghost" type="button" onClick={() => setResult(null)}>
            Import another file
          </button>
        </section>
      )}
    </div>
  )
}
