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
