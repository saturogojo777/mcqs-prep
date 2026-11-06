'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Num, T } from '@/components/text'
import { useLang } from '@/components/i18n'
import { copyFor } from '@/lib/copy'
import { loadCatalog, loadSubjectSeenCounts } from '@/lib/catalog'
import { accuracyPercent, clearProgress, getProgress, type ProgressState } from '@/lib/progress'
import { SEEN_CAP, clearSeen, excludeIdsForSend, readSeen } from '@/lib/seen'
import { getSupabase } from '@/lib/supabase'

export default function ProgressView() {
  const lang = useLang()
  const t = copyFor(lang)
  const [state, setState] = useState<ProgressState | null>(null)
  const [seenRows, setSeenRows] = useState<{ slug: string; name: string; seen: number; total: number }[] | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [seenMsg, setSeenMsg] = useState<string | null>(null)

  useEffect(() => {
    setState(getProgress())
    // "Seen N of M" per subject. The whole seen map is matched server-side
    // (not just the 1500-id send window), so the counts stay exact.
    const client = getSupabase()
    if (!client) return
    let cancelled = false
    void (async () => {
      try {
        const seenIds = excludeIdsForSend(readSeen(), SEEN_CAP)
        const [catalog, counts] = await Promise.all([
          loadCatalog(client),
          loadSubjectSeenCounts(client, seenIds),
        ])
        if (cancelled) return
        setSeenRows(
          catalog.subjects
            .filter((subject) => subject.count > 0)
            .map((subject) => ({
              slug: subject.key,
              name: subject.name,
              seen: Math.min(counts[subject.key] ?? 0, subject.count),
              total: subject.count,
            })),
        )
      } catch {
        if (!cancelled) setSeenRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const resetSeenHistory = () => {
    clearSeen()
    setSeenRows(null)
    setSeenMsg(t.resetSeenDone)
    setConfirmReset(false)
  }

  if (!state) {
    return (
      <div className="container page">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--row" />
        <div className="skeleton skeleton--row" />
      </div>
    )
  }

  const subjects = Object.entries(state.subjects).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">{t.progressTitle}</p>
        <h1 className="page-title">
          <T en="My progress" ur="میری پیش رفت" />
        </h1>
        <p className="page-sub">
          <T
            en="Everything here is stored in this browser only. No account, nothing sent to a server."
            ur="یہ سب کچھ صرف اسی براؤزر میں محفوظ ہے۔ نہ اکاؤنٹ، نہ سرور پر کچھ بھیجا جاتا ہے۔"
          />
        </p>
      </header>

      {state.tests === 0 ? (
        <div className="empty-state">
          <p className="empty-title">{t.noTests}</p>
          <Link href="/exams" className="btn btn-dark">
            {t.backToStart}
          </Link>
        </div>
      ) : (
        <>
          <section className="stats-strip">
            <div className="stat">
              <span className="stat-value num">{state.tests}</span>
              <span className="stat-label">{t.testsTaken}</span>
            </div>
            <div className="stat">
              <span className="stat-value num">{state.streak}</span>
              <span className="stat-label">{t.streak}</span>
            </div>
            <div className="stat">
              <span className="stat-value num">{accuracyPercent({ total: state.answered, right: state.right })}%</span>
              <span className="stat-label">{t.overallAccuracy}</span>
            </div>
            <div className="stat">
              <span className="stat-value num">{state.answered}</span>
              <span className="stat-label">
                <T en="questions answered" ur="جواب شدہ سوالات" />
              </span>
            </div>
          </section>

          <section className="home-section">
            <h2 className="section-title">{t.bySubject}</h2>
            <ul className="bars">
              {subjects.map(([name, bucket]) => {
                const percent = accuracyPercent(bucket)
                return (
                  <li className="bar-row" key={name}>
                    <span className="bar-label">{name.replace(/-/g, ' ')}</span>
                    <span className="bar-track" aria-hidden="true">
                      <span className="bar-fill" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="bar-value num">
                      {percent}% · {bucket.right}/{bucket.total}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <div className="result-actions result-actions--left">
            <Link href="/exams" className="btn btn-dark">
              {t.backToStart}
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                clearProgress()
                setState(getProgress())
              }}
            >
              {t.clearAll}
            </button>
          </div>
        </>
      )}

      {seenMsg ? <p className="row-hint">{seenMsg}</p> : null}

      {seenRows && seenRows.some((row) => row.seen > 0) ? (
        <section className="home-section">
          <h2 className="section-title">{t.seenProgress}</h2>
          <ul className="bars">
            {seenRows.map((row) => (
              <li className="bar-row" key={row.slug}>
                <span className="bar-label">{row.name}</span>
                <span className="bar-track" aria-hidden="true">
                  <span
                    className="bar-fill"
                    style={{ width: `${row.total === 0 ? 0 : Math.round((row.seen / row.total) * 100)}%` }}
                  />
                </span>
                <span className="bar-value num">{t.seenCount(String(row.seen), String(row.total))}</span>
              </li>
            ))}
          </ul>
          <p className="row-hint">{t.browserOnlyNote}</p>
          <div className="result-actions result-actions--left">
            <button type="button" className="btn btn-outline" onClick={() => setConfirmReset(true)}>
              {t.resetSeen}
            </button>
          </div>
        </section>
      ) : null}

      {confirmReset ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setConfirmReset(false)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-seen-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="dialog-title" id="reset-seen-title">
              {t.resetSeenTitle}
            </h2>
            <p className="dialog-body">{t.resetSeenBody}</p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-dark" onClick={resetSeenHistory}>
                {t.resetSeenYes}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="page-foot-note">
        <Num>·</Num> <T en="Mistakes are kept separately." ur="غلطیاں الگ محفوظ رہتی ہیں۔" />{' '}
        <Link href="/mistakes">
          <T en="Open my mistakes" ur="میری غلطیاں کھولیں" />
        </Link>
      </p>
    </div>
  )
}
