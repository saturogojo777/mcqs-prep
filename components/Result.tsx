'use client'

import { useEffect, useState } from 'react'
import { Num } from '@/components/text'
import { copyFor } from '@/lib/copy'
import { formatClock, groupAccuracy, questionText, score, weakestTopics } from '@/lib/session'
import type { Answer, Lang, MockPattern, PreparedQuestion } from '@/lib/types'

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type MockSummary = {
  marks: number
  maxMarks: number
  percent: number
  right: number
  wrong: number
  skipped: number
  passed: boolean
  pattern: MockPattern
}

type Props = {
  questions: PreparedQuestion[]
  answers: Answer[]
  elapsed: number
  lang: Lang
  mistakeCount: number
  mock?: MockSummary | null
  onTryAgain: () => void
  onMistakes: () => void
  onHome: () => void
  onPracticeTopic?: (chapter: string) => void
}

function Bars({ rows, empty }: { rows: { label: string; right: number; total: number; percent: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="note">{empty}</p>
  return (
    <ul className="bars">
      {rows.map((row) => (
        <li className="bar-row" key={row.label}>
          <span className="bar-label" dir="auto">
            {row.label}
          </span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ width: `${row.percent}%` }} />
          </span>
          <span className="bar-value num">
            {row.right}/{row.total}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function Result({
  questions,
  answers,
  elapsed,
  lang,
  mistakeCount,
  mock,
  onTryAgain,
  onMistakes,
  onHome,
  onPracticeTopic,
}: Props) {
  const t = copyFor(lang)
  const { right, total, percent } = score(answers)
  const shownPercent = mock ? mock.percent : percent
  const wrong = answers.filter((answer) => !answer.right)
  const byId = new Map(questions.map((question) => [question.id, question]))

  const bySubject = groupAccuracy(answers, 'subject')
  const byChapter = groupAccuracy(answers, 'chapter')
  const weak = weakestTopics(answers, 3)

  const [displayPercent, setDisplayPercent] = useState(0)
  const [ringPercent, setRingPercent] = useState(0)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setRingPercent(shownPercent)
    if (reduce) {
      setDisplayPercent(shownPercent)
      return
    }
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 750)
      const eased = 1 - Math.pow(1 - progress, 3)
      if (progress < 1) {
        setDisplayPercent(Math.round(shownPercent * eased))
        frame = requestAnimationFrame(step)
      } else {
        setDisplayPercent(shownPercent)
      }
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [shownPercent])

  return (
    <div className="result">
      <section className="result-card">
        <p className="eyebrow">{mock ? t.mockTest : t.result}</p>

        <div className="ring">
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <circle className="ring-track" cx="70" cy="70" r={RADIUS} />
            <circle
              className="ring-value"
              cx="70"
              cy="70"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - ringPercent / 100)}
            />
          </svg>
          <div className="ring-center">
            <span className="ring-percent result-percent num">{displayPercent}%</span>
            <span className="ring-sub num">
              {right} / {total}
            </span>
          </div>
        </div>

        <div className="result-facts">
          <div className="fact">
            <span className="fact-value num">{mock ? mock.right : right}</span>
            <span className="fact-label">{t.correct}</span>
          </div>
          <div className="fact">
            <span className="fact-value num">{mock ? mock.wrong : total - right}</span>
            <span className="fact-label">{t.wrong}</span>
          </div>
          <div className="fact">
            <span className="fact-value num">{formatClock(elapsed)}</span>
            <span className="fact-label">{t.time}</span>
          </div>
          {mock && (
            <div className="fact">
              <span className="fact-value num">
                {mock.marks}
                <span className="fact-of">/{mock.maxMarks}</span>
              </span>
              <span className="fact-label">{t.marks}</span>
            </div>
          )}
        </div>

        {mock && (
          <p className="mock-verdict" data-passed={mock.passed}>
            {mock.passed ? t.passed : t.failed}
            <span className="mock-verdict-detail">
              {' · '}
              {t.passing}: <Num>{mock.pattern.passingPercentage}%</Num>
              {mock.skipped > 0 ? (
                <>
                  {' · '}
                  {t.unansweredCount}: <Num>{mock.skipped}</Num>
                </>
              ) : null}
            </span>
          </p>
        )}

        <div className="result-actions">
          <button type="button" className="btn btn-dark btn-lg btn-try-again" onClick={onTryAgain}>
            {t.tryAgain}
          </button>
          {mistakeCount > 0 && (
            <button type="button" className="btn btn-outline btn-lg btn-mistakes" onClick={onMistakes}>
              {t.practiceMistakes}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-lg btn-home" onClick={onHome}>
            {t.home}
          </button>
        </div>
      </section>

      {answers.length > 0 && (
        <section className="result-breakdown">
          <div className="breakdown-block">
            <h2 className="section-title section-title--small">{t.bySubject}</h2>
            <Bars rows={bySubject} empty={t.noQuestions} />
          </div>
          <div className="breakdown-block">
            <h2 className="section-title section-title--small">{t.byChapter}</h2>
            <Bars rows={byChapter.slice(0, 8)} empty={t.noQuestions} />
          </div>
          <div className="breakdown-block">
            <h2 className="section-title section-title--small">{t.weakTopics}</h2>
            {weak.length === 0 ? (
              <p className="note">{t.noneWeak}</p>
            ) : (
              <ul className="weak-list">
                {weak.map((topic) => (
                  <li key={topic.label} className="weak-item">
                    <span className="weak-name" dir="auto">
                      {topic.label}
                    </span>
                    <span className="weak-value num">{topic.percent}%</span>
                    {onPracticeTopic && (
                      <button type="button" className="weak-btn" onClick={() => onPracticeTopic(topic.label)}>
                        {t.practiceMistakes}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {wrong.length > 0 ? (
        <section className="review">
          <h2 className="section-title">{t.reviewTitle}</h2>
          <ul className="review-list">
            {wrong.map((answer, i) => {
              const question = byId.get(answer.questionId)
              if (!question) return null
              const urdu = lang === 'ur' && Boolean(question.question_ur)
              return (
                <li className="review-item" key={answer.questionId} style={{ '--i': i } as React.CSSProperties}>
                  <p className={urdu ? 'review-q qtext--ur' : 'review-q'} dir={urdu ? 'rtl' : 'ltr'}>
                    {questionText(question, lang)}
                  </p>
                  <p className="review-row">
                    <span className="review-label">{t.yourAnswer}</span>
                    <span className="review-value" dir="auto">
                      {answer.chosen}
                    </span>
                  </p>
                  <p className="review-row review-row--right">
                    <span className="review-label">{t.correctAnswer}</span>
                    <span className="review-value" dir="auto">
                      {question.correct}
                    </span>
                  </p>
                  {question.explanation ? <p className="review-note">{question.explanation}</p> : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <p className="note">{t.noMistakes}</p>
      )}
    </div>
  )
}
