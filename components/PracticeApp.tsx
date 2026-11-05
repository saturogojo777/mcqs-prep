'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase, type CatalogRow } from '@/lib/supabase'
import { shapeCatalog, type Book, type Category, type Mcq } from '@/lib/catalog'
import { getLang, getProgress, saveProgress, resetProgress, setLang, type Lang } from '@/lib/progress'

const TEST_SIZE = 10

type View = 'home' | 'quiz' | 'result'
type Mode = 'practice' | 'test'

type AnswerRecord = { question: Mcq; chosen: string; correct: boolean }

type Session = {
  mode: Mode
  category: Category
  questions: Mcq[]
  index: number
  selected: string | null
  locked: boolean
  records: AnswerRecord[]
}

const num = (v: string | null | undefined) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function bySourceOrder(a: Mcq, b: Mcq): number {
  const na = num(a.source_ref)
  const nb = num(b.source_ref)
  if (na !== null && nb !== null) return na - nb
  return 0
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  // Fisher-Yates. Answers are matched by option TEXT, so shuffling is always safe.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

const COPY = {
  en: {
    appName: 'MCQ Practice',
    lede: 'Pick a book and a topic. Progress is saved on this device.',
    mode: 'Mode',
    practice: 'Practice',
    test: 'Test',
    book: 'Book',
    topics: 'Topics',
    questions: (n: number) => `${n} question${n === 1 ? '' : 's'}`,
    stats: (answered: number, correct: number) => `${answered} answered · ${correct} correct`,
    next: 'Next question',
    finish: 'See results',
    correct: 'Correct',
    wrong: 'Not quite',
    answerWas: 'Correct answer',
    practiceDone: 'You reached the end of this topic.',
    testDone: 'Test complete.',
    score: 'Score',
    review: 'What to review',
    yourAnswer: 'Your answer',
    tryAgain: 'Try again',
    changeTopic: 'Change topic',
    restart: 'Start over',
    loading: 'Loading…',
    loadError: 'Could not load questions. Check your connection and try again.',
    notConfigured: 'The database is not configured yet.',
    noTopics: 'No topics yet.',
    counter: (i: number, n: number) => `${i} / ${n}`,
    testHint: (n: number) => `${n} random questions. Answers shown at the end.`,
    footer: 'No account needed · progress saved in this browser',
  },
  ur: {
    appName: 'ایم سی کیو پریکٹس',
    lede: 'کتاب اور موضوع منتخب کریں۔ پیش رفت اسی ڈیوائس پر محفوظ رہتی ہے۔',
    mode: 'حالت',
    practice: 'مشق',
    test: 'ٹیسٹ',
    book: 'کتاب',
    topics: 'موضوعات',
    questions: (n: number) => `${n} سوالات`,
    stats: (answered: number, correct: number) => `${answered} حل کیے · ${correct} درست`,
    next: 'اگلا سوال',
    finish: 'نتیجہ دیکھیں',
    correct: 'درست جواب',
    wrong: 'غلط جواب',
    answerWas: 'درست جواب',
    practiceDone: 'آپ اس موضوع کے آخر تک پہنچ گئے۔',
    testDone: 'ٹیسٹ مکمل ہو گیا۔',
    score: 'اسکور',
    review: 'جائزہ لیں',
    yourAnswer: 'آپ کا جواب',
    tryAgain: 'دوبارہ کوشش',
    changeTopic: 'موضوع تبدیل کریں',
    restart: 'دوبارہ شروع',
    loading: 'لوڈ ہو رہا ہے…',
    loadError: 'سوالات لوڈ نہیں ہو سکے۔ کنکشن چیک کر کے دوبارہ کوشش کریں۔',
    notConfigured: 'ڈیٹا بیس ابھی ترتیب نہیں دیا گیا۔',
    noTopics: 'ابھی کوئی موضوع نہیں۔',
    counter: (i: number, n: number) => `${i} / ${n}`,
    testHint: (n: number) => `${n} بے ترتیب سوالات۔ جوابات آخر میں۔`,
    footer: 'اکاؤنٹ کی ضرورت نہیں · پیش رفت اسی براؤزر میں محفوظ',
  },
} as const

type Copy = (typeof COPY)['en'] | (typeof COPY)['ur']

export default function PracticeApp() {
  const [lang, setLangState] = useState<Lang>('en')
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>('home')
  const [mode, setMode] = useState<Mode>('practice')

  const [catalog, setCatalog] = useState<CatalogRow[] | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedBook, setSelectedBook] = useState<string | null>(null)
  const [busyCategory, setBusyCategory] = useState<string | null>(null)

  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, setProgressTick] = useState(0)

  const cache = useRef(new Map<string, Mcq[]>())
  const t: Copy = COPY[lang]

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
    const supabase = getSupabase()
    if (!supabase) {
      setCatalogError(COPY.en.notConfigured)
      setCatalog([])
      return
    }
    ;(async () => {
      const { data, error: err } = await supabase.from('catalog').select('*')
      if (cancelled) return
      if (err) {
        setCatalogError(COPY.en.loadError)
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
  }, [])

  const { books, categories } = useMemo(() => shapeCatalog(catalog ?? []), [catalog])

  const bookCategories = useMemo(
    () => categories.filter((c) => c.bookId === selectedBook),
    [categories, selectedBook],
  )

  // ---------------------------------------------------------------- loading

  const loadQuestions = useCallback(async (category: Category): Promise<Mcq[]> => {
    const cached = cache.current.get(category.id)
    if (cached) return cached
    const supabase = getSupabase()
    if (!supabase) throw new Error('not-configured')
    const { data, error: err } = await supabase
      .from('mcqs')
      .select('id,question_en,question_ur,options,correct_text,explanation,source_ref')
      .eq('category_id', category.id)
    if (err) throw err
    const list = ((data ?? []) as Mcq[]).sort(bySourceOrder)
    cache.current.set(category.id, list)
    return list
  }, [])

  const start = useCallback(
    async (category: Category, nextMode: Mode) => {
      setError(null)
      setBusyCategory(category.id)
      try {
        const all = await loadQuestions(category)
        if (all.length === 0) {
          setError(t.loadError)
          return
        }
        let questions: Mcq[]
        let index = 0
        if (nextMode === 'test') {
          questions = shuffle(all).slice(0, Math.min(TEST_SIZE, all.length))
        } else {
          questions = all
          const saved = getProgress(category.id).position
          index = saved > 0 && saved < all.length ? saved : 0
        }
        setMode(nextMode)
        setSession({
          mode: nextMode,
          category,
          questions,
          index,
          selected: null,
          locked: false,
          records: [],
        })
        setView('quiz')
      } catch {
        setError(t.loadError)
      } finally {
        setBusyCategory(null)
      }
    },
    [loadQuestions, t],
  )

  // ---------------------------------------------------------------- answering

  const current = session?.questions[session.index] ?? null

  const optionList = useMemo(() => {
    if (!current) return []
    const values = Object.values(current.options ?? {}).filter(
      (v): v is string => typeof v === 'string' && v.trim() !== '',
    )
    return shuffle(Array.from(new Set(values)))
  }, [current])

  const finishTest = (s: Session, records: AnswerRecord[]) => {
    const progress = getProgress(s.category.id)
    saveProgress(s.category.id, {
      answered: progress.answered + records.length,
      correct: progress.correct + records.filter((r) => r.correct).length,
    })
    setProgressTick((n) => n + 1)
    setSession({ ...s, records, selected: null, locked: true })
    setView('result')
  }

  const record = (chosen: string) => {
    const s = session
    if (!s || s.locked) return
    const question = s.questions[s.index]
    const correct = chosen === question.correct_text
    const records = [...s.records, { question, chosen, correct }]

    if (s.mode === 'practice') {
      const progress = getProgress(s.category.id)
      const atEnd = s.index + 1 >= s.questions.length
      saveProgress(s.category.id, {
        answered: progress.answered + 1,
        correct: progress.correct + (correct ? 1 : 0),
        position: atEnd ? 0 : s.index + 1,
      })
      setProgressTick((n) => n + 1)
      setSession({ ...s, selected: chosen, locked: true, records })
      return
    }

    if (s.index + 1 >= s.questions.length) {
      finishTest(s, records)
      return
    }
    setSession({ ...s, locked: true, records })
    window.setTimeout(() => {
      setSession((prev) =>
        prev && prev.mode === 'test'
          ? { ...prev, index: prev.index + 1, selected: null, locked: false }
          : prev,
      )
    }, 150)
  }

  const advance = () => {
    const s = session
    if (!s) return
    if (s.index + 1 >= s.questions.length) {
      setView('result')
      return
    }
    setSession({ ...s, index: s.index + 1, selected: null, locked: false })
  }

  const goHome = () => {
    setView('home')
    setSession(null)
    setError(null)
    setProgressTick((n) => n + 1)
  }

  const restart = async () => {
    if (!session) return
    if (session.mode === 'practice') resetProgress(session.category.id)
    await start(session.category, session.mode)
  }

  // ---------------------------------------------------------------- render

  const shellClass = `shell${lang === 'ur' ? ' urdu' : ''}`

  return (
    <div className={shellClass} dir={lang === 'ur' ? 'rtl' : 'ltr'}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            MCQ
          </span>
          <h1>{ready ? t.appName : COPY.en.appName}</h1>
        </div>
        <button className="lang-toggle" onClick={toggleLang} type="button">
          {lang === 'ur' ? 'English' : 'اردو'}
        </button>
      </header>

      {view === 'home' && (
        <main>
          <p className="lede">{t.lede}</p>

          <div className="segmented" role="group" aria-label={t.mode}>
            <button type="button" aria-pressed={mode === 'practice'} onClick={() => setMode('practice')}>
              {t.practice}
            </button>
            <button type="button" aria-pressed={mode === 'test'} onClick={() => setMode('test')}>
              {t.test}
            </button>
          </div>
          {mode === 'test' && (
            <p className="lede" style={{ marginTop: 10, marginBottom: 0 }}>
              {t.testHint(TEST_SIZE)}
            </p>
          )}

          {books.length > 0 && (
            <p className="section-label">{t.book}</p>
          )}
          {books.length === 1 && <p className="book-single">{books[0].title}</p>}
          {books.length > 1 && (
            <>
              <div className="book-row">
                {books.map((b: Book) => (
                  <button
                    key={b.id}
                    type="button"
                    className="chip"
                    aria-pressed={selectedBook === b.id}
                    onClick={() => setSelectedBook(b.id)}
                  >
                    {b.title}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="section-label">{t.topics}</p>

          {catalog === null ? (
            <div className="empty">{t.loading}</div>
          ) : catalogError ? (
            <div className="empty">{catalogError}</div>
          ) : bookCategories.length === 0 ? (
            <div className="empty">{t.noTopics}</div>
          ) : (
            <div className="cat-list">
              {bookCategories.map((cat) => {
                const saved = ready
                  ? getProgress(cat.id)
                  : { answered: 0, correct: 0, position: 0, updatedAt: 0 }
                const pct =
                  cat.count > 0 ? Math.min(100, Math.round((saved.position / cat.count) * 100)) : 0
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className="cat"
                    onClick={() => start(cat, mode)}
                    disabled={busyCategory !== null}
                  >
                    <span className="cat-main">
                      <span className="cat-name">{cat.name}</span>
                      <span className="cat-meta">
                        <span>{t.questions(cat.count)}</span>
                        {saved.answered > 0 && <span>{t.stats(saved.answered, saved.correct)}</span>}
                      </span>
                      {saved.position > 0 && (
                        <span className="cat-bar" aria-hidden="true">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                      )}
                    </span>
                    <span className="cat-arrow" aria-hidden="true">
                      {busyCategory === cat.id ? '…' : lang === 'ur' ? '←' : '→'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {error && <div className="empty">{error}</div>}
        </main>
      )}

      {view === 'quiz' && session && current && (
        <main>
          <div className="quiz-top">
            <button className="icon-btn" onClick={goHome} aria-label={t.changeTopic} type="button">
              {lang === 'ur' ? '→' : '←'}
            </button>
            <span className="counter">{t.counter(session.index + 1, session.questions.length)}</span>
            <button className="icon-btn" onClick={restart} aria-label={t.restart} type="button">
              ↺
            </button>
          </div>

          <div className="bar" aria-hidden="true">
            <span
              style={{
                width: `${((session.index + (session.selected ? 1 : 0)) / session.questions.length) * 100}%`,
              }}
            />
          </div>

          <section className="qcard" key={current.id}>
            <span className="qtag">{session.category.name}</span>
            <p className={`qtext${lang === 'ur' && current.question_ur ? ' urdu-text' : ''}`}>
              {lang === 'ur' && current.question_ur ? current.question_ur : current.question_en}
            </p>
          </section>

          <div className="options" key={`${current.id}-options`}>
            {optionList.map((option, i) => {
              let state: 'idle' | 'correct' | 'wrong' | 'muted' = 'idle'
              if (session.selected) {
                if (option === current.correct_text) state = 'correct'
                else if (option === session.selected) state = 'wrong'
                else state = 'muted'
              }
              return (
                <button
                  key={`${option}-${i}`}
                  type="button"
                  className="option"
                  data-state={state}
                  disabled={session.locked}
                  onClick={() => record(option)}
                >
                  <span className="option-key">{String.fromCharCode(65 + i)}</span>
                  <span className="option-text">{option}</span>
                </button>
              )
            })}
          </div>

          {session.mode === 'practice' && session.selected !== null && (
            <>
              <div
                className="feedback"
                data-kind={session.selected === current.correct_text ? 'correct' : 'wrong'}
                role="status"
                aria-live="polite"
              >
                {session.selected === current.correct_text ? (
                  <strong>{t.correct}</strong>
                ) : (
                  <>
                    <strong>{t.wrong}</strong>
                    <span className="answer">
                      {t.answerWas}: {current.correct_text}
                    </span>
                  </>
                )}
                {current.explanation && <span className="answer">{current.explanation}</span>}
              </div>

              <button className="primary" type="button" onClick={advance}>
                {session.index + 1 >= session.questions.length ? t.finish : t.next}
              </button>
            </>
          )}
        </main>
      )}

      {view === 'result' && session && (
        <main>
          <ResultView session={session} lang={lang} t={t} onRetry={restart} onHome={goHome} />
        </main>
      )}

      <p className="footer-note">{t.footer}</p>
    </div>
  )
}

function ResultView({
  session,
  lang,
  t,
  onRetry,
  onHome,
}: {
  session: Session
  lang: Lang
  t: Copy
  onRetry: () => void
  onHome: () => void
}) {
  const total = session.mode === 'test' ? session.questions.length : session.records.length
  const correct = session.records.filter((r) => r.correct).length
  const wrong = session.records.filter((r) => !r.correct)

  return (
    <>
      <section className="card result">
        <p>{session.mode === 'test' ? t.testDone : t.practiceDone}</p>
        <div className="score">
          {correct}
          <small> / {total}</small>
        </div>
        <p>
          {t.score} · {Math.round((correct / Math.max(1, total)) * 100)}%
        </p>
      </section>

      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <button className="primary" style={{ marginTop: 0 }} type="button" onClick={onRetry}>
          {t.tryAgain}
        </button>
        <button className="primary ghost" style={{ marginTop: 0 }} type="button" onClick={onHome}>
          {t.changeTopic}
        </button>
      </div>

      {wrong.length > 0 && (
        <>
          <p className="section-label">{t.review}</p>
          <div className="review">
            {wrong.map((r, i) => (
              <div className="review-item" key={`${r.question.id}-${i}`}>
                <p className={`q${lang === 'ur' && r.question.question_ur ? ' urdu-text' : ''}`}>
                  {lang === 'ur' && r.question.question_ur ? r.question.question_ur : r.question.question_en}
                </p>
                <div className="row bad">
                  <span>{t.yourAnswer}:</span>
                  <span>{r.chosen}</span>
                </div>
                <div className="row good">
                  <span>{t.answerWas}:</span>
                  <span>{r.question.correct_text}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
