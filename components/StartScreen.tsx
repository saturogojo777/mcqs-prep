'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { IconBack, IconClock } from '@/components/icons'
import { Num, T } from '@/components/text'
import { useLang } from '@/components/i18n'
import { copyFor } from '@/lib/copy'
import {
  DIFFICULTY_CHOICES,
  LEVEL_CHOICES,
  genericPattern,
  sizeChoices,
} from '@/lib/session'
import type { DifficultyChoice, LevelChoice, MockPattern, QuizMode } from '@/lib/types'

export type StartChoices = {
  size: number
  difficulty: DifficultyChoice
  level: LevelChoice
  quizMode: QuizMode
  timerOn: boolean
  minutes: number
}

type Props = {
  title: string
  titleUr: string
  available: number
  backHref: string
  pattern?: MockPattern | null
  busy: boolean
  error: string | null
  onStart: (choices: StartChoices) => void
}

const DIFFICULTY_LABEL: Record<DifficultyChoice, { en: string; ur: string }> = {
  mixed: { en: 'Mixed', ur: 'ملا جلا' },
  easy: { en: 'Easy', ur: 'آسان' },
  medium: { en: 'Medium', ur: 'درمیانہ' },
  hard: { en: 'Hard', ur: 'مشکل' },
}

const LEVEL_LABEL: Record<LevelChoice, { en: string; ur: string }> = {
  mixed: { en: 'Mixed', ur: 'ملا جلا' },
  basic: { en: 'Basic', ur: 'بنیادی' },
  intermediate: { en: 'Intermediate', ur: 'درمیانی' },
  advanced: { en: 'Advanced', ur: 'اعلیٰ' },
}

export default function StartScreen({
  title,
  titleUr,
  available,
  backHref,
  pattern,
  busy,
  error,
  onStart,
}: Props) {
  const lang = useLang()
  const t = copyFor(lang)
  const choices = useMemo(() => sizeChoices(available), [available])
  const [size, setSize] = useState(() => Math.min(10, available))
  const [custom, setCustom] = useState('')
  const [difficulty, setDifficulty] = useState<DifficultyChoice>('mixed')
  const [level, setLevel] = useState<LevelChoice>('mixed')
  const [quizMode, setQuizMode] = useState<QuizMode>('practice')
  const [timerOn, setTimerOn] = useState(false)

  const chosenSize = custom.trim() ? Math.min(available, Math.max(1, Number(custom) || 0)) : size
  const mockPattern = quizMode === 'mock' ? pattern ?? genericPattern(chosenSize) : null
  const minutes =
    quizMode === 'mock' && mockPattern
      ? mockPattern.examSlug && chosenSize !== mockPattern.questionCount
        ? Math.max(5, Math.round((chosenSize * mockPattern.minutes) / Math.max(1, mockPattern.questionCount)))
        : mockPattern.minutes
      : 0

  return (
    <div className="container page">
      <Link href={backHref} className="back-link">
        <IconBack size={16} /> {t.backToList}
      </Link>

      <header className="page-head">
        <h1 className="page-title">{titleUr && titleUr !== title ? <T en={title} ur={titleUr} /> : title}</h1>
        <p className="page-sub">
          <T en={`${available} questions available`} ur={`${available} سوالات دستیاب ہیں`} /> ·{' '}
          <T en="free, no sign-up" ur="مفت، بغیر اکاؤنٹ" />
        </p>
      </header>

      <div className="start-grid">
        <section className="card start-card">
          <h2 className="card-title">{t.mode}</h2>
          <div className="seg" role="group" aria-label={t.mode}>
            {(['practice', 'mock'] as QuizMode[]).map((value) => (
              <button
                key={value}
                type="button"
                className="seg-btn"
                data-on={quizMode === value}
                aria-pressed={quizMode === value}
                onClick={() => setQuizMode(value)}
              >
                {value === 'practice' ? t.practice : t.mockTest}
              </button>
            ))}
          </div>
          <p className="row-hint">{t.modeHint}</p>

          <h2 className="card-title card-title--gap">{t.howMany}</h2>
          <div className="chips">
            {choices.map((choice) => (
              <button
                key={choice}
                type="button"
                className="chip"
                data-on={!custom.trim() && size === choice}
                onClick={() => {
                  setSize(choice)
                  setCustom('')
                }}
              >
                <Num>{choice}</Num>
              </button>
            ))}
            <input
              className="chip-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t.custom}
              aria-label={t.custom}
              value={custom}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^0-9]/g, '').slice(0, 3)
                setCustom(raw)
              }}
            />
          </div>
          <p className="row-hint">
            <T en={t.ofAvailable(String(available))} ur={t.ofAvailable(String(available))} />
          </p>

          <h2 className="card-title card-title--gap">{t.difficulty}</h2>
          <div className="seg seg--wrap" role="group" aria-label={t.difficulty}>
            {DIFFICULTY_CHOICES.map((value) => (
              <button
                key={value}
                type="button"
                className="seg-btn seg-btn--sm"
                data-on={difficulty === value}
                aria-pressed={difficulty === value}
                onClick={() => setDifficulty(value)}
              >
                {lang === 'ur' ? DIFFICULTY_LABEL[value].ur : DIFFICULTY_LABEL[value].en}
              </button>
            ))}
          </div>

          <h2 className="card-title card-title--gap">{t.level}</h2>
          <div className="seg seg--wrap" role="group" aria-label={t.level}>
            {LEVEL_CHOICES.map((value) => (
              <button
                key={value}
                type="button"
                className="seg-btn seg-btn--sm"
                data-on={level === value}
                aria-pressed={level === value}
                onClick={() => setLevel(value)}
              >
                {lang === 'ur' ? LEVEL_LABEL[value].ur : LEVEL_LABEL[value].en}
              </button>
            ))}
          </div>

          {quizMode === 'practice' ? (
            <div className="timer-row">
              <div className="timer-text">
                <span className="row-title">{t.timer}</span>
                <span className="row-hint">{t.timerHint}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={timerOn}
                aria-label={t.timer}
                className="switch"
                data-on={timerOn}
                onClick={() => setTimerOn((value) => !value)}
              >
                <span className="switch-knob" />
              </button>
            </div>
          ) : (
            <div className="pattern">
              <p className="pattern-title">
                <IconClock size={15} /> {t.mockPatternTitle}
              </p>
              <dl className="pattern-list">
                <div>
                  <dt>{t.howMany.replace('?', '')}</dt>
                  <dd className="num">{chosenSize}</dd>
                </div>
                <div>
                  <dt>{t.minutes}</dt>
                  <dd className="num">{minutes}</dd>
                </div>
                <div>
                  <dt>{t.marksPerQuestion}</dt>
                  <dd className="num">{mockPattern?.marksPerQuestion ?? 1}</dd>
                </div>
                <div>
                  <dt>{t.negativeMarking}</dt>
                  <dd className="num">{mockPattern?.negativeMarking ?? 0}</dd>
                </div>
                <div>
                  <dt>{t.passing}</dt>
                  <dd className="num">{mockPattern?.passingPercentage ?? 50}%</dd>
                </div>
              </dl>
              <p className="pattern-note">{t.mockPatternNote}</p>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button
            type="button"
            className="btn btn-dark btn-lg btn-start"
            disabled={busy || chosenSize < 1}
            onClick={() =>
              onStart({
                size: chosenSize,
                difficulty,
                level,
                quizMode,
                timerOn: quizMode === 'mock' ? true : timerOn,
                minutes: quizMode === 'mock' ? minutes : 0,
              })
            }
          >
            {busy ? t.loadingQuestions : quizMode === 'mock' ? t.mockTest : t.start}
          </button>
          <p className="start-hint">{t.attemptsLeft}</p>
        </section>
      </div>
    </div>
  )
}
