import type { Category, Mcq } from '@/lib/catalog'

export type Mode = 'practice' | 'test'

export type AnswerRecord = { question: Mcq; chosen: string; correct: boolean }

export type Session = {
  id: number
  mode: Mode
  category: Category
  questions: Mcq[]
  index: number
  /** Practice: the answer that was locked in. Test: the current (changeable) pick. */
  selected: string | null
  locked: boolean
  records: AnswerRecord[]
  startedAt: number
}

export const TEST_SIZE = 10

export function shuffle<T>(items: T[]): T[] {
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

export function optionsFor(question: Mcq | null): string[] {
  if (!question) return []
  const values = Object.values(question.options ?? {}).filter(
    (v): v is string => typeof v === 'string' && v.trim() !== '',
  )
  return shuffle(Array.from(new Set(values)))
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
