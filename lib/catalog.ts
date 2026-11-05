import type { SupabaseClient } from '@supabase/supabase-js'
import type { Catalog, CatalogItem, ItemKind, PreparedQuestion, QuestionRow } from '@/lib/types'

type SubjectRow = { id: string; slug: string; name: string; name_ur: string; sort: number; question_count: number }
type ExamRow = SubjectRow
type BookRow = { id: string; title: string; question_count: number }

export const EMPTY_CATALOG: Catalog = { exams: [], subjects: [], books: [] }

function item(kind: ItemKind, key: string, name: string, nameUr: string | null, count: number): CatalogItem {
  return { kind, key, name, nameUr, count: Number(count) || 0 }
}

/** Exam, subject and book lists with their question counts. */
export async function loadCatalog(client: SupabaseClient): Promise<Catalog> {
  const [exams, subjects, books] = await Promise.all([
    client.from('exam_catalog').select('id,slug,name,name_ur,sort,question_count').order('sort'),
    client.from('subject_catalog').select('id,slug,name,name_ur,sort,question_count').order('sort'),
    client.from('book_catalog').select('id,title,question_count').order('title'),
  ])

  return {
    exams: ((exams.data ?? []) as ExamRow[]).map((row) =>
      item('exam', row.slug, row.name, row.name_ur, row.question_count),
    ),
    subjects: ((subjects.data ?? []) as SubjectRow[]).map((row) =>
      item('subject', row.slug, row.name, row.name_ur, row.question_count),
    ),
    books: ((books.data ?? []) as BookRow[]).map((row) => item('book', row.id, row.title, null, row.question_count)),
  }
}

export function findItem(catalog: Catalog, kind: string, key: string): CatalogItem | null {
  const list = kind === 'exam' ? catalog.exams : kind === 'subject' ? catalog.subjects : kind === 'book' ? catalog.books : []
  return list.find((entry) => entry.key === key) ?? null
}

export function isKind(value: string): value is ItemKind {
  return value === 'exam' || value === 'subject' || value === 'book'
}

/** Options arrive as {A,B,C,D}; the answer is always compared as text. */
export function prepareQuestion(row: QuestionRow, shuffle: <T>(list: T[]) => T[]): PreparedQuestion {
  const options = row.options ?? {}
  const values = Object.keys(options)
    .sort()
    .map((key) => String(options[key] ?? '').trim())
    .filter(Boolean)
  return {
    ...row,
    displayOptions: shuffle(values),
    correct: row.correct_text,
  }
}

export async function loadQuestions(
  client: SupabaseClient,
  kind: string,
  key: string,
  limit: number,
  shuffle: <T>(list: T[]) => T[],
): Promise<PreparedQuestion[]> {
  const { data, error } = await client.rpc('random_questions', { p_kind: kind, p_key: key, p_limit: limit })
  if (error) throw new Error(error.message)
  return ((data ?? []) as QuestionRow[]).map((row) => prepareQuestion(row, shuffle))
}

export async function loadDailyQuestions(
  client: SupabaseClient,
  seed: string,
  limit: number,
  shuffle: <T>(list: T[]) => T[],
): Promise<PreparedQuestion[]> {
  const { data, error } = await client.rpc('daily_questions', { p_seed: seed, p_limit: limit })
  if (error) throw new Error(error.message)
  return ((data ?? []) as QuestionRow[]).map((row) => prepareQuestion(row, shuffle))
}

export async function loadQuestionsByIds(
  client: SupabaseClient,
  ids: string[],
  shuffle: <T>(list: T[]) => T[],
): Promise<PreparedQuestion[]> {
  if (ids.length === 0) return []
  const { data, error } = await client.rpc('questions_by_ids', { p_ids: ids })
  if (error) throw new Error(error.message)
  return ((data ?? []) as QuestionRow[]).map((row) => prepareQuestion(row, shuffle))
}
