'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase, type CatalogRow } from '@/lib/supabase'
import { shapeCatalog, type Category, type Mcq } from '@/lib/catalog'
import {
  getAllProgress,
  getLang,
  getProgress,
  resetProgress,
  saveProgress,
  setLang,
  type CategoryProgress,
  type Lang,
} from '@/lib/progress'
import { copyFor } from '@/lib/copy'
import type { AnswerRecord, Mode, Session } from '@/lib/session'
import { TEST_SIZE, shuffle } from '@/lib/session'
import { IconLogo } from '@/components/icons'
import Home from '@/components/Home'
import Quiz from '@/components/Quiz'
import Result from '@/components/Result'

type View = 'home' | 'quiz' | 'result'

const num = (value: string | null | undefined) => {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function bySourceOrder(a: Mcq, b: Mcq): number {
  const left = num(a.source_ref)
  const right = num(b.source_ref)
  if (left !== null && right !== null) return left - right
  return 0
}

export default function PracticeApp({ initialCatalog }: { initialCatalog?: CatalogRow[] | null }) {
  const [lang, setLangState] = useState<Lang>('en')
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>('home')
  const [catalog, setCatalog] = useState<CatalogRow[] | null>(initialCatalog ?? null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedBook, setSelectedBook] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const cache = useRef(new Map<string, Mcq[]>())
  const t = copyFor(lang)

  useEffect(() => {
    setLangState(getLang())
    setReady(true)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'ur' ? 'ur' : 'en'
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr'
  }, [lang])

  const toggleLang = () => {
    const next: Lang = lang === 'ur' ? 'en' : 'ur'
    setLangState(next)
    setLang(next)
  }

  // ---------------------------------------------------------------- catalog

  useEffect(() => {
    let cancelled = false
    if (initialCatalog) {
      const shaped = shapeCatalog(initialCatalog)
      setSelectedBook((prev) => prev ?? shaped.books[0]?.id ?? null)
      return
    }
    const supabase = getSupabase()
    if (!supabase) {
      setCatalogError(copyFor(getLang()).notConfigured)
      setCatalog([])
      return
    }
    ;(async () => {
      const { data, error: fetchError } = await supabase.from('catalog').select('*')
      if (cancelled) return
      if (fetchError) {
        setCatalogError(copyFor(getLang()).loadError)
        setCatalog([])
        return
      }
      const rows = (data ?? []) as CatalogRow[]
      setCatalog(rows)
      const shaped = shapeCatalog(rows)
      setSelectedBook((prev) => prev ?? shaped.books[0]?.id ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [initialCatalog])

  const { books, categories } = useMemo(() => shapeCatalog(catalog ?? []), [catalog])

  const bookCategories = useMemo(
    () => categories.filter((category) => category.bookId === selectedBook),
    [categories, selectedBook],
  )

  const progress = useMemo<Record<string, CategoryProgress>>(() => {
    if (!ready) return {}
    void tick
    void view
    return getAllProgress()
  }, [ready, tick, view])

  const stats = useMemo(() => {
    let answered = 0
    let correct = 0
    for (const category of bookCategories) {
      const saved = progress[category.id]
      if (!saved) continue
      answered += saved.answered
      correct += saved.correct
    }
    return {
      answered,
      correct,
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    }
  }, [bookCategories, progress])

  const resume = useMemo(() => {
    const candidates = bookCategories
      .map((category) => ({ category, saved: progress[category.id] }))
      .filter(
        (entry): entry is { category: Category; saved: CategoryProgress } =>
          Boolean(entry.saved) && entry.saved!.position > 0 && entry.saved!.answered > 0,
      )
      .sort((a, b) => b.saved.updatedAt - a.saved.updatedAt)
    return candidates[0] ?? null
  }, [bookCategories, progress])

  // ---------------------------------------------------------------- data

  const loadQuestions = useCallback(async (category: Category): Promise<Mcq[]> => {
    const cached = cache.current.get(category.id)
    if (cached) return cached
    const supabase = getSupabase()
    if (!supabase) throw new Error('not-configured')
    const { data, error: fetchError } = await supabase
      .from('mcqs')
      .select('id,question_en,question_ur,options,correct_text,explanation,source_ref')
      .eq('category_id', category.id)
    if (fetchError) throw fetchError
    const list = ((data ?? []) as Mcq[]).sort(bySourceOrder)
    cache.current.set(category.id, list)
    return list
  }, [])

  const start = useCallback(
    async (category: Category, mode: Mode) => {
      setError(null)
      setBusy(category.id)
      try {
        const all = await loadQuestions(category)
        if (all.length === 0) {
          setError(t.loadError)
          return
        }
        let questions: Mcq[]
        let index = 0
        if (mode === 'test') {
          questions = shuffle(all).slice(0, Math.min(TEST_SIZE, all.length))
        } else {
          questions = all
          const saved = getProgress(category.id).position
          index = saved > 0 && saved < all.length ? saved : 0
        }
        setSession({
          id: Date.now(),
          mode,
          category,
          questions,
          index,
          selected: null,
          locked: false,
          records: [],
          startedAt: Date.now(),
        })
        setView('quiz')
      } catch {
        setError(t.loadError)
      } finally {
        setBusy(null)
      }
    },
    [loadQuestions, t],
  )

  // ---------------------------------------------------------------- answers

  const answer = (option: string) => {
    const active = session
    if (!active || active.locked) return
    const question = active.questions[active.index]
    const correct = option === question.correct_text

    if (active.mode === 'practice') {
      const saved = getProgress(active.category.id)
      const atEnd = active.index + 1 >= active.questions.length
      saveProgress(active.category.id, {
        answered: saved.answered + 1,
        correct: saved.correct + (correct ? 1 : 0),
        position: atEnd ? 0 : active.index + 1,
      })
      setTick((value) => value + 1)
      setSession({
        ...active,
        selected: option,
        locked: true,
        records: [...active.records, { question, chosen: option, correct }],
      })
      return
    }

    setSession({ ...active, selected: option })
  }

  const finish = (active: Session, records: AnswerRecord[]) => {
    const saved = getProgress(active.category.id)
    saveProgress(active.category.id, {
      answered: saved.answered + records.length,
      correct: saved.correct + records.filter((record) => record.correct).length,
    })
    setTick((value) => value + 1)
    setSession({ ...active, records, locked: true })
    setView('result')
  }

  const next = () => {
    const active = session
    if (!active) return
    const question = active.questions[active.index]
    const atEnd = active.index + 1 >= active.questions.length

    if (active.mode === 'test') {
      if (!active.selected) return
      const records = [
        ...active.records,
        {
          question,
          chosen: active.selected,
          correct: active.selected === question.correct_text,
        },
      ]
      if (atEnd) {
        finish(active, records)
        return
      }
      setSession({ ...active, index: active.index + 1, selected: null, locked: false, records })
      return
    }

    if (atEnd) {
      setView('result')
      return
    }
    setSession({ ...active, index: active.index + 1, selected: null, locked: false })
  }

  const goHome = () => {
    setView('home')
    setSession(null)
    setError(null)
    setTick((value) => value + 1)
  }

  const restart = async () => {
    if (!session) return
    if (session.mode === 'practice') resetProgress(session.category.id)
    await start(session.category, session.mode)
  }

  // ---------------------------------------------------------------- render

  return (
    <div className="page" dir={lang === 'ur' ? 'rtl' : 'ltr'}>
      <header className="nav">
        <div className="container nav-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <IconLogo />
            </span>
            <span className="brand-name">{ready ? t.appName : 'MCQ Practice'}</span>
          </div>
          <div className="nav-actions">
            <button
              type="button"
              className="lang-toggle"
              onClick={toggleLang}
              aria-label={t.language}
            >
              {lang === 'ur' ? 'English' : 'اردو'}
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {view === 'home' && (
            <Home
              t={t}
              books={books}
              categories={bookCategories}
              selectedBook={selectedBook}
              onSelectBook={setSelectedBook}
              progress={progress}
              answered={stats.answered}
              accuracy={stats.accuracy}
              resume={
                ready && resume ? { category: resume.category, progress: resume.saved } : null
              }
              showResume={ready}
              loading={catalog === null || busy !== null}
              error={error ?? catalogError}
              onStart={start}
              onContinue={() => resume && start(resume.category, 'practice')}
            />
          )}

          {view === 'quiz' && session && (
            <Quiz
              session={session}
              lang={lang}
              t={t}
              onAnswer={answer}
              onNext={next}
              onBack={goHome}
              onRestart={restart}
            />
          )}

          {view === 'result' && session && (
            <Result session={session} lang={lang} t={t} onRetry={restart} onHome={goHome} />
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="container">{t.footer}</div>
      </footer>
    </div>
  )
}
