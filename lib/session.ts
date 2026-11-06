import type {
  Answer,
  DifficultyChoice,
  Lang,
  LevelChoice,
  MockPattern,
  PreparedQuestion,
  QuizMode,
  Session,
} from '@/lib/types'

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

/**
 * Mock-test scoring: every question is worth `marks`, every wrong pick costs
 * `negative`. Unanswered questions score nothing.
 */
export function mockScore(
  answers: Answer[],
  pattern: { marksPerQuestion: number; negativeMarking: number; total: number; passingPercentage: number },
) {
  const attempted = answers.length
  const right = answers.filter((answer) => answer.right).length
  const wrong = attempted - right
  const marks = right * pattern.marksPerQuestion - wrong * pattern.negativeMarking
  const maxMarks = pattern.total * pattern.marksPerQuestion
  const percent = maxMarks === 0 ? 0 : Math.max(0, Math.round((marks / maxMarks) * 100))
  return {
    right,
    wrong,
    attempted,
    skipped: Math.max(0, pattern.total - attempted),
    marks: Math.round(marks * 100) / 100,
    maxMarks: Math.round(maxMarks * 100) / 100,
    percent,
    passed: percent >= pattern.passingPercentage,
  }
}

export function questionText(question: PreparedQuestion, lang: Lang): string {
  return lang === 'ur' && question.question_ur ? question.question_ur : question.question_en
}

export const SIZE_CHOICES = [10, 20, 50, 100]

export type SizeChoice = number | 'all'

/**
 * Count chips for the start screen: the standard sizes below the pool, then
 * the pool itself. Big pools get an "All" chip instead of an odd number.
 */
export function sizeChoices(available: number): SizeChoice[] {
  const capped = Math.min(Math.max(0, available), MAX_QUESTIONS)
  const lows = SIZE_CHOICES.filter((size) => size < capped)
  if (capped > 100) return [...lows, 'all']
  return [...lows, capped].filter((value, index, list) => list.indexOf(value) === index)
}

export function sizeValue(choice: SizeChoice, available: number): number {
  return choice === 'all' ? Math.min(Math.max(1, available), MAX_QUESTIONS) : choice
}

export const DIFFICULTY_CHOICES: DifficultyChoice[] = ['mixed', 'easy', 'medium', 'hard']
export const LEVEL_CHOICES: LevelChoice[] = ['mixed', 'basic', 'intermediate', 'advanced']

export function sessionOf(
  mode: Session['mode'],
  title: string,
  titleUr: string,
  questions: PreparedQuestion[],
  timerOn: boolean,
): Session {
  return { mode, title, titleUr, questions, timerOn, startedAt: Date.now() }
}

/** A sane mock pattern for a subject or book pick, where no exam pattern applies. */
export function genericPattern(count: number): MockPattern {
  return {
    examSlug: '',
    questionCount: count,
    minutes: Math.max(5, Math.round(count * 1.2)),
    marksPerQuestion: 1,
    negativeMarking: 0,
    passingPercentage: 50,
  }
}

/** Accuracy grouped by chapter (falling back to the subject name). */
export function groupAccuracy(answers: Answer[], key: 'chapter' | 'subject') {
  const map = new Map<string, { total: number; right: number }>()
  for (const answer of answers) {
    const label = (key === 'chapter' ? answer.chapter : answer.subject)?.trim()
    if (!label) continue
    const entry = map.get(label) ?? { total: 0, right: 0 }
    entry.total += 1
    if (answer.right) entry.right += 1
    map.set(label, entry)
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, ...value, percent: Math.round((value.right / value.total) * 100) }))
    .sort((a, b) => b.total - a.total)
}

export function weakestTopics(answers: Answer[], limit = 3) {
  return groupAccuracy(answers, 'chapter')
    .filter((entry) => entry.percent < 70 && entry.total >= 1)
    .sort((a, b) => a.percent - b.percent)
    .slice(0, limit)
}

export function quizModeLabel(mode: QuizMode): string {
  return mode === 'mock' ? 'Mock Test' : 'Practice'
}
