import type { Answer, Lang, PreparedQuestion, Session } from '@/lib/types'

export const MAX_QUESTIONS = 500

/** Fisher-Yates, returns a new array. Used for options and for question order. */
export function shuffle<T>(list: T[]): T[] {
  const copy = list.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Today's date in Pakistan, e.g. 2026-11-05. Same seed for every visitor. */
export function todaySeed(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function score(answers: Answer[]) {
  const right = answers.filter((answer) => answer.right).length
  const total = answers.length
  return { right, total, percent: total === 0 ? 0 : Math.round((right / total) * 100) }
}

export function questionText(question: PreparedQuestion, lang: Lang): string {
  return lang === 'ur' && question.question_ur ? question.question_ur : question.question_en
}

export const SIZE_CHOICES = [10, 20, 50, 100]

export function sizeChoices(available: number): number[] {
  const list = SIZE_CHOICES.filter((size) => size < available)
  return list.length > 0 ? [...list, Math.min(available, MAX_QUESTIONS)] : [Math.min(available, MAX_QUESTIONS)]
}

export function sessionOf(
  mode: Session['mode'],
  title: string,
  titleUr: string,
  questions: PreparedQuestion[],
  timerOn: boolean,
): Session {
  return { mode, title, titleUr, questions, timerOn, startedAt: Date.now() }
}
