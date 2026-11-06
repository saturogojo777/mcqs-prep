import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Catalog,
  CatalogItem,
  DifficultyChoice,
  ItemKind,
  LevelChoice,
  MockPattern,
  PreparedQuestion,
  QuestionRow,
  SiteStats,
} from '@/lib/types'

type SubjectRow = { id: string; slug: string; name: string; name_ur: string; sort: number; question_count: number }
type ExamRow = SubjectRow
type BookRow = {
  id: string
  title: string
  description: string | null
  subject_slug: string | null
  question_count: number
  chapter_count: number
}

export type ChapterRow = { id: string; book_id: string; chapter: string; question_count: number }

export const EMPTY_CATALOG: Catalog = { exams: [], subjects: [], books: [] }
export const EMPTY_STATS: SiteStats = { questions: 0, subjects: 0, exams: 0, books: 0, chapters: 0, explanations: 0 }

function item(kind: ItemKind, key: string, name: string, nameUr: string | null, count: number): CatalogItem {
  return { kind, key, name, nameUr, count: Number(count) || 0 }
}

/** Exam, subject and book lists with their question counts. */
export async function loadCatalog(client: SupabaseClient): Promise<Catalog> {
  const [exams, subjects, books] = await Promise.all([
    client.from('exam_catalog').select('id,slug,name,name_ur,sort,question_count').order('sort'),
    client.from('subject_catalog').select('id,slug,name,name_ur,sort,question_count').order('sort'),
    client
      .from('book_catalog')
      .select('id,title,description,subject_slug,question_count,chapter_count')
      .order('title'),
  ])

  return {
    exams: ((exams.data ?? []) as ExamRow[]).map((row) =>
      item('exam', row.slug, row.name, row.name_ur, row.question_count),
    ),
    subjects: ((subjects.data ?? []) as SubjectRow[]).map((row) =>
      item('subject', row.slug, row.name, row.name_ur, row.question_count),
    ),
    books: ((books.data ?? []) as BookRow[]).map((row) => ({
      ...item('book', row.id, row.title, null, row.question_count),
      subjectSlug: row.subject_slug,
      chapters: Number(row.chapter_count) || 0,
      description: row.description,
    })),
  }
}

export async function loadStats(client: SupabaseClient): Promise<SiteStats> {
  const { data, error } = await client.rpc('site_stats')
  if (error || !data) return EMPTY_STATS
  const raw = data as Record<string, number>
  return {
    questions: Number(raw.questions ?? 0),
    subjects: Number(raw.subjects ?? 0),
    exams: Number(raw.exams ?? 0),
    books: Number(raw.books ?? 0),
    chapters: Number(raw.chapters ?? 0),
    explanations: Number(raw.explanations ?? 0),
  }
}

/** Mock-test patterns keyed by exam slug. Read-only for the browser. */
export async function loadMockPatterns(client: SupabaseClient): Promise<Record<string, MockPattern>> {
  const { data, error } = await client
    .from('mock_patterns')
    .select('exam_id,question_count,minutes,marks_per_question,negative_marking,passing_percentage,exams(slug)')
  if (error || !data) return {}
  const patterns: Record<string, MockPattern> = {}
  for (const row of data as unknown as Array<{
    question_count: number
    minutes: number
    marks_per_question: number
    negative_marking: number
    passing_percentage: number
    exams: { slug: string } | null
  }>) {
    const slug = row.exams?.slug
    if (!slug) continue
    patterns[slug] = {
      examSlug: slug,
      questionCount: Number(row.question_count) || 100,
      minutes: Number(row.minutes) || 120,
      marksPerQuestion: Number(row.marks_per_question) || 1,
      negativeMarking: Number(row.negative_marking) || 0,
      passingPercentage: Number(row.passing_percentage) || 50,
    }
  }
  return patterns
}

export async function loadChapters(client: SupabaseClient): Promise<ChapterRow[]> {
  const { data, error } = await client
    .from('chapter_catalog')
    .select('id,book_id,chapter,question_count')
    .order('chapter')
  if (error) return []
  return (data ?? []) as ChapterRow[]
}

export function findItem(catalog: Catalog, kind: string, key: string): CatalogItem | null {
  const list =
    kind === 'exam' ? catalog.exams : kind === 'subject' ? catalog.subjects : kind === 'book' ? catalog.books : []
  return list.find((entry) => entry.key === key) ?? null
}

export function isKind(value: string): value is ItemKind {
  return value === 'exam' || value === 'subject' || value === 'book'
}

/** Options arrive as {A,B,C,D}; the answer is always compared as text. */
export function prepareQuestion(row: QuestionRow, shuffler: <T>(list: T[]) => T[]): PreparedQuestion {
  const options = row.options ?? {}
  const values = Object.keys(options)
    .sort()
    .map((key) => String(options[key] ?? '').trim())
    .filter(Boolean)
  return {
    ...row,
    displayOptions: shuffler(values),
    correct: row.correct_text,
  }
}

const cleanFilter = (value: string | undefined | null) =>
  !value || value === 'mixed' ? null : value

export async function loadQuestions(
  client: SupabaseClient,
  kind: string,
  key: string,
  limit: number,
  shuffler: <T>(list: T[]) => T[],
  difficulty?: DifficultyChoice,
  level?: LevelChoice,
): Promise<PreparedQuestion[]> {
  const { data, error } = await client.rpc('random_questions', {
    p_kind: kind,
    p_key: key,
    p_limit: limit,
    p_difficulty: cleanFilter(difficulty),
    p_level: cleanFilter(level),
  })
  if (error) throw new Error(error.message)
  // No silent fallback: when a filter (easy / advanced …) matches nothing,
  // the caller shows an honest empty state instead of serving the wrong tier.
  return ((data ?? []) as QuestionRow[]).map((row) => prepareQuestion(row, shuffler))
}

export async function loadDailyQuestions(
  client: SupabaseClient,
  seed: string,
  limit: number,
  shuffler: <T>(list: T[]) => T[],
  difficulty?: DifficultyChoice,
  level?: LevelChoice,
): Promise<PreparedQuestion[]> {
  const { data, error } = await client.rpc('daily_questions', {
    p_seed: seed,
    p_limit: limit,
    p_difficulty: cleanFilter(difficulty),
    p_level: cleanFilter(level),
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as QuestionRow[]).map((row) => prepareQuestion(row, shuffler))
}

export async function loadQuestionsByIds(
  client: SupabaseClient,
  ids: string[],
  shuffler: <T>(list: T[]) => T[],
): Promise<PreparedQuestion[]> {
  if (ids.length === 0) return []
  const { data, error } = await client.rpc('questions_by_ids', { p_ids: ids })
  if (error) throw new Error(error.message)
  return ((data ?? []) as QuestionRow[]).map((row) => prepareQuestion(row, shuffler))
}

/** The search index for the header: exams, subjects and books in one list. */
export function searchIndex(catalog: Catalog) {
  return [
    ...catalog.exams.map((entry) => ({ ...entry, href: `/practice/exam/${entry.key}` })),
    ...catalog.subjects.map((entry) => ({ ...entry, href: `/practice/subject/${entry.key}` })),
    ...catalog.books.map((entry) => ({ ...entry, href: `/practice/book/${entry.key}` })),
  ]
}
