'use client'

import { useEffect, useState } from 'react'
import { IconBack, IconCheck, IconClock, IconClose } from '@/components/icons'
import { Num, T } from '@/components/text'
import { copyFor } from '@/lib/copy'
import { formatClock, questionText } from '@/lib/session'
import type { Lang, PreparedQuestion } from '@/lib/types'

type Props = {
  question: PreparedQuestion
  index: number
  total: number
  selected: string | null
  lang: Lang
  timerOn: boolean
  startedAt: number
  onSelect: (option: string) => void
  onNext: () => void
  onExit: () => void
}

export default function Quiz({
  question,
  index,
  total,
  selected,
  lang,
  timerOn,
  startedAt,
  onSelect,
  onNext,
  onExit,
}: Props) {
  const t = copyFor(lang)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!timerOn) return
    const update = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [timerOn, startedAt])

  const urdu = lang === 'ur' && Boolean(question.question_ur)
  const text = questionText(question, lang)
  const isCorrect = selected !== null && selected === question.correct
  const answered = selected !== null
  const last = index + 1 >= total
  const progress = Math.round(((index + (answered ? 1 : 0)) / total) * 100)

  return (
    <div className="quiz">
      <div className="quiz-top">
        <button type="button" className="icon-btn" onClick={onExit} aria-label={t.exit}>
          <IconBack size={18} />
        </button>
        <span className="quiz-counter">
          <T en={`Question ${index + 1} of ${total}`} ur={`سوال ${index + 1} از ${total}`} />
        </span>
        {timerOn && (
          <span className="quiz-timer">
            <IconClock size={14} />
            <Num>{formatClock(elapsed)}</Num>
          </span>
        )}
      </div>

      <div className="bar bar--thin" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <section className="qcard" key={question.id}>
        <p className={urdu ? 'qtext qtext--ur' : 'qtext'} dir={urdu ? 'rtl' : 'ltr'}>
          {text}
        </p>
      </section>

      <div className="options" key={`${question.id}-options`}>
        {question.displayOptions.map((option, i) => {
          let state: 'idle' | 'correct' | 'wrong' | 'muted' | 'selected' = 'idle'
          if (answered) {
            if (option === question.correct) state = 'correct'
            else if (option === selected) state = 'wrong'
            else state = 'muted'
          }
          return (
            <button
              key={`${option}-${i}`}
              type="button"
              className="option"
              data-state={state}
              style={{ '--i': i } as React.CSSProperties}
              disabled={answered}
              aria-pressed={selected === option}
              onClick={() => onSelect(option)}
            >
              <span className="option-text" dir="auto">
                {option}
              </span>
              <span className="option-mark" aria-hidden="true">
                {state === 'correct' && <IconCheck size={18} />}
                {state === 'wrong' && <IconClose size={18} />}
              </span>
            </button>
          )
        })}
      </div>

      {answered && (
        <div className="feedback" data-kind={isCorrect ? 'correct' : 'wrong'} role="status" aria-live="polite">
          {isCorrect ? <IconCheck size={16} /> : <IconClose size={16} />}
          <span className="feedback-body">
            <strong>{isCorrect ? t.correct : t.wrong}</strong>
            {!isCorrect && (
              <span className="feedback-detail">
                {t.correctAnswer}: <b dir="auto">{question.correct}</b>
                {question.explanation ? <em className="feedback-note">{question.explanation}</em> : null}
              </span>
            )}
          </span>
        </div>
      )}

      <div className="action-bar">
        <button type="button" className="btn btn-dark btn-lg btn-next" onClick={onNext} disabled={!answered}>
          {last ? t.seeResult : t.next}
        </button>
      </div>
    </div>
  )
}
