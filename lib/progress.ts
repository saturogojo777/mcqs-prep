'use client'

import type { Answer } from '@/lib/types'

/** localStorage only. No account, nothing sent to the server. */
const MISTAKES_KEY = 'dailytest.mistakes.v1'
const LAST_KEY = 'dailytest.last.v1'

export type LastResult = { right: number; total: number; at: number; title: string }

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or blocked: progress is a convenience, never required
  }
}

export function getMistakeIds(): string[] {
  const value = readJson<unknown>(MISTAKES_KEY, [])
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

/** Wrong answers are remembered, correct answers remove the question from the list. */
export function saveAnswers(answers: Answer[]) {
  if (answers.length === 0) return
  const current = new Set(getMistakeIds())
  for (const answer of answers) {
    if (answer.right) current.delete(answer.questionId)
    else current.add(answer.questionId)
  }
  writeJson(MISTAKES_KEY, Array.from(current).slice(-500))
}

export function getLastResult(): LastResult | null {
  const value = readJson<LastResult | null>(LAST_KEY, null)
  return value && typeof value.total === 'number' ? value : null
}

export function saveLastResult(result: LastResult) {
  writeJson(LAST_KEY, result)
}

export function clearMistakes() {
  writeJson(MISTAKES_KEY, [])
}

/* ------------------------------------------------------------------ */
/* Local progress: tests taken, accuracy per subject, daily streak.    */
/* ------------------------------------------------------------------ */

const PROGRESS_KEY = 'dailytest.progress.v1'

export type Bucket = { total: number; right: number }

export type ProgressState = {
  tests: number
  answered: number
  right: number
  streak: number
  lastDay: string | null
  subjects: Record<string, Bucket>
  chapters: Record<string, Bucket>
  updatedAt: number
}

const EMPTY_PROGRESS: ProgressState = {
  tests: 0,
  answered: 0,
  right: 0,
  streak: 0,
  lastDay: null,
  subjects: {},
  chapters: {},
  updatedAt: 0,
}

function dayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function yesterdayKey(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return dayKey(date)
}

export function getProgress(): ProgressState {
  const value = readJson<Partial<ProgressState>>(PROGRESS_KEY, {})
  return {
    ...EMPTY_PROGRESS,
    ...value,
    subjects: value.subjects ?? {},
    chapters: value.chapters ?? {},
  }
}

export function recordTest(answers: Answer[]) {
  if (answers.length === 0) return getProgress()
  const state = getProgress()
  const today = dayKey()
  const next: ProgressState = {
    tests: state.tests + 1,
    answered: state.answered + answers.length,
    right: state.right + answers.filter((answer) => answer.right).length,
    streak: state.lastDay === today ? Math.max(1, state.streak) : state.lastDay === yesterdayKey() ? state.streak + 1 : 1,
    lastDay: today,
    subjects: { ...state.subjects },
    chapters: { ...state.chapters },
    updatedAt: Date.now(),
  }
  for (const answer of answers) {
    const subject = answer.subject?.trim()
    const chapter = answer.chapter?.trim()
    if (subject) {
      const bucket = next.subjects[subject] ?? { total: 0, right: 0 }
      next.subjects[subject] = { total: bucket.total + 1, right: bucket.right + (answer.right ? 1 : 0) }
    }
    if (chapter) {
      const bucket = next.chapters[chapter] ?? { total: 0, right: 0 }
      next.chapters[chapter] = { total: bucket.total + 1, right: bucket.right + (answer.right ? 1 : 0) }
    }
  }
  writeJson(PROGRESS_KEY, next)
  return next
}

export function clearProgress() {
  writeJson(PROGRESS_KEY, EMPTY_PROGRESS)
}

export function accuracyPercent(bucket: Bucket | undefined): number {
  if (!bucket || bucket.total === 0) return 0
  return Math.round((bucket.right / bucket.total) * 100)
}
