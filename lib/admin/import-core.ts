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

async function ensureBook(admin: SupabaseClient, title: string): Promise<string> {
  const existing = await admin.from('books').select('id').eq('title', title).maybeSingle()
  if (existing.data?.id) return existing.data.id as string
  const inserted = await admin.from('books').insert({ title }).select('id').single()
  if (inserted.data?.id) return inserted.data.id as string
  const retry = await admin.from('books').select('id').eq('title', title).maybeSingle()
  if (retry.data?.id) return retry.data.id as string
  throw new Error(`Could not create book "${title}"`)
}

async function ensureCategory(admin: SupabaseClient, bookId: string, name: string): Promise<string> {
  const existing = await admin
    .from('categories')
    .select('id')
    .eq('book_id', bookId)
    .eq('name', name)
    .maybeSingle()
  if (existing.data?.id) return existing.data.id as string
  const inserted = await admin
    .from('categories')
    .insert({ book_id: bookId, name })
    .select('id')
    .single()
  if (inserted.data?.id) return inserted.data.id as string
  const retry = await admin
    .from('categories')
    .select('id')
    .eq('book_id', bookId)
    .eq('name', name)
    .maybeSingle()
  if (retry.data?.id) return retry.data.id as string
  throw new Error(`Could not create category "${name}"`)
}

export async function runImport(admin: SupabaseClient, build: BuildResult): Promise<ImportResult> {
  const pending = build.rows
    .filter((r): r is PreviewRow & { candidate: Candidate } => r.candidate !== null)
    .map((r) => r.candidate)

  const skippedInvalid = build.rows.length - pending.length
  if (pending.length === 0) {
    return { imported: 0, skippedDuplicates: 0, skippedInvalid, books: [], categories: [] }
  }

  const hashes = await hashCandidates(admin, pending)
  const existing = await existingHashes(admin, Array.from(new Set(hashes)))
  const fresh: Candidate[] = []
  let skippedDuplicates = 0
  pending.forEach((candidate, i) => {
    if (existing.has(hashes[i])) skippedDuplicates++
    else fresh.push(candidate)
  })
  if (fresh.length === 0) {
    return { imported: 0, skippedDuplicates, skippedInvalid, books: [], categories: [] }
  }

  const bookIds = new Map<string, string>()
  const categoryIds = new Map<string, string>()
  for (const candidate of fresh) {
    if (!bookIds.has(candidate.book)) {
      bookIds.set(candidate.book, await ensureBook(admin, candidate.book))
    }
    const bookId = bookIds.get(candidate.book)!
    const key = `${bookId}::${candidate.category}`
    if (!categoryIds.has(key)) {
      categoryIds.set(key, await ensureCategory(admin, bookId, candidate.category))
    }
  }

  const rows = fresh.map((candidate) => {
    const bookId = bookIds.get(candidate.book)!
    const categoryId = categoryIds.get(`${bookId}::${candidate.category}`)!
    const options: Record<string, string> = {}
    for (const key of OPTION_KEYS) options[key] = candidate.options[key]
    return {
      book_id: bookId,
      category_id: categoryId,
      question_en: candidate.question_en,
      question_ur: candidate.question_ur,
      options,
      correct_text: candidate.correct_text,
      explanation: candidate.explanation,
      source_ref: candidate.source_ref,
    }
  })

  let imported = 0
  for (let i = 0; i < rows.length; i += 150) {
    const chunk = rows.slice(i, i + 150)
    const { data, error } = await admin
      .from('mcqs')
      .upsert(chunk, { onConflict: 'content_hash', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`Insert failed: ${error.message}`)
    imported += (data ?? []).length
  }

  return {
    imported,
    skippedDuplicates: skippedDuplicates + (rows.length - imported),
    skippedInvalid,
    books: Array.from(bookIds.keys()),
    categories: Array.from(new Set(fresh.map((c) => c.category))),
  }
}
