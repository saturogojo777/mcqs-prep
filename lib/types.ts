export type Lang = 'en' | 'ur'

export type ItemKind = 'exam' | 'subject' | 'book'

/** One card on the exam / subject / book list. */
export type CatalogItem = {
  kind: ItemKind
  /** slug for exams and subjects, uuid for books */
  key: string
  name: string
  nameUr: string | null
  count: number
  /** books only: the subject they belong to, and how many chapters they hold */
  subjectSlug?: string | null
  chapters?: number
  description?: string | null
}

export type Catalog = {
  exams: CatalogItem[]
  subjects: CatalogItem[]
  books: CatalogItem[]
}

export type SiteStats = {
  questions: number
  subjects: number
  exams: number
  books: number
  chapters: number
  explanations: number
}

export type Difficulty = 'easy' | 'medium' | 'hard'
export type Level = 'basic' | 'intermediate' | 'advanced'

/** What the student chose on the start screen. 'mixed' means "no filter". */
export type DifficultyChoice = Difficulty | 'mixed'
export type LevelChoice = Level | 'mixed'

export type QuizMode = 'practice' | 'mock'

/** Mock-test settings for one exam. Defaults are editable in /admin, never official. */
export type MockPattern = {
  examSlug: string
  questionCount: number
  minutes: number
  marksPerQuestion: number
  negativeMarking: number
  passingPercentage: number
}

/** Raw question row returned by the database RPCs. */
export type QuestionRow = {
  id: string
  question_en: string
  question_ur: string | null
  options: Record<string, string>
  correct_text: string
  explanation: string | null
  chapter?: string | null
  subject_slug?: string | null
  level?: Level | null
  difficulty?: Difficulty | null
}

/** A question prepared for one display: options already shuffled. */
export type PreparedQuestion = QuestionRow & {
  displayOptions: string[]
  correct: string
}

export type Answer = {
  questionId: string
  chosen: string
  correct: string
  right: boolean
  chapter?: string | null
  subject?: string | null
}

export type SessionMode = ItemKind | 'today' | 'mistakes'

export type Session = {
  mode: SessionMode
  title: string
  titleUr: string
  questions: PreparedQuestion[]
  timerOn: boolean
  startedAt: number
}

/** One mock-test run: same questions, plus the pattern used to score it. */
export type MockSession = Session & {
  quizMode: 'mock'
  minutes: number
  marksPerQuestion: number
  negativeMarking: number
  passingPercentage: number
}
