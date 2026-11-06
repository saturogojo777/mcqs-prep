'use client'

import { useCallback, useEffect, useState } from 'react'
import { IconBack, IconCheck, IconClock, IconFlag, IconGrid } from '@/components/icons'
import { Num, T } from '@/components/text'
import { copyFor } from '@/lib/copy'
import { recordSeenResult } from '@/lib/seen'
import { formatClock, questionText } from '@/lib/session'
import ReportButton from '@/components/ReportButton'
import type { Answer, Lang, MockPattern, PreparedQuestion } from '@/lib/types'

type Props = {
  questions: PreparedQuestion[]
  pattern: MockPattern
  minutes: number
  lang: Lang
  startedAt: number
  onFinish: (answers: Answer[], elapsed: number) => void
  onExit: () => void
}

type PaletteState = 'answered' | 'marked' | 'blank' | 'current'

export default function MockTest({ questions, pattern, minutes, lang, startedAt, onFinish, onExit }: Props) {
  const t = copyFor(lang)
  const total = questions.length
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, minutes * 60 - Math.floor((Date.now() - startedAt) / 1000)))
  const [confirm, setConfirm] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const question = questions[index]
  const answeredCount = Object.keys(answers).length

  const submit = useCallback(
    (auto = false) => {
      const list: Answer[] = questions
        .map((item): Answer | null => {
          const chosen = answers[item.id]
          if (!chosen) return null
          return {
            questionId: item.id,
            chosen,
            correct: item.correct,
            right: chosen === item.correct,
            chapter: item.chapter ?? null,
            subject: item.subject_slug ?? null,
          }
        })
        .filter((entry): entry is Answer => entry !== null)
      const elapsed = Math.round((Date.now() - startedAt) / 1000)
      onFinish(list, auto ? minutes * 60 : elapsed)
    },
    [answers, minutes, onFinish, questions, startedAt],
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      const left = Math.max(0, minutes * 60 - Math.floor((Date.now() - startedAt) / 1000))
      setTimeLeft(left)
      if (left === 0) {
        window.clearInterval(timer)
        submit(true)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [minutes, startedAt, submit])

  const jump = useCallback(
    (nextIndex: number) => {
      setIndex(Math.max(0, Math.min(total - 1, nextIndex)))
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch {
        // jsdom and some embedded browsers do not implement scrolling
      }
    },
    [total],
  )

  const stateOf = (id: string, i: number): PaletteState => {
    if (i === index) return 'current'
    if (marked.has(id)) return 'marked'
    if (answers[id]) return 'answered'
    return 'blank'
  }

  const palette = (
    <div className="palette-grid" role="group" aria-label={t.paletteTitle}>
      {questions.map((item, i) => {
        const state = stateOf(item.id, i)
        return (
          <button
            key={item.id}
            type="button"
            className="palette-btn"
            data-state={state}
            aria-current={state === 'current' ? 'true' : undefined}
            aria-label={`${t.questionOf(String(i + 1), String(total))} · ${state}`}
            onClick={() => {
              jump(i)
              setPaletteOpen(false)
            }}
          >
            <Num>{i + 1}</Num>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="mock">
      <div className="quiz-top">
        <button type="button" className="icon-btn" onClick={onExit} aria-label={t.exit}>
          <IconBack size={18} />
        </button>
        <span className="quiz-counter">
          {t.questionOf(String(index + 1), String(total))}
        </span>
        <span className="quiz-timer mock-timer" data-low={timeLeft <= 60}>
          <IconClock size={14} />
          <Num>{formatClock(timeLeft)}</Num>
        </span>
      </div>

      <div className="mock-body">
        <div className="mock-main">
          <section className="qcard" key={question.id}>
            <p
              className={lang === 'ur' && question.question_ur ? 'qtext qtext--ur' : 'qtext'}
              dir={lang === 'ur' && question.question_ur ? 'rtl' : 'ltr'}
            >
              {questionText(question, lang)}
            </p>
          </section>

          <div className="options" key={`${question.id}-options`}>
            {question.displayOptions.map((option, i) => {
              const chosen = answers[question.id] === option
              return (
                <button
                  key={`${option}-${i}`}
                  type="button"
                  className="option"
                  data-state={chosen ? 'selected' : 'idle'}
                  style={{ '--i': i } as React.CSSProperties}
                  aria-pressed={chosen}
                  onClick={() => {
                    // Shown questions are already marked seen when the test
                    // starts; here only the right/wrong signal is recorded.
                    if (answers[question.id] !== option) {
                      recordSeenResult(question.id, option === question.correct)
                    }
                    setAnswers((current) => {
                      const next = { ...current }
                      if (next[question.id] === option) delete next[question.id]
                      else next[question.id] = option
                      return next
                    })
                  }}
                >
                  <span className="option-text" dir="auto">
                    {option}
                  </span>
                  <span className="option-mark" aria-hidden="true">
                    {chosen && <IconCheck size={18} />}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mock-actions">
            <button type="button" className="btn btn-ghost" onClick={() => jump(index - 1)} disabled={index === 0}>
              {t.back}
            </button>
            <button
              type="button"
              className="btn btn-outline mock-mark"
              data-on={marked.has(question.id)}
              onClick={() =>
                setMarked((current) => {
                  const next = new Set(current)
                  if (next.has(question.id)) next.delete(question.id)
                  else next.add(question.id)
                  return next
                })
              }
            >
              <IconFlag size={14} />
              {marked.has(question.id) ? t.unmark : t.markForReview}
            </button>
            {index + 1 < total ? (
              <button type="button" className="btn btn-dark btn-next" onClick={() => jump(index + 1)}>
                {t.next}
              </button>
            ) : (
              <button type="button" className="btn btn-dark btn-next" onClick={() => setConfirm(true)}>
                {t.submit}
              </button>
            )}
          </div>

          <div className="q-foot">
            <ReportButton mcqId={question.id} />
          </div>
        </div>

        <aside className="mock-side" data-open={paletteOpen}>
          <button type="button" className="palette-toggle" onClick={() => setPaletteOpen((value) => !value)}>
            <IconGrid size={16} /> {t.paletteTitle}
            <span className="palette-count num">
              {answeredCount}/{total}
            </span>
          </button>
          <div className="palette-wrap">{palette}</div>
          <dl className="palette-legend">
            <div>
              <dt>
                <span className="dot" data-kind="answered" /> {t.answeredCount}
              </dt>
              <dd className="num">{answeredCount}</dd>
            </div>
            <div>
              <dt>
                <span className="dot" data-kind="marked" /> {t.markedCount}
              </dt>
              <dd className="num">{marked.size}</dd>
            </div>
            <div>
              <dt>
                <span className="dot" data-kind="blank" /> {t.unansweredCount}
              </dt>
              <dd className="num">{total - answeredCount}</dd>
            </div>
          </dl>
          <button type="button" className="btn btn-dark btn-submit" onClick={() => setConfirm(true)}>
            {t.submit}
          </button>
          <p className="palette-note">
            <T
              en={`${pattern.marksPerQuestion} mark(s) each · −${pattern.negativeMarking} for a wrong answer · pass ${pattern.passingPercentage}%`}
              ur={`ہر سوال ${pattern.marksPerQuestion} نمبر · غلط پر −${pattern.negativeMarking} · پاس ${pattern.passingPercentage}%`}
            />
          </p>
        </aside>
      </div>

      {confirm && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setConfirm(false)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="dialog-title" id="submit-title">
              {t.submitTitle}
            </h2>
            <p className="dialog-body">
              {t.submitBody} · {t.answeredCount}: <Num>{answeredCount}</Num> · {t.unansweredCount}:{' '}
              <Num>{total - answeredCount}</Num>
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-dark btn-submit-yes" onClick={() => submit(false)}>
                {t.submitYes}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
