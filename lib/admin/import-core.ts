import type { SupabaseClient } from '@supabase/supabase-js'
import {
  OPTION_KEYS,
  parseInput,
  toSheetCsvUrl,
  type BuildResult,
  type Candidate,
  type Defaults,
  type PreviewRow,
} from '@/lib/import/parse'

const MAX_ROWS = 5000
const PREVIEW_ROWS = 150

export type Summary = {
  total: number
  newCount: number
  duplicateCount: number
  invalidCount: number
  inFileDuplicates: number
  truncated: boolean
  rows: PreviewRow[]
}

// ------------------------------------------------------------------ sources

/** Reads the import payload from a Google Sheet link or from pasted text. */
export async function resolveSource(source: unknown): Promise<{ text: string } | { error: string }> {
  if (!source || typeof source !== 'object') return { error: 'Nothing to import.' }
  const { kind, value } = source as { kind?: unknown; value?: unknown }
  const text = typeof value === 'string' ? value : ''

  if (kind === 'url') {
    const csvUrl = toSheetCsvUrl(text)
    if (!csvUrl) {
      return { error: 'That is not a Google Sheets link. Use a docs.google.com/spreadsheets link.' }
    }
    try {
      const res = await fetch(csvUrl, {
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
        headers: { 'user-agent': 'mcqs-prep-import/1.0' },
      })
      if (!res.ok) {
        return {
          error: `Google returned ${res.status}. Check the link, or paste the rows instead.`,
        }
      }
      const finalHost = new URL(res.url).hostname
      if (!finalHost.endsWith('docs.google.com') && !finalHost.endsWith('googleusercontent.com')) {
        return {
          error:
            'This sheet is private. Share it as "Anyone with the link can view", or paste the rows instead.',
        }
      }
      const body = await res.text()
      if (/^\s*</.test(body)) {
        return {
          error:
            'This sheet is private. Share it as "Anyone with the link can view", or paste the rows instead.',
        }
      }
      if (!body.trim()) return { error: 'The sheet is empty.' }
      return { text: body }
    } catch {
      return { error: 'Could not reach Google Sheets. Check the link or paste the rows instead.' }
    }
  }

  if (!text.trim()) return { error: 'Paste the rows or upload a file first.' }
  return { text }
}

export function buildFromText(text: string, defaults: Defaults): BuildResult {
  const result = parseInput(text, defaults)
  if (result.rows.length > MAX_ROWS) {
    return {
      ...result,
      rows: result.rows.slice(0, MAX_ROWS),
      summary: { ...result.summary, total: MAX_ROWS },
    }
  }
  return result
}

// ------------------------------------------------------------------ hashing

async function hashCandidates(admin: SupabaseClient, candidates: Candidate[]): Promise<string[]> {
  const hashes: string[] = []
  for (let i = 0; i < candidates.length; i += 400) {
    const batch = candidates.slice(i, i + 400)
    const payload = batch.map((c) => ({ question_en: c.question_en, options: c.options }))
    const { data, error } = await admin.rpc('mcq_hash_rows', { rows: payload })
    if (error) throw new Error(`Could not check duplicates: ${error.message}`)
    const rows = ((data ?? []) as { ord: number; hash: string }[]).slice().sort((a, b) => a.ord - b.ord)
    for (const row of rows) hashes.push(row.hash)
  }
  return hashes
}

async function existingHashes(admin: SupabaseClient, hashes: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (let i = 0; i < hashes.length; i += 200) {
    const batch = hashes.slice(i, i + 200)
    const { data, error } = await admin.from('mcqs').select('content_hash').in('content_hash', batch)
    if (error) throw new Error(`Could not check duplicates: ${error.message}`)
    for (const row of (data ?? []) as { content_hash: string }[]) found.add(row.content_hash)
  }
  return found
}

// ------------------------------------------------------------------ preview

export async function reviewImport(admin: SupabaseClient, build: BuildResult): Promise<Summary> {
  const candidates = build.rows.map((r) => r.candidate).filter((c): c is Candidate => c !== null)
  const hashes = await hashCandidates(admin, candidates)
  const existing = await existingHashes(admin, Array.from(new Set(hashes)))

  let cursor = 0
  const rows: PreviewRow[] = build.rows.map((row) => {
    if (!row.candidate) return row
    const hash = hashes[cursor++]
    if (existing.has(hash)) {
      return {
        ...row,
        status: 'duplicate' as const,
        messages: ['Already in the database (same question and options)'],
        candidate: null,
      }
    }
    return row
  })

  const invalidCount = rows.filter((r) => r.status === 'invalid').length
  const duplicateCount = rows.filter((r) => r.status === 'duplicate').length
  const newCount = rows.filter((r) => r.status === 'new').length

  return {
    total: rows.length,
    newCount,
    duplicateCount,
    invalidCount,
    inFileDuplicates: build.summary.inFileDuplicates,
    truncated: rows.length > PREVIEW_ROWS,
    rows: rows.slice(0, PREVIEW_ROWS),
  }
}

// ------------------------------------------------------------------ import

export type ImportResult = {
  imported: number
  skippedDuplicates: number
  skippedInvalid: number
  books: string[]
  categories: string[]
}

type BookGroup = {
  title: string
  subject: string | null
  category: string
  exams: string[]
  rows: Record<string, unknown>[]
}

/**
 * Writes the reviewed rows to the database through `public.import_book`.
 *
 * The whole call runs inside one Postgres function, so a failure leaves the
 * books table, the tag tables and the questions exactly as they were: the
 * import is all-or-nothing per book, never half-saved.
 */
export async function runImport(admin: SupabaseClient, build: BuildResult): Promise<ImportResult> {
  const pending = build.rows
    .filter((r): r is PreviewRow & { candidate: Candidate } => r.candidate !== null)
    .map((r) => r.candidate)

  const skippedInvalid = build.rows.length - pending.length
  if (pending.length === 0) {
    return { imported: 0, skippedDuplicates: 0, skippedInvalid, books: [], categories: [] }
  }

  const groups = new Map<string, BookGroup>()
  for (const candidate of pending) {
    const subject = candidate.subject?.trim() || null
    const category = candidate.category.trim() || subject || 'General'
    const key = `${candidate.book}\u0000${subject ?? ''}\u0000${category}\u0000${candidate.exams.join(',')}`
    let group = groups.get(key)
    if (!group) {
      group = { title: candidate.book, subject, category, exams: candidate.exams, rows: [] }
      groups.set(key, group)
    }
    const options: Record<string, string> = {}
    for (const optionKey of OPTION_KEYS) options[optionKey] = candidate.options[optionKey]
    group.rows.push({
      question_en: candidate.question_en,
      question_ur: candidate.question_ur,
      options,
      correct_text: candidate.correct_text,
      explanation: candidate.explanation,
      source_ref: candidate.source_ref,
      exams: candidate.exams,
    })
  }

  let imported = 0
  let skippedDuplicates = 0
  for (const group of groups.values()) {
    const { data, error } = await admin.rpc('import_book', {
      p_book: {
        title: group.title,
        subject: group.subject,
        category: group.category,
        exams: group.exams,
      },
      p_rows: group.rows,
    })
    if (error) throw new Error(`Import failed: ${error.message}`)
    const result = (data ?? {}) as { imported?: number; skipped?: number }
    imported += Number(result.imported ?? 0)
    skippedDuplicates += Number(result.skipped ?? 0)
  }

  return {
    imported,
    skippedDuplicates,
    skippedInvalid,
    books: Array.from(new Set(pending.map((c) => c.book))),
    categories: Array.from(new Set(pending.map((c) => c.category.trim() || c.subject || 'General'))),
  }
}
