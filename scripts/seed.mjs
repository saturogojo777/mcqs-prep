// Seeds the library: the legacy book plus every validated content/*.json batch.
// Runs on Vercel during the build (see "vercel-build") and locally via `npm run seed`.
// Idempotent: duplicates are rejected by the unique content_hash index.
//
// Tagging mirrors supabase/20261106_retag.sql exactly:
//   one primary subject per MCQ; exam pools from subject relevance x level band.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

// The canonical book from supabase/20261105_professional.sql. The demo book
// used to be called "General Knowledge (500 Questions)"; that title is gone and
// must not be re-created, or the site ends up with an empty duplicate book.
const BOOK_TITLE = 'General Knowledge'
const BOOK_DESCRIPTION = 'General knowledge, Pakistan affairs, science and everyday awareness.'

// Subject tags for the seeded book, mirroring supabase/20261105_dailytest.sql.
const SUBJECT_BY_CATEGORY = {
  'Pakistan GK & Constitution': 'pakistan-studies',
  'Pakistan Geography & Symbols': 'geography',
  'International Organizations & Days': 'current-affairs',
}

function subjectSlugFor(item, category) {
  if (category === 'Science & Computer') return item.id <= 350 ? 'everyday-science' : 'computer-skills'
  if (category === 'Math & English') return item.id <= 450 ? 'mathematics' : 'english'
  return SUBJECT_BY_CATEGORY[category] ?? 'general-knowledge'
}

// Level bands per exam family (see supabase/20261106_retag.sql).
const BROAD = ['ppsc', 'spsc', 'police', 'teachers']
const FEDERAL = ['fpsc', 'nts-pts-ots']
const FORCES_SUBJECTS = new Set(['general-knowledge', 'pakistan-studies', 'islamic-studies', 'mathematics', 'english', 'everyday-science'])
const CSS_SUBJECTS = new Set(['general-knowledge', 'pakistan-studies', 'islamic-studies', 'current-affairs', 'mathematics', 'english', 'everyday-science'])
const MDCAT_SUBJECTS = new Set(['everyday-science', 'mathematics', 'english'])

function examsFor(subject, level) {
  const out = new Set()
  if (level === 'basic' || level === 'intermediate') {
    for (const slug of BROAD) out.add(slug)
    if (subject !== 'urdu') for (const slug of FEDERAL) out.add(slug)
    if (FORCES_SUBJECTS.has(subject)) out.add('forces')
  }
  if (level === 'intermediate' || level === 'advanced') {
    if (CSS_SUBJECTS.has(subject)) out.add('css-pms')
    if (MDCAT_SUBJECTS.has(subject)) out.add('mdcat-ecat')
  }
  return [...out]
}

const CATEGORY_RANGES = [
  { from: 1, to: 100, name: 'Pakistan GK & Constitution' },
  { from: 101, to: 200, name: 'Pakistan Geography & Symbols' },
  { from: 201, to: 300, name: 'International Organizations & Days' },
  { from: 301, to: 400, name: 'Science & Computer' },
  { from: 401, to: 500, name: 'Math & English' },
]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function log(...args) {
  console.log('[seed]', ...args)
}

if (!url || !serviceKey) {
  log('skipped: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(0)
}

// Per-question audit: source id -> [difficulty, level].
const TIER_OF = new Map()
try {
  const audit = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/audit/difficulty-489.json'), 'utf8'))
  for (const id of audit.easy ?? []) TIER_OF.set(Number(id), ['easy', 'basic'])
  for (const id of audit.medium ?? []) TIER_OF.set(Number(id), ['medium', 'intermediate'])
  for (const id of audit.hard ?? []) TIER_OF.set(Number(id), ['hard', 'advanced'])
} catch {
  log('audit file missing, legacy rows keep database defaults')
}
const REVIEW_OF = new Set()
try {
  const audit = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/audit/difficulty-489.json'), 'utf8'))
  for (const id of audit.needs_review ?? []) REVIEW_OF.add(Number(id))
} catch {
  /* ignore */
}

const file = path.join(process.cwd(), 'data', 'mcqs_all_1to500.json')
if (!fs.existsSync(file)) {
  log('dataset not found, nothing to do:', file)
  process.exit(0)
}

const raw = JSON.parse(fs.readFileSync(file, 'utf8'))

// Normalise the source rows. The answer is stored as option TEXT so that the
// client can shuffle options and still mark the right one.
const rows = []
let skippedSource = 0
for (const item of raw) {
  const id = Number(item.id)
  const options = item.options ?? {}
  const letter = String(item.correct_answer ?? '').trim().toUpperCase()
  const correctText = options[letter]
  if (!item.question_en || !options.A || !options.B || !options.C || !options.D || !correctText) {
    skippedSource++
    continue
  }
  const range = CATEGORY_RANGES.find((r) => id >= r.from && id <= r.to)
  const category = range ? range.name : 'Other'
  const [difficulty, level] = TIER_OF.get(id) ?? ['medium', 'intermediate']
  rows.push({
    id,
    category,
    subject: subjectSlugFor(item, category),
    question_en: String(item.question_en).trim().replace(/\s+/g, ' '),
    question_ur: item.question_ur ? String(item.question_ur).trim() : null,
    options: {
      A: String(options.A).trim(),
      B: String(options.B).trim(),
      C: String(options.C).trim(),
      D: String(options.D).trim(),
    },
    correct_text: String(correctText).trim(),
    source_ref: String(id),
    difficulty,
    level,
    review_status: REVIEW_OF.has(id) ? 'needs_review' : 'ai_verified',
  })
}

// Phase-3 content batches (already validated by scripts/validate-content.mjs).
function contentBatches() {
  const dir = path.join(process.cwd(), 'content')
  const batches = []
  if (!fs.existsSync(dir)) return batches
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.name === 'audit') continue
      const full = path.join(folder, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.json')) {
        const bookDir = path.basename(path.dirname(full))
        const title = bookDir.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
        batches.push({ title, rows: JSON.parse(fs.readFileSync(full, 'utf8')) })
      }
    }
  }
  walk(dir)
  return batches
}

// Local uniqueness check, mirroring the database hash (question + sorted options,
// lower cased, spaces trimmed) so the log shows the real expected total.
const normalise = (value) => String(value).replace(/^ +| +$/g, '').toLowerCase()
const uniqueKeys = new Set(
  rows.map((row) =>
    [
      normalise(row.question_en),
      ...Object.values(row.options).map(normalise).sort(),
    ].join('|'),
  ),
)

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function ensureBook(title, description = null) {
  const found = await supabase.from('books').select('id').eq('title', title).maybeSingle()
  if (found.data?.id) return found.data.id
  const inserted = await supabase
    .from('books')
    .insert(description ? { title, description } : { title })
    .select('id')
    .single()
  if (inserted.data?.id) return inserted.data.id
  const retry = await supabase.from('books').select('id').eq('title', title).maybeSingle()
  if (retry.data?.id) return retry.data.id
  throw new Error(`could not create book: ${inserted.error?.message ?? 'unknown error'}`)
}

async function ensureCategory(bookId, name) {
  const found = await supabase
    .from('categories')
    .select('id')
    .eq('book_id', bookId)
    .eq('name', name)
    .maybeSingle()
  if (found.data?.id) return found.data.id
  const inserted = await supabase
    .from('categories')
    .insert({ book_id: bookId, name })
    .select('id')
    .single()
  if (inserted.data?.id) return inserted.data.id
  const retry = await supabase
    .from('categories')
    .select('id')
    .eq('book_id', bookId)
    .eq('name', name)
    .maybeSingle()
  if (retry.data?.id) return retry.data.id
  throw new Error(`could not create category "${name}": ${inserted.error?.message ?? 'unknown error'}`)
}

async function tagQuestions(links, table, leftKey, rightKey) {
  const clean = links.filter((row) => row[leftKey] && row[rightKey])
  for (let i = 0; i < clean.length; i += 500) {
    const { error } = await supabase
      .from(table)
      .upsert(clean.slice(i, i + 500), { onConflict: `${leftKey},${rightKey}`, ignoreDuplicates: true })
    if (error) throw new Error(`tagging failed: ${error.message}`)
  }
  return clean.length
}

async function main() {
  log(`dataset rows: ${raw.length}, usable: ${rows.length}, unique: ${uniqueKeys.size}, skipped: ${skippedSource}`)

  const bookId = await ensureBook(BOOK_TITLE, BOOK_DESCRIPTION)
  const categoryIds = new Map()
  for (const range of CATEGORY_RANGES) {
    categoryIds.set(range.name, await ensureCategory(bookId, range.name))
  }

  const countResult = await supabase
    .from('mcqs')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId)

  const existing = countResult.count ?? 0
  if (existing < uniqueKeys.size) {
    let inserted = 0
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100).map((row) => ({
        book_id: bookId,
        category_id: categoryIds.get(row.category),
        question_en: row.question_en,
        question_ur: row.question_ur,
        options: row.options,
        correct_text: row.correct_text,
        source_ref: row.source_ref,
        difficulty: row.difficulty,
        level: row.level,
        review_status: row.review_status,
      }))
      const { data, error } = await supabase
        .from('mcqs')
        .upsert(chunk, { onConflict: 'content_hash', ignoreDuplicates: true })
        .select('id')
      if (error) throw new Error(`insert failed: ${error.message}`)
      inserted += (data ?? []).length
    }
    log(`inserted ${inserted} legacy rows`)
  } else {
    log(`legacy book already imported (${existing} rows), skipping inserts`)
  }

  // Backfill the audit tiers on rows that predate the audit, then tag.
  const [{ data: subjects }, { data: exams }] = await Promise.all([
    supabase.from('subjects').select('id, slug'),
    supabase.from('exams').select('id, slug'),
  ])
  if (!subjects?.length || !exams?.length) {
    log('taxonomy missing, skipping tags')
    return
  }
  const subjectIds = new Map(subjects.map((row) => [row.slug, row.id]))
  const examIds = new Map(exams.map((row) => [row.slug, row.id]))

  const { data: legacy, error: legacyError } = await supabase
    .from('mcqs')
    .select('id, source_ref, level')
    .eq('book_id', bookId)
  if (legacyError) throw new Error(`tagging failed: ${legacyError.message}`)

  // One primary subject per MCQ (legacy rows keyed by numeric source_ref).
  const subjectLinks = []
  const examLinks = []
  for (const question of legacy ?? []) {
    const sourceId = Number(question.source_ref)
    if (!Number.isFinite(sourceId)) continue
    const row = rows.find((entry) => entry.id === sourceId)
    if (!row) continue
    subjectLinks.push({ mcq_id: question.id, subject_id: subjectIds.get(row.subject) })
    for (const slug of examsFor(row.subject, row.level)) {
      examLinks.push({ mcq_id: question.id, exam_id: examIds.get(slug) })
    }
  }
  // Fresh inserts already carry the audit tier; production was backfilled by
  // supabase/20261106_retag.sql, so no per-row update is needed here.
  const sCount = await tagQuestions(subjectLinks, 'mcq_subjects', 'mcq_id', 'subject_id')
  const eCount = await tagQuestions(examLinks, 'mcq_exams', 'mcq_id', 'exam_id')
  log(`legacy tags: ${sCount} subject links, ${eCount} exam links`)

  // Content batches carry their own chapter/subject/difficulty/exam tags.
  for (const batch of contentBatches()) {
    const contentBookId = await ensureBook(batch.title)
    let added = 0
    for (const row of batch.rows) {
      const values = ['A', 'B', 'C', 'D'].map((key) => String(row.options?.[key] ?? '').trim())
      if (!row.question_en || values.some((v) => !v)) continue
      const categoryId = await ensureCategory(contentBookId, row.chapter?.trim() || 'General')
      const { data, error } = await supabase
        .from('mcqs')
        .upsert(
          {
            book_id: contentBookId,
            category_id: categoryId,
            question_en: String(row.question_en).trim(),
            question_ur: row.question_ur ? String(row.question_ur).trim() : null,
            options: { A: values[0], B: values[1], C: values[2], D: values[3] },
            correct_text: String(row.correct_text).trim(),
            explanation: row.explanation ? String(row.explanation).trim() : null,
            source_ref: row.source_ref ?? null,
            difficulty: row.difficulty ?? 'medium',
            level: row.level ?? 'intermediate',
            review_status: row.review_status ?? 'ai_verified',
          },
          { onConflict: 'content_hash', ignoreDuplicates: true },
        )
        .select('id')
      if (error) throw new Error(`content insert failed: ${error.message}`)
      const id = data?.[0]?.id
      if (!id) continue
      added++
      const links = []
      if (row.subject && subjectIds.get(row.subject)) {
        links.push(supabase.from('mcq_subjects').upsert({ mcq_id: id, subject_id: subjectIds.get(row.subject) }, { onConflict: 'mcq_id,subject_id', ignoreDuplicates: true }))
      }
      for (const slug of row.exams ?? []) {
        if (examIds.get(slug)) {
          links.push(supabase.from('mcq_exams').upsert({ mcq_id: id, exam_id: examIds.get(slug) }, { onConflict: 'mcq_id,exam_id', ignoreDuplicates: true }))
        }
      }
      await Promise.all(links)
    }
    log(`content "${batch.title}": ${added} new rows`)
  }
}

main().catch((error) => {
  console.error('[seed] failed:', error)
  process.exit(1)
})
