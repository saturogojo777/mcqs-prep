'use client'

const LANG_KEY = 'mcqprep.lang'
const PROGRESS_KEY = 'mcqprep.progress.v1'

export type Lang = 'en' | 'ur'

export type CategoryProgress = {
  answered: number
  correct: number
  position: number
  updatedAt: number
}

type ProgressMap = Record<string, CategoryProgress>

const empty: CategoryProgress = { answered: 0, correct: 0, position: 0, updatedAt: 0 }

function readProgress(): ProgressMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ProgressMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getProgress(categoryId: string): CategoryProgress {
  const value = readProgress()[categoryId]
  if (!value) return empty
  return {
    answered: Number(value.answered) || 0,
    correct: Number(value.correct) || 0,
    position: Number(value.position) || 0,
    updatedAt: Number(value.updatedAt) || 0,
  }
}

export function saveProgress(categoryId: string, patch: Partial<CategoryProgress>) {
  if (typeof window === 'undefined') return
  try {
    const all = readProgress()
    const next = { ...getProgress(categoryId), ...patch, updatedAt: Date.now() }
    all[categoryId] = next
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  } catch {
    /* storage can be full or blocked: progress is a nicety, never a blocker */
  }
}

export function resetProgress(categoryId: string) {
  if (typeof window === 'undefined') return
  try {
    const all = readProgress()
    delete all[categoryId]
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export function getLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  return window.localStorage.getItem(LANG_KEY) === 'ur' ? 'ur' : 'en'
}

export function setLang(lang: Lang) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* ignore */
  }
}

/** Snapshot of every topic's stored progress (front-end only). */
export function getAllProgress(): Record<string, CategoryProgress> {
  return readProgress()
}
