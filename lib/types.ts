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
}

export type Catalog = {
  exams: CatalogItem[]
  subjects: CatalogItem[]
  books: CatalogItem[]
}

/** Raw question row returned by the database RPCs and views. */
export type QuestionRow = {
  id: string
  question_en: string
  question_ur: string | null
  options: Record<string, string>
  correct_text: string
  explanation: string | null
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
