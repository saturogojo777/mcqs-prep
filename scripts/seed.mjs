// Seeds the first book from data/mcqs_all_1to500.json.
// Runs on Vercel during the build (see "vercel-build") and locally via `npm run seed`.
// Idempotent: duplicates are rejected by the unique content_hash index.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const BOOK_TITLE = 'General Knowledge (500 Questions)'
const BOOK_DESCRIPTION = '500 general knowledge MCQs for Pakistani exam preparation.'

// Subject tags for the seeded book, mirroring supabase/20261105_dailytest.sql.
const SUBJECT_BY_CATEGORY = {
  'Pakistan GK & Constitution': 'pakistan-studies',
  'Pakistan Geography & Symbols': 'geography',
  'International Organizations & Days': 'current-affairs',
}

function subjectSlugsFor(item, category) {
  if (category === 'Science & Computer') {
    return [item.id <= 350 ? 'everyday-science' : 'computer-skills']
  }
  if (category === 'Math & English') {
    return [item.id <= 450 ? 'mathematics' : 'english']
  }
  const slug = SUBJECT_BY_CATEGORY[category]
  return slug ? [slug] : []
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
  rows.push({
    id,
    category,
    subjects: subjectSlugsFor(item, category),
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
  })
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

async function ensureBook() {
  const found = await supabase.from('books').select('id').eq('title', BOOK_TITLE).maybeSingle()
  if (found.data?.id) return found.data.id
  const inserted = await supabase
    .from('books')
    .insert({ title: BOOK_TITLE, description: BOOK_DESCRIPTION })
    .select('id')
    .single()
  if (inserted.data?.id) return inserted.data.id
  const retry = await supabase.from('books').select('id').eq('title', BOOK_TITLE).maybeSingle()
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

async function tagBook(bookId) {
  const [{ data: subjects }, { data: exams }] = await Promise.all([
    supabase.from('subjects').select('id, slug'),
    supabase.from('exams').select('id, slug'),
  ])
  if (!subjects?.length || !exams?.length) {
    log('taxonomy missing, skipping tags')
    return
  }
  const subjectIds = new Map(subjects.map((row) => [row.slug, row.id]))

  const { data: existingQuestions, error } = await supabase
    .from('mcqs')
    .select('id, source_ref, category_id')
    .eq('book_id', bookId)
  if (error) throw new Error(`tagging failed: ${error.message}`)

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('book_id', bookId)
  const categoryNames = new Map((categories ?? []).map((row) => [row.id, row.name]))

  const tags = []
  const examTags = []
  for (const question of existingQuestions ?? []) {
    const name = categoryNames.get(question.category_id)
    const range = CATEGORY_RANGES.find((entry) => entry.name === name)
    const sourceId = Number(question.source_ref)
    if (!range || !Number.isFinite(sourceId)) continue
    // general knowledge covers the whole book, then the specific subject
    tags.push({ mcq_id: question.id, subject_id: subjectIds.get('general-knowledge') })
    for (const slug of subjectSlugsFor({ id: sourceId }, name)) {
      tags.push({ mcq_id: question.id, subject_id: subjectIds.get(slug) })
    }
    for (const exam of exams) examTags.push({ mcq_id: question.id, exam_id: exam.id })
  }

  const clean = tags.filter((row) => row.subject_id)
  for (let i = 0; i < clean.length; i += 500) {
    const { error: tagError } = await supabase
      .from('mcq_subjects')
      .upsert(clean.slice(i, i + 500), { onConflict: 'mcq_id,subject_id', ignoreDuplicates: true })
    if (tagError) throw new Error(`tagging failed: ${tagError.message}`)
  }
  for (let i = 0; i < examTags.length; i += 500) {
    const { error: tagError } = await supabase
      .from('mcq_exams')
      .upsert(examTags.slice(i, i + 500), { onConflict: 'mcq_id,exam_id', ignoreDuplicates: true })
    if (tagError) throw new Error(`tagging failed: ${tagError.message}`)
  }
  log(`tags: ${clean.length} subject links, ${examTags.length} exam links`)
}

async function main() {
  log(`dataset rows: ${raw.length}, usable: ${rows.length}, unique: ${uniqueKeys.size}, skipped: ${skippedSource}`)

  const bookId = await ensureBook()
  const categoryIds = new Map()
  for (const range of CATEGORY_RANGES) {
    categoryIds.set(range.name, await ensureCategory(bookId, range.name))
  }

  const countResult = await supabase
    .from('mcqs')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId)

  const existing = countResult.count ?? 0
  if (existing >= uniqueKeys.size) {
    log(`already imported (${existing} rows in "${BOOK_TITLE}"), nothing to do`)
    return
  }

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
    }))
    const { data, error } = await supabase
      .from('mcqs')
      .upsert(chunk, { onConflict: 'content_hash', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`insert failed: ${error.message}`)
    inserted += (data ?? []).length
  }

  const finalCount = await supabase
    .from('mcqs')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId)

  log(`inserted ${inserted} new rows, "${BOOK_TITLE}" now holds ${finalCount.count ?? '?'} questions`)

  await tagBook(bookId)
}

main().catch((error) => {
  console.error('[seed] failed:', error)
  process.exit(1)
})
