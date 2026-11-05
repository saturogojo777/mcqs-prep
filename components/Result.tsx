'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import type { Copy } from '@/lib/copy'
import type { Lang } from '@/lib/progress'
import type { Session } from '@/lib/session'

const RADIUS = 62
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type Props = {
  session: Session
  lang: Lang
  t: Copy
  onRetry: () => void
  onHome: () => void
}

export default function Result({ session, lang, t, onRetry, onHome }: Props) {
  const total = session.mode === 'test' ? session.questions.length : session.records.length
  const correct = session.records.filter((record) => record.correct).length
  const wrongCount = Math.max(0, total - correct)
  const percent = Math.round((correct / Math.max(1, total)) * 100)
  const missed = session.records.filter((record) => !record.correct)

  const [displayPercent, setDisplayPercent] = useState(0)
  const [ringPercent, setRingPercent] = useState(0)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    setRingPercent(percent)
    if (reduce) {
      setDisplayPercent(percent)
      return
    }

    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 850)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayPercent(Math.round(percent * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
      else setDisplayPercent(percent)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [percent])

  return (
    <>
      <section className="result-card">
        <p className="eyebrow">{session.mode === 'test' ? t.resultTest : t.resultSession}</p>

        <div className="ring">
          <svg viewBox="0 0 168 168" aria-hidden="true">
            <circle className="ring-track" cx="84" cy="84" r={RADIUS} />
            <circle
              className="ring-value-stroke"
              cx="84"
              cy="84"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - ringPercent / 100)}
            />
          </svg>
          <div className="ring-center">
            <span className="ring-percent result-percent num">{displayPercent}%</span>
            <span className="ring-sub num">
              {correct} / {total}
            </span>
          </div>
        </div>

        <div className="result-counts">
          <div className="result-count">
            <strong className="num">{correct}</strong>
            <span>{t.correctCount}</span>
          </div>
          <div className="result-count">
            <strong className="num">{wrongCount}</strong>
            <span>{t.wrongCount}</span>
          </div>
        </div>

        <div className="result-actions">
          <button type="button" className="btn btn-dark btn-lg btn-retry" onClick={onRetry}>
            {t.retry}
          </button>
          <button type="button" className="btn btn-outline btn-lg btn-home" onClick={onHome}>
            {t.home}
          </button>
        </div>
      </section>

      {missed.length > 0 ? (
        <>
          <div className="review-head">
            <h2 className="section-title">{t.review}</h2>
            <span className="section-meta">{t.reviewSub(missed.length)}</span>
          </div>
          <div className="review-list">
            {missed.map((record, index) => (
              <div
                className="review-item"
                key={record.question.id}
                style={{ '--i': index } as CSSProperties}
              >
                <p className={`review-q${lang === 'ur' && record.question.question_ur ? ' urdu' : ''}`}>
                  {lang === 'ur' && record.question.question_ur
                    ? record.question.question_ur
                    : record.question.question_en}
                </p>
                <div className="review-rows">
                  <dl className="review-row">
                    <dt>{t.yourAnswer}:</dt>
                    <dd>{record.chosen}</dd>
                  </dl>
                  <dl className="review-row review-row--correct">
                    <dt>{t.correctAnswer}:</dt>
                    <dd>{record.question.correct_text}</dd>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        total > 0 && <p className="note">{t.noMistakes}</p>
      )}
    </>
  )
}
