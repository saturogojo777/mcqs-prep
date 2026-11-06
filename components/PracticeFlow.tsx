'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Quiz from '@/components/Quiz'
import MockTest from '@/components/MockTest'
import Result from '@/components/Result'
import StartScreen, { type StartChoices } from '@/components/StartScreen'
import { useLang } from '@/components/i18n'
import { IconBack } from '@/components/icons'
import { loadDailyQuestions, loadQuestions, loadQuestionsByIds } from '@/lib/catalog'
import { copyFor } from '@/lib/copy'
import { getMistakeIds, recordTest, saveAnswers, saveLastResult } from '@/lib/progress'
import {
  excludeIdsForSend,
  getTodayDone,
  markSeenMany,
  readSeen,
  recordSeenResult,
  saveTodayDone,
  type TodayDone,
} from '@/lib/seen'
import { genericPattern, mockScore, sessionOf, shuffle } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import type { Answer, MockPattern, PreparedQuestion, Session } from '@/lib/types'

type Mode = 'exam' | 'subject' | 'book' | 'today' | 'mistakes'

type Props = {
  mode: Mode
  title: string
  titleUr: string
  itemKey: string
  available: number
  autoStart?: boolean
  pattern?: MockPattern | null
  libraryTotal?: number
}

type Phase = 'start' | 'quiz' | 'result'

const TODAY_SIZE = 10

export default function PracticeFlow({
  mode,
  title,
  titleUr,
  itemKey,
  available,
  autoStart = false,
  pattern = null,
  libraryTotal,
}: Props) {
  const lang = useLang()
  const t = copyFor(lang)
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>(autoStart ? 'quiz' : 'start')
  const [session, setSession] = useState<Session | null>(null)
  const [mockPattern, setMockPattern] = useState<MockPattern | null>(null)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mistakeCount, setMistakeCount] = useState(0)
  const [todayDone, setTodayDone] = useState<TodayDone | null>(null)

  const begin = useCallback(
    (
      questions: PreparedQuestion[],
      nextMode: Session['mode'],
      nextTitle: string,
      nextTitleUr: string,
      timer: boolean,
      mock: MockPattern | null,
    ) => {
      markSeenMany(questions.map((question) => question.id))
      setSession(sessionOf(nextMode, nextTitle, nextTitleUr, questions, timer))
      setMockPattern(mock)
      setIndex(0)
      setSelected(null)
      setAnswers([])
      setElapsed(0)
      setPhase('quiz')
    },
    [],
  )

  const startItem = useCallback(
    async (choices: StartChoices) => {
      const client = getSupabase()
      setError(null)
      setBusy(true)
      try {
        if (!client) throw new Error('offline')
        const exclude = choices.onlyNew ? [] : excludeIdsForSend(readSeen())
        const questions = await loadQuestions(
          client,
          mode,
          itemKey,
          choices.size,
          shuffle,
          choices.difficulty,
          choices.level,
          exclude,
        )
        if (questions.length === 0) {
          const filtered = choices.difficulty !== 'mixed' || choices.level !== 'mixed'
          setError(filtered ? t.noFiltered : t.noQuestions)
          return
        }
        if (choices.onlyNew && questions.length < choices.size) {
          // The start screen normally gates this; this is the race-safe backstop.
          setError(t.shortfallNote(String(questions.length), String(choices.size)))
          return
        }
        const mock =
          choices.quizMode === 'mock'
            ? {
                ...(pattern ?? genericPattern(questions.length)),
                questionCount: questions.length,
                minutes: choices.minutes,
              }
            : null
        if (mock) setElapsed(0)
        begin(questions, mode, title, titleUr, choices.quizMode === 'mock' ? true : choices.timerOn, mock)
      } catch {
        setError(t.loadError)
      } finally {
        setBusy(false)
      }
    },
    [begin, itemKey, mode, pattern, t.loadError, t.noQuestions, title, titleUr],
  )

  const startToday = useCallback(async () => {
    const client = getSupabase()
    setError(null)
    setBusy(true)
    try {
      if (!client) throw new Error('offline')
      const questions = await loadDailyQuestions(client, itemKey, TODAY_SIZE, shuffle)
      if (questions.length === 0) {
        setError(t.noQuestions)
        return
      }
      begin(questions, 'today', t.todayTitle, t.todayTitle, false, null)
    } catch {
      setError(t.loadError)
    } finally {
      setBusy(false)
    }
  }, [begin, itemKey, t.loadError, t.noQuestions, t.todayTitle])

  const startMistakes = useCallback(async () => {
    const client = getSupabase()
    setError(null)
    setBusy(true)
    try {
      if (!client) throw new Error('offline')
      const questions = await loadQuestionsByIds(client, getMistakeIds().slice(-50), shuffle)
      if (questions.length === 0) {
        setError(t.noQuestions)
        return
      }
      begin(questions, 'mistakes', t.mistakesTitle, t.mistakesTitle, false, null)
    } catch {
      setError(t.loadError)
    } finally {
      setBusy(false)
    }
  }, [begin, t.loadError, t.noQuestions, t.mistakesTitle])

  // "Today's Test" and "Practice my mistakes" open straight into the questions.
  // Today's Test is the same for everyone and finishes once per day; after
  // that the Done card (with the score) replaces the questions until tomorrow.
  useEffect(() => {
    if (!autoStart) return
    if (mode === 'mistakes') {
      void startMistakes()
      return
    }
    const done = mode === 'today' ? getTodayDone(itemKey) : null
    if (done) {
      // autoStart opens on the quiz phase; the Done card lives on 'start'.
      setTodayDone(done)
      setPhase('start')
      return
    }
    void startToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = useCallback(
    (finalAnswers: Answer[], seconds?: number) => {
      const taken = seconds ?? (session ? Math.round((Date.now() - session.startedAt) / 1000) : 0)
      setAnswers(finalAnswers)
      setElapsed(taken)
      saveAnswers(finalAnswers)
      recordTest(finalAnswers)
      const right = finalAnswers.filter((answer) => answer.right).length
      saveLastResult({ right, total: finalAnswers.length, at: Date.now(), title })
      if (mode === 'today') {
        saveTodayDone(itemKey, right, finalAnswers.length)
        setTodayDone({ seed: itemKey, right, total: finalAnswers.length, at: Date.now() })
      }
      setMistakeCount(getMistakeIds().length)
      setPhase('result')
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch {
        // jsdom and some embedded browsers do not implement scrolling
      }
    },
    [itemKey, mode, session, title],
  )

  const select = (option: string) => {
    if (!session || selected !== null) return
    const question = session.questions[index]
    recordSeenResult(question.id, option === question.correct)
    setSelected(option)
    setAnswers((prev) => [
      ...prev,
      {
        questionId: question.id,
        chosen: option,
        correct: question.correct,
        right: option === question.correct,
        chapter: question.chapter ?? null,
        subject: question.subject_slug ?? null,
      },
    ])
  }

  const next = () => {
    if (!session) return
    if (index + 1 >= session.questions.length) {
      finish(answers)
      return
    }
    setIndex((value) => value + 1)
    setSelected(null)
  }

  const exit = () => {
    if (mode === 'exam' || mode === 'subject' || mode === 'book') {
      setPhase('start')
      setSession(null)
      setMockPattern(null)
      return
    }
    router.push('/')
  }

  const tryAgain = () => {
    if (mode === 'today') {
      setTodayDone(getTodayDone(itemKey))
      setPhase('start')
      setSession(null)
      setMockPattern(null)
      return
    }
    setPhase('start')
    setSession(null)
    setMockPattern(null)
  }

  // ---------------------------------------------------------------- render

  if (phase === 'quiz') {
    if (!session) {
      return (
        <div className="container page">
          <p className="empty">{busy ? t.loadingQuestions : error ?? t.noQuestions}</p>
          <Link href={mode === 'today' || mode === 'mistakes' ? '/' : '/exams'} className="back-link">
            <IconBack size={16} /> {t.back}
          </Link>
        </div>
      )
    }

    if (mockPattern && session.questions.length > 0) {
      return (
        <div className="container page page--quiz">
          <MockTest
            questions={session.questions}
            pattern={mockPattern}
            minutes={mockPattern.minutes}
            lang={lang}
            startedAt={session.startedAt}
            onFinish={(finalAnswers, seconds) => finish(finalAnswers, seconds)}
            onExit={exit}
          />
        </div>
      )
    }

    return (
      <div className="container page page--quiz">
        <Quiz
          question={session.questions[index]}
          index={index}
          total={session.questions.length}
          selected={selected}
          lang={lang}
          timerOn={session.timerOn}
          startedAt={session.startedAt}
          onSelect={select}
          onNext={next}
          onExit={exit}
        />
      </div>
    )
  }

  if (phase === 'result' && session) {
    const summary =
      mockPattern && session.questions.length > 0
        ? {
            ...mockScore(answers, {
              marksPerQuestion: mockPattern.marksPerQuestion,
              negativeMarking: mockPattern.negativeMarking,
              total: session.questions.length,
              passingPercentage: mockPattern.passingPercentage,
            }),
            pattern: mockPattern,
          }
        : null

    return (
      <div className="container page">
        <Result
          questions={session.questions}
          answers={answers}
          elapsed={elapsed}
          lang={lang}
          mistakeCount={mistakeCount}
          mock={summary}
          footNote={session.mode === 'mistakes' ? t.repeatNote : null}
          onTryAgain={tryAgain}
          onMistakes={() => void startMistakes()}
          onHome={() => router.push('/')}
        />
      </div>
    )
  }

  if (mode === 'today' && todayDone) {
    return (
      <div className="container page">
        <div className="empty-state">
          <p className="empty-title">{t.todayDoneTitle}</p>
          <p className="empty-body">{t.todayDoneBody(String(todayDone.right), String(todayDone.total))}</p>
          <div className="result-actions result-actions--left">
            <button type="button" className="btn btn-dark" onClick={() => router.push('/')}>
              {t.home}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => void startMistakes()}>
              {t.practiceMistakes}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'today' || mode === 'mistakes') {
    return (
      <div className="container page">
        <p className="empty">{busy ? t.loadingQuestions : error ?? t.noQuestions}</p>
        <button type="button" className="btn btn-outline" onClick={() => (mode === 'mistakes' ? void startMistakes() : void startToday())}>
          {t.tryAgain}
        </button>
      </div>
    )
  }

  return (
    <StartScreen
      title={title}
      titleUr={titleUr}
      available={available}
      backHref={`/${mode === 'exam' ? 'exams' : mode === 'subject' ? 'subjects' : 'books'}`}
      kind={mode}
      itemKey={itemKey}
      pattern={pattern}
      busy={busy}
      error={error}
      libraryTotal={libraryTotal}
      onStart={(choices) => void startItem(choices)}
    />
  )
}
