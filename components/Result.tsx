'use client'

import { useEffect, useState } from 'react'
import { Num } from '@/components/text'
import { copyFor } from '@/lib/copy'
import { formatClock, questionText, score } from '@/lib/session'
import type { Answer, Lang, PreparedQuestion } from '@/lib/types'

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type Props = {
  questions: PreparedQuestion[]
  answers: Answer[]
  elapsed: number
  lang: Lang
  mistakeCount: number
  onTryAgain: () => void
  onMistakes: () => void
  onHome: () => void
}

export default function Result({
  questions,
  answers,
  elapsed,
  lang,
  mistakeCount,
  onTryAgain,
  onMistakes,
  onHome,
}: Props) {
  const t = copyFor(lang)
  const { right, total, percent } = score(answers)
  const wrong = answers.filter((answer) => !answer.right)
  const byId = new Map(questions.map((question) => [question.id, question]))

  const [displayPercent, setDisplayPercent] = useState(0)
  const [ringPercent, setRingPercent] = useState(0)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setRingPercent(percent)
    if (reduce) {
      setDisplayPercent(percent)
      return
    }
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 750)
      const eased = 1 - Math.pow(1 - progress, 3)
      if (progress < 1) {
        setDisplayPercent(Math.round(percent * eased))
        frame = requestAnimationFrame(step)
      } else {
        setDisplayPercent(percent)
      }
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [percent])

  return (
    <div className="result">
      <section className="result-card">
        <p className="eyebrow">{t.result}</p>

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
            <span className="fact-value num">{right}</span>
            <span className="fact-label">{t.correct}</span>
          </div>
          <div className="fact">
            <span className="fact-value num">{total - right}</span>
            <span className="fact-label">{t.wrong}</span>
          </div>
          <div className="fact">
            <span className="fact-value num">{formatClock(elapsed)}</span>
            <span className="fact-label">{t.time}</span>
          </div>
        </div>

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
