// Local stand-in for the Supabase REST API, for design QA and the admin import
// demo. It serves exactly the endpoints the app calls, backed by the real
// question file in data/, with the same subject / exam tagging as production.
//
//   node scripts/dev/mock-supabase.mjs          # listens on 127.0.0.1:3101
//
// Then point the app at it: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3101

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const PORT = Number(process.env.MOCK_PORT ?? 3101)
const dataset = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/mcqs_all_1to500.json'), 'utf8'))

const SUBJECTS = [
  ['general-knowledge', 'General Knowledge', 'عمومی معلومات', 1],
  ['pakistan-studies', 'Pakistan Studies', 'مطالعہ پاکستان', 2],
  ['islamic-studies', 'Islamic Studies', 'اسلامیات', 3],
  ['current-affairs', 'Current Affairs', 'حالاتِ حاضرہ', 4],
  ['geography', 'Geography', 'جغرافیہ', 5],
  ['mathematics', 'Mathematics', 'ریاضی', 6],
  ['english', 'English', 'انگریزی', 7],
  ['urdu', 'Urdu', 'اردو', 8],
  ['everyday-science', 'Everyday Science', 'روزمرہ سائنس', 9],
  ['computer-skills', 'Computer Skills', 'کمپیوٹر', 10],
].map(([slug, name, name_ur, sort]) => ({ id: `s-${slug}`, slug, name, name_ur, sort }))

const EXAMS = [
  ['ppsc', 'PPSC', 'پی پی ایس سی'],
  ['fpsc', 'FPSC', 'ایف پی ایس سی'],
  ['spsc', 'SPSC', 'ایس پی ایس سی'],
  ['nts-pts-ots', 'NTS/PTS/OTS', 'این ٹی ایس / پی ٹی ایس / او ٹی ایس'],
  ['css-pms', 'CSS/PMS', 'سی ایس ایس / پی ایم ایس'],
  ['mdcat-ecat', 'MDCAT/ECAT', 'ایم ڈی کیٹ / ای سی اے ٹی'],
  ['forces', 'Forces', 'دفاعی محکمے'],
  ['police', 'Police', 'پولیس'],
  ['teachers', 'Teachers', 'اساتذہ'],
].map(([slug, name, name_ur], index) => ({ id: `e-${slug}`, slug, name, name_ur, sort: index + 1 }))

const CATEGORY_RANGES = [
  { from: 1, to: 100, name: 'Pakistan GK & Constitution' },
  { from: 101, to: 200, name: 'Pakistan Geography & Symbols' },
  { from: 201, to: 300, name: 'International Organizations & Days' },
  { from: 301, to: 400, name: 'Science & Computer' },
  { from: 401, to: 500, name: 'Math & English' },
]

const BOOK = { id: 'b-general-knowledge', title: 'General Knowledge (500 Questions)' }

function subjectsFor(id, category) {
  if (category === 'Science & Computer') return [id <= 350 ? 'everyday-science' : 'computer-skills']
  if (category === 'Math & English') return [id <= 450 ? 'mathematics' : 'english']
  const map = {
    'Pakistan GK & Constitution': 'pakistan-studies',
    'Pakistan Geography & Symbols': 'geography',
    'International Organizations & Days': 'current-affairs',
  }
  return map[category] ? [map[category]] : []
}

const questions = []
for (const item of dataset) {
  const range = CATEGORY_RANGES.find((entry) => item.id >= entry.from && item.id <= entry.to)
  const letter = String(item.correct_answer ?? '').trim().toUpperCase()
  const correct = item.options?.[letter]
  if (!range || !correct) continue
  questions.push({
    id: `q-${item.id}`,
    book_id: BOOK.id,
    question_en: item.question_en,
    question_ur: item.question_ur ?? null,
    options: item.options,
    correct_text: correct,
    explanation: null,
    source_ref: String(item.id),
    subjects: ['general-knowledge', ...subjectsFor(item.id, range.name)],
    exams: EXAMS.map((exam) => exam.slug),
  })
}

/** jsonb question + sorted, lower-cased options — the same idea as the SQL hash. */
function contentHash(questionEn, options) {
  const norm = (value) => String(value ?? '').trim().toLowerCase()
  const optionText = ['A', 'B', 'C', 'D'].map((key) => norm(options?.[key])).sort().join('|')
  return crypto.createHash('sha1').update(`${norm(questionEn)}|${optionText}`).digest('hex')
}

const knownHashes = new Set(questions.map((row) => contentHash(row.question_en, row.options)))

function shuffle(list) {
  const copy = list.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function filterPool(kind, key) {
  if (kind === 'exam') return questions.filter((row) => row.exams.includes(key))
  if (kind === 'subject') return questions.filter((row) => row.subjects.includes(key))
  if (kind === 'book') return questions.filter((row) => row.book_id === key)
  return questions
}

const shape = (row) => ({
  id: row.id,
  question_en: row.question_en,
  question_ur: row.question_ur,
  options: row.options,
  correct_text: row.correct_text,
  explanation: row.explanation,
})

function subjectCatalog() {
  return SUBJECTS.map((subject) => ({
    ...subject,
    question_count: questions.filter((row) => row.subjects.includes(subject.slug)).length,
  }))
}

function examCatalog() {
  return EXAMS.map((exam) => ({
    ...exam,
    question_count: questions.filter((row) => row.exams.includes(exam.slug)).length,
  }))
}

function bookCatalog() {
  const books = [...new Map(questions.map((row) => [row.book_id, row.book_id])).keys()]
  return books.map((id) => ({
    id,
    title: id === BOOK.id ? BOOK.title : (extraBooks.get(id) ?? id),
    question_count: questions.filter((row) => row.book_id === id).length,
  }))
}

const extraBooks = new Map()
const messages = []

function rpc(name, body) {
  if (name === 'random_questions') {
    const pool = shuffle(filterPool(body.p_kind, body.p_key))
    return pool.slice(0, Math.max(1, Math.min(Number(body.p_limit) || 10, 500))).map(shape)
  }
  if (name === 'daily_questions') {
    const seed = String(body.p_seed ?? '')
    const ordered = questions
      .map((row) => ({ row, key: crypto.createHash('md5').update(row.id + seed).digest('hex') }))
      .sort((a, b) => (a.key < b.key ? -1 : 1))
    return ordered.slice(0, Number(body.p_limit) || 10).map((entry) => shape(entry.row))
  }
  if (name === 'questions_by_ids') {
    const ids = new Set(body.p_ids ?? [])
    return questions.filter((row) => ids.has(row.id)).map(shape)
  }
  if (name === 'mcq_hash_rows') {
    return (body.rows ?? []).map((row, index) => ({
      ord: index,
      hash: contentHash(row.question_en, row.options),
    }))
  }
  if (name === 'import_book') {
    const book = body.p_book ?? {}
    const title = String(book.title ?? '').trim()
    const bookId = `b-${crypto.createHash('sha1').update(title).digest('hex').slice(0, 10)}`
    if (!extraBooks.has(bookId)) extraBooks.set(bookId, title)
    let imported = 0
    let skipped = 0
    let invalid = 0
    for (const row of body.p_rows ?? []) {
      if (!row.question_en || !row.correct_text) {
        invalid++
        continue
      }
      const hash = contentHash(row.question_en, row.options)
      if (knownHashes.has(hash)) {
        skipped++
        continue
      }
      knownHashes.add(hash)
      imported++
      questions.push({
        id: `q-new-${questions.length + 1}`,
        book_id: bookId,
        question_en: row.question_en,
        question_ur: row.question_ur ?? null,
        options: row.options,
        correct_text: row.correct_text,
        explanation: row.explanation ?? null,
        source_ref: row.source_ref ?? null,
        subjects: [book.subject].filter(Boolean),
        exams: row.exams ?? book.exams ?? [],
      })
    }
    return { book_id: bookId, imported, skipped, invalid }
  }
  return null
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`)
  const json = (status, payload) => {
    const body = JSON.stringify(payload)
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'content-range': `0-${Math.max(0, (Array.isArray(payload) ? payload.length : 1) - 1)}/${Array.isArray(payload) ? payload.length : 1}`,
    })
    response.end(body)
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    })
    return response.end()
  }

  let raw = ''
  request.on('data', (chunk) => {
    raw += chunk
  })
  request.on('end', () => {
    const table = url.pathname.replace('/rest/v1/', '')
    if (table.startsWith('rpc/')) {
      let payload = {}
      try {
        payload = raw ? JSON.parse(raw) : {}
      } catch {
        payload = {}
      }
      return json(200, rpc(table.slice(4), payload))
    }
    if (url.pathname === '/rest/v1/messages' && request.method === 'POST') {
      messages.push(JSON.parse(raw || '{}'))
      return json(201, [])
    }
    if (table === 'subject_catalog') return json(200, subjectCatalog())
    if (table === 'exam_catalog') return json(200, examCatalog())
    if (table === 'book_catalog') return json(200, bookCatalog())
    if (table === 'subjects') return json(200, SUBJECTS)
    if (table === 'exams') return json(200, EXAMS)
    if (table === 'mcqs') {
      // only the duplicate check queries this table: ?content_hash=in.(a,b,c)
      const filter = url.searchParams.get('content_hash') ?? ''
      const match = filter.match(/in\.\((.*)\)$/)
      const wanted = match ? match[1].split(',').map((value) => value.replace(/^"|"$/g, '').trim()) : []
      return json(200, wanted.filter((hash) => knownHashes.has(hash)).map((hash) => ({ content_hash: hash })))
    }
    if (url.pathname === '/__state') return json(200, { questions: questions.length, messages, books: bookCatalog() })
    return json(200, [])
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[mock-supabase] http://127.0.0.1:${PORT} — ${questions.length} questions, ${SUBJECTS.length} subjects`)
})
