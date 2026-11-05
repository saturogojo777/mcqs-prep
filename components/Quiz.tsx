'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Copy } from '@/lib/copy'
import type { Lang } from '@/lib/progress'
import type { Session } from '@/lib/session'
import { formatClock, optionsFor } from '@/lib/session'
import {
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconClose,
  IconRestart,
} from '@/components/icons'

type Props = {
  session: Session
  lang: Lang
  t: Copy
  onAnswer: (option: string) => void
  onNext: () => void
  onBack: () => void
  onRestart: () => void
}

export default function Quiz({ session, lang, t, onAnswer, onNext, onBack, onRestart }: Props) {
  const current = session.questions[session.index]
  const total = session.questions.length
  const isTest = session.mode === 'test'
  const atEnd = session.index + 1 >= total

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isTest) return
    const update = () => setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [isTest, session.startedAt])

  const options = useMemo(() => optionsFor(current), [current])

  const answeredIds = useMemo(
    () => new Set(session.records.map((record) => record.question.id)),
    [session.records],
  )

  const progress = Math.round(((session.index + (session.selected ? 1 : 0)) / total) * 100)

  const questionText = lang === 'ur' && current.question_ur ? current.question_ur : current.question_en

  const feedbackKind = session.selected
    ? session.selected === current.correct_text
      ? 'correct'
      : 'wrong'
    : null

  return (
    <div className="quiz-layout">
      <div className="quiz-main">
        <div className="quiz-top">
          <button type="button" className="icon-btn btn-back" onClick={onBack} aria-label={t.back}>
            <IconArrowLeft />
          </button>
          <div className="quiz-top-text">
            <span className="quiz-topic">{session.category.name}</span>
            <span className="quiz-counter">{t.questionOf(session.index + 1, total)}</span>
          </div>
          {isTest && (
            <span className="timer quiz-top-mobile-timer">
              <IconClock />
              <span className="num">{formatClock(elapsed)}</span>
            </span>
          )}
          <button
            type="button"
            className="icon-btn btn-restart"
            onClick={onRestart}
            aria-label={t.restart}
          >
            <IconRestart />
          </button>
        </div>

        <div className="mobile-progress">
          <div
            className="bar bar--thin"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <section className="qcard" key={current.id}>
          <p className={`qtext${lang === 'ur' && current.question_ur ? ' urdu' : ''}`}>{questionText}</p>
        </section>

        <div className="options" key={`${current.id}-options`}>
          {options.map((option, index) => {
            let state: 'idle' | 'selected' | 'correct' | 'wrong' | 'muted' = 'idle'
            if (isTest) {
              if (session.selected === option) state = 'selected'
            } else if (session.selected) {
              if (option === current.correct_text) state = 'correct'
              else if (option === session.selected) state = 'wrong'
              else state = 'muted'
            }
            return (
              <button
                key={`${option}-${index}`}
                type="button"
                className="option"
                data-state={state}
                style={{ '--i': index } as CSSProperties}
                disabled={!isTest && session.locked}
                aria-pressed={session.selected === option}
                onClick={() => onAnswer(option)}
              >
                <span className="option-key">{String.fromCharCode(65 + index)}</span>
                <span className="option-text">{option}</span>
                <span className="option-mark" aria-hidden="true">
                  {state === 'correct' && <IconCheck />}
                  {state === 'wrong' && <IconClose />}
                </span>
              </button>
            )
          })}
        </div>

        {!isTest && feedbackKind && (
          <div className="feedback" data-kind={feedbackKind} role="status" aria-live="polite">
            {feedbackKind === 'correct' ? <IconCheck /> : <IconClose />}
            <span className="feedback-body">
              <strong>{feedbackKind === 'correct' ? t.correct : t.incorrect}</strong>
              {feedbackKind === 'wrong' && (
                <span className="feedback-detail">
                  {t.correctAnswer}: {current.correct_text}
                </span>
              )}
            </span>
          </div>
        )}

        <div className="action-bar">
          <button
            type="button"
            className="btn btn-dark btn-lg btn-next"
            onClick={onNext}
            disabled={!session.selected}
          >
            {atEnd ? t.seeResults : t.next}
          </button>
        </div>
      </div>

      <aside className="rail" aria-label={t.questionsRail}>
        <div className="rail-block">
          <div className="rail-row">
            <span className="rail-label">{t.progressLabel}</span>
            <span className="rail-value">
              <span className="num">{progress}%</span> {t.doneSuffix}
            </span>
          </div>
          <div className="bar bar--thin">
            <span style={{ width: `${progress}%` }} />
          </div>
          {isTest && (
            <div className="rail-row" style={{ marginTop: 14, marginBottom: 0 }}>
              <span className="rail-label">{t.timeLabel}</span>
              <span className="rail-value timer-value num">{formatClock(elapsed)}</span>
            </div>
          )}
        </div>

        <div className="rail-block">
          <div className="rail-row">
            <span className="rail-label">{t.questionsRail}</span>
            <span className="rail-value num">
              {session.index + 1} / {total}
            </span>
          </div>
          <div className="qgrid">
            {session.questions.map((question, index) => {
              const state = answeredIds.has(question.id)
                ? 'answered'
                : index === session.index
                  ? 'current'
                  : 'unseen'
              return (
                <span className="qgrid-cell" key={question.id} data-state={state} aria-hidden="true">
                  {index + 1}
                </span>
              )
            })}
          </div>
        </div>
      </aside>
    </div>
  )
}
