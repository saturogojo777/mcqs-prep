'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Quiz from '@/components/Quiz'
import Result from '@/components/Result'
import { Num, T } from '@/components/text'
import { useLang } from '@/components/i18n'
import { IconBack } from '@/components/icons'
import { loadDailyQuestions, loadQuestions, loadQuestionsByIds } from '@/lib/catalog'
import { copyFor } from '@/lib/copy'
import { getMistakeIds, saveAnswers, saveLastResult } from '@/lib/progress'
import { sizeChoices, shuffle, sessionOf } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import type { Answer, PreparedQuestion, Session } from '@/lib/types'

type Mode = 'exam' | 'subject' | 'book' | 'today' | 'mistakes'

type Props = {
  mode: Mode
  title: string
  titleUr: string
  itemKey: string
  available: number
  autoStart?: boolean
}

type Phase = 'start' | 'quiz' | 'result'

const TODAY_SIZE = 10

export default function PracticeFlow({ mode, title, titleUr, itemKey, available, autoStart = false }: Props) {
  const lang = useLang()
  const t = copyFor(lang)
  const router = useRouter()

  const choices = useMemo(() => sizeChoices(available), [available])
  const [size, setSize] = useState(() => Math.min(10, available))
  const [custom, setCustom] = useState('')
  const [timerOn, setTimerOn] = useState(false)
  const [phase, setPhase] = useState<Phase>(autoStart ? 'quiz' : 'start')
  const [session, setSession] = useState<Session | null>(null)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mistakeCount, setMistakeCount] = useState(0)
  const [lastSetup, setLastSetup] = useState<{ size: number; timerOn: boolean } | null>(null)

  const chosenSize = custom.trim() ? Math.min(available, Math.max(1, Number(custom) || 0)) : size

  const begin = useCallback(
    async (questions: PreparedQuestion[], nextMode: Session['mode'], nextTitle: string, nextTitleUr: string, timer: boolean) => {
      setSession(sessionOf(nextMode, nextTitle, nextTitleUr, questions, timer))
      setIndex(0)
      setSelected(null)
      setAnswers([])
      setElapsed(0)
      setPhase('quiz')
    },
    [],
  )

  const startItem = useCallback(
    async (count: number, timer: boolean) => {
      const client = getSupabase()
      setError(null)
      setBusy(true)
      try {
        if (!client) throw new Error('offline')
        const questions = await loadQuestions(client, mode, itemKey, count, shuffle)
        if (questions.length === 0) {
          setError(t.noQuestions)
          return
        }
        setLastSetup({ size: count, timerOn: timer })
        await begin(questions, mode, title, titleUr, timer)
      } catch {
        setError(t.loadError)
      } finally {
        setBusy(false)
      }
    },
    [begin, itemKey, mode, t.loadError, t.noQuestions, title, titleUr],
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
      await begin(questions, 'today', t.todayTitle, t.todayTitle, false)
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
      await begin(questions, 'mistakes', t.mistakesTitle, t.mistakesTitle, false)
    } catch {
      setError(t.loadError)
    } finally {
      setBusy(false)
    }
  }, [begin, t.loadError, t.noQuestions, t.mistakesTitle])

  // "Today's Test" and "Practice my mistakes" open straight into the questions.
  useEffect(() => {
    if (!autoStart) return
    if (mode === 'mistakes') void startMistakes()
    else void startToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = useCallback(
    (finalAnswers: Answer[]) => {
      const taken = session ? Math.round((Date.now() - session.startedAt) / 1000) : 0
      setElapsed(taken)
      saveAnswers(finalAnswers)
      const right = finalAnswers.filter((answer) => answer.right).length
      saveLastResult({ right, total: finalAnswers.length, at: Date.now(), title })
      setMistakeCount(getMistakeIds().length)
      setPhase('result')
    },
    [session, title],
  )

  const select = (option: string) => {
    if (!session || selected !== null) return
    const question = session.questions[index]
    setSelected(option)
    setAnswers((prev) => [
      ...prev,
      { questionId: question.id, chosen: option, correct: question.correct, right: option === question.correct },
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
      return
    }
    router.push('/')
  }

  const tryAgain = () => {
    if (mode === 'today') {
      void startToday()
      return
    }
    setPhase('start')
    setSession(null)
    setLastSetup(null)
  }

  // ---------------------------------------------------------------- render

  if (phase === 'quiz') {
    if (!session) {
      return (
        <div className="container page">
          <p className="empty">{busy ? t.loading : error ?? t.noQuestions}</p>
          <Link href={mode === 'today' || mode === 'mistakes' ? '/' : '/exams'} className="back-link">
            <IconBack size={16} /> {t.back}
          </Link>
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
    return (
      <div className="container page">
        <Result
          questions={session.questions}
          answers={answers}
          elapsed={elapsed}
          lang={lang}
          mistakeCount={mistakeCount}
          onTryAgain={tryAgain}
          onMistakes={() => void startMistakes()}
          onHome={() => router.push('/')}
        />
      </div>
    )
  }

  // start screen
  return (
    <div className="container page">
      <Link href={mode === 'today' || mode === 'mistakes' ? '/' : `/${mode === 'exam' ? 'exams' : mode === 'subject' ? 'subjects' : 'books'}`} className="back-link">
        <IconBack size={16} /> {t.back}
      </Link>

      <header className="page-head">
        <h1 className="page-title">
          {titleUr && titleUr !== title ? <T en={title} ur={titleUr} /> : title}
        </h1>
        <p className="page-sub">
          <T
            en={`${available} questions available`}
            ur={`${available} سوالات دستیاب ہیں`}
          />
        </p>
      </header>

      <section className="card start-card">
        <h2 className="card-title">{t.howMany}</h2>
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

        {error && <p className="form-error">{error}</p>}

        <button
          type="button"
          className="btn btn-dark btn-lg btn-start"
          disabled={busy || chosenSize < 1}
          onClick={() => void startItem(chosenSize, timerOn)}
        >
          {busy ? t.loading : t.start}
        </button>

        {lastSetup && (
          <p className="start-hint">
            <T en="Last time:" ur="پچھلی بار:" /> <Num>{lastSetup.size}</Num>
          </p>
        )}
      </section>
    </div>
  )
}
