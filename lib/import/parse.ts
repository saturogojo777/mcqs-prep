// Pure parsing + validation logic shared by the admin preview and import routes.
// No Next.js or database imports here on purpose, so it can be unit tested directly.

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const
export type OptionKey = (typeof OPTION_KEYS)[number]
export type Options = Record<OptionKey, string>

export type Candidate = {
  book: string
  category: string
  subject: string | null
  exams: string[]
  question_en: string
  question_ur: string | null
  options: Options
  correct_text: string
  explanation: string | null
  source_ref: string | null
}

export type RowStatus = 'new' | 'duplicate' | 'invalid'

export type PreviewRow = {
  line: number
  status: RowStatus
  question_en: string
  book: string
  category: string
  subject: string | null
  answer: string
  messages: string[]
  candidate: Candidate | null
}

export type BuildResult = {
  rows: PreviewRow[]
  summary: { total: number; valid: number; invalid: number; inFileDuplicates: number }
}

const MAX_ROWS = 5000

// ---------------------------------------------------------------- delimited

/** Split CSV/TSV text into a matrix. Handles quotes, escaped quotes and newlines in cells. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const firstLine = clean.split('\n', 1)[0] ?? ''
  const delimiter = firstLine.includes('\t') ? '\t' : ','

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"' && cell.trim() === '') {
      quoted = true
      cell = ''
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  row.push(cell)
  rows.push(row)
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const normHeader = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

const ALIASES: Record<string, string[]> = {
  book: ['book', 'book_title', 'booktitle', 'book_name'],
  category: ['category', 'topic', 'chapter', 'section', 'category_name'],
  question_en: ['question_en', 'question', 'question_english', 'english', 'question_text', 'q'],
  question_ur: ['question_ur', 'question_urdu', 'urdu', 'urdu_question', 'question_ur_'],
  a: ['a', 'option_a', 'optiona', 'opt_a', 'opt_a_', 'option1', 'option_1', '1'],
  b: ['b', 'option_b', 'optionb', 'opt_b', 'opt_b_', 'option2', 'option_2', '2'],
  c: ['c', 'option_c', 'optionc', 'opt_c', 'opt_c_', 'option3', 'option_3', '3'],
  d: ['d', 'option_d', 'optiond', 'opt_d', 'opt_d_', 'option4', 'option_4', '4'],
  correct: ['correct_answer', 'correct', 'answer', 'correct_option', 'ans', 'correct_text'],
  subject: ['subject', 'subject_name', 'topic_subject'],
  exams: ['exams', 'exam', 'exam_name', 'test'],
  explanation: ['explanation', 'explain', 'note', 'notes', 'reason'],
  source_ref: ['id', 'source_ref', 'ref', 'number', 'no'],
}

function mapHeader(header: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  header.forEach((raw, index) => {
    const h = normHeader(raw)
    for (const [field, names] of Object.entries(ALIASES)) {
      if (map[field] === undefined && names.includes(h)) map[field] = index
    }
  })
  return map
}

// ---------------------------------------------------------------- validation

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())

/** Exams may arrive as an array, a comma separated string or a single name. */
export function normalizeExams(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  const clean = list
    .map((entry) => trim(entry).slice(0, 60))
    .filter(Boolean)
  return Array.from(new Set(clean)).slice(0, 20)
}

export function validateCandidate(input: {
  book?: unknown
  category?: unknown
  subject?: unknown
  exams?: unknown
  question_en?: unknown
  question_ur?: unknown
  options?: unknown
  correct_answer?: unknown
  explanation?: unknown
  source_ref?: unknown
}): { candidate: Candidate | null; errors: string[] } {
  const errors: string[] = []

  const book = trim(input.book)
  const subject = trim(input.subject)
  // A book import only needs to say which subject it belongs to; the category
  // then follows the subject instead of blocking the row.
  const category = trim(input.category) || subject
  const exams = normalizeExams(input.exams)
  const questionEn = trim(input.question_en).replace(/\s+/g, ' ')
  const questionUr = trim(input.question_ur)
  const explanation = trim(input.explanation)
  const sourceRef = trim(input.source_ref)

  if (!book) errors.push('Book title is missing')
  else if (book.length > 120) errors.push('Book title is too long (max 120)')
  if (!category) errors.push('Category is missing')
  else if (category.length > 120) errors.push('Category is too long (max 120)')

  if (!questionEn) errors.push('Question text is missing')
  else if (questionEn.length < 4) errors.push('Question text is too short')
  else if (questionEn.length > 1000) errors.push('Question text is too long (max 1000)')

  // Accept {A,B,C,D}, {a,b,c,d}, ["..","..","..",".."] or an already-flat object.
  const raw = input.options
  const opts: Options = { A: '', B: '', C: '', D: '' }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of OPTION_KEYS) {
      const source = raw as Record<string, unknown>
      opts[key] = trim(source[key] ?? source[key.toLowerCase()])
    }
  } else if (Array.isArray(raw)) {
    OPTION_KEYS.forEach((key, i) => (opts[key] = trim(raw[i])))
  }

  const filled = OPTION_KEYS.filter((k) => opts[k] !== '')
  for (const key of OPTION_KEYS) {
    if (!opts[key]) errors.push(`Option ${key} is empty`)
    else if (opts[key].length > 500) errors.push(`Option ${key} is too long (max 500)`)
  }

  const seen = new Map<string, OptionKey>()
  for (const key of filled) {
    const fingerprint = opts[key].toLowerCase()
    const prior = seen.get(fingerprint)
    if (prior) {
      errors.push(`Options ${prior} and ${key} are identical`)
    } else seen.set(fingerprint, key)
  }

  // The answer may be given as a letter (A-D / 1-4) or as the exact option text.
  // It is always resolved to option TEXT, never stored as a letter.
  const answerRaw = trim(input.correct_answer)
  let correctText = ''
  if (!answerRaw) {
    errors.push('Correct answer is missing')
  } else {
    const byText = filled.find((k) => opts[k].toLowerCase() === answerRaw.toLowerCase())
    const letter = answerRaw.toUpperCase().replace(/[\s.)\-]/g, '')
    if (byText) correctText = opts[byText]
    else if (/^[A-D]$/.test(letter)) correctText = opts[letter as OptionKey]
    else if (/^[1-4]$/.test(letter)) correctText = opts[OPTION_KEYS[Number(letter) - 1]]
    else if (/^OPTION[A-D]$/.test(letter)) correctText = opts[letter.slice(-1) as OptionKey]

    if (!correctText) {
      errors.push(`Answer "${answerRaw.slice(0, 40)}" does not match any option`)
    }
  }

  if (errors.length > 0) return { candidate: null, errors }

  return {
    candidate: {
      book,
      category,
      subject: subject ? subject.slice(0, 80) : null,
      exams,
      question_en: questionEn,
      question_ur: questionUr || null,
      options: opts,
      correct_text: correctText,
      explanation: explanation || null,
      source_ref: sourceRef || null,
    },
    errors: [],
  }
}

// ---------------------------------------------------------------- builders

export type Defaults = { book?: string; category?: string; subject?: string; exams?: string[] }

/** In-file duplicate fingerprint (question text + option set), independent of order. */
export function fingerprint(c: Candidate): string {
  const q = c.question_en.toLowerCase().replace(/\s+/g, ' ').replace(/^ | $/g, '')
  const opts = OPTION_KEYS.map((k) => c.options[k].toLowerCase().replace(/^ | $/g, '')).sort()
  return `${q}|${opts.join('|')}`
}

/** First non-empty value wins, so blank cells fall back to the defaults. */
function firstFilled(...values: unknown[]): unknown {
  for (const value of values) {
    if (value == null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    return value
  }
  return ''
}

function fromObject(obj: Record<string, unknown>, defaults: Defaults) {
  return validateCandidate({
    book: trim(firstFilled(obj.book, obj.book_title, defaults.book)),
    category: trim(firstFilled(obj.category, obj.topic, obj.chapter, defaults.category)),
    subject: trim(firstFilled(obj.subject, obj.subject_name, defaults.subject)),
    exams: firstFilled(obj.exams, obj.exam, defaults.exams),
    question_en: obj.question_en ?? obj.question ?? obj.question_english ?? obj.question_text,
    question_ur: obj.question_ur ?? obj.question_urdu ?? obj.urdu,
    options: obj.options ?? {
      A: obj.a ?? obj.option_a ?? obj.option1,
      B: obj.b ?? obj.option_b ?? obj.option2,
      C: obj.c ?? obj.option_c ?? obj.option3,
      D: obj.d ?? obj.option_d ?? obj.option4,
    },
    correct_answer: obj.correct_answer ?? obj.correct ?? obj.answer ?? obj.ans,
    explanation: obj.explanation ?? obj.note,
    source_ref: obj.source_ref ?? obj.id ?? obj.ref,
  })
}

function subjectOf(obj: Record<string, unknown>, defaults: Defaults): string | null {
  const value = trim(firstFilled(obj.subject, obj.subject_name, defaults.subject))
  return value || null
}

function buildFromObjects(objects: Record<string, unknown>[], defaults: Defaults): BuildResult {
  const rows: PreviewRow[] = []
  const seen = new Map<string, number>()
  let inFileDuplicates = 0

  objects.forEach((obj, i) => {
    const { candidate, errors } = fromObject(obj, defaults)
    const line = i + 1
    if (!candidate) {
      rows.push({
        line,
        status: 'invalid',
        question_en: trim(obj.question_en ?? obj.question ?? ''),
        book: trim(obj.book ?? defaults.book),
        category: trim(obj.category ?? defaults.category),
        subject: subjectOf(obj, defaults),
        answer: trim(obj.correct_answer ?? obj.correct ?? obj.answer ?? ''),
        messages: errors,
        candidate: null,
      })
      return
    }
    const fp = fingerprint(candidate)
    const first = seen.get(fp)
    if (first) {
      inFileDuplicates++
      rows.push({
        line,
        status: 'duplicate',
        question_en: candidate.question_en,
        book: candidate.book,
        category: candidate.category,
        subject: candidate.subject,
        answer: candidate.correct_text,
        messages: [`Duplicate of row ${first} in this file`],
        candidate: null,
      })
      return
    }
    seen.set(fp, line)
    rows.push({
      line,
      status: 'new',
      question_en: candidate.question_en,
      book: candidate.book,
      category: candidate.category,
      subject: candidate.subject,
      answer: candidate.correct_text,
      messages: [],
      candidate,
    })
  })

  const invalid = rows.filter((r) => r.status === 'invalid').length
  return {
    rows,
    summary: { total: rows.length, valid: rows.length - invalid, invalid, inFileDuplicates },
  }
}

/** Parse a JSON array of objects (the original dataset shape or a flat shape). */
export function parseJsonInput(text: string, defaults: Defaults): BuildResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return {
      rows: [
        {
          line: 1,
          status: 'invalid',
          question_en: '',
          book: '',
          category: '',
          subject: null,
          answer: '',
          messages: ['File is not valid JSON'],
          candidate: null,
        },
      ],
      summary: { total: 1, valid: 0, invalid: 1, inFileDuplicates: 0 },
    }
  }
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { mcqs?: unknown })?.mcqs)
      ? ((data as { mcqs: unknown[] }).mcqs as unknown[])
      : Array.isArray((data as { rows?: unknown })?.rows)
        ? ((data as { rows: unknown[] }).rows as unknown[])
        : null

  if (!list) {
    return {
      rows: [
        {
          line: 1,
          status: 'invalid',
          question_en: '',
          book: '',
          category: '',
          subject: null,
          answer: '',
          messages: ['JSON must be an array of questions'],
          candidate: null,
        },
      ],
      summary: { total: 1, valid: 0, invalid: 1, inFileDuplicates: 0 },
    }
  }
  return buildFromObjects(list.slice(0, MAX_ROWS) as Record<string, unknown>[], defaults)
}

/** Parse CSV/TSV text with a header row. */
export function parseTableInput(text: string, defaults: Defaults): BuildResult {
  const matrix = parseDelimited(text)
  if (matrix.length === 0) {
    return {
      rows: [],
      summary: { total: 0, valid: 0, invalid: 0, inFileDuplicates: 0 },
    }
  }
  const header = mapHeader(matrix[0])
  const required = ['question_en', 'a', 'b', 'c', 'd', 'correct'] as const
  const missing = required.filter((f) => header[f] === undefined)
  if (missing.length > 0) {
    const friendly: Record<string, string> = {
      question_en: 'question_en',
      a: 'option_a',
      b: 'option_b',
      c: 'option_c',
      d: 'option_d',
      correct: 'correct_answer',
    }
    return {
      rows: [
        {
          line: 1,
          status: 'invalid',
          question_en: '',
          book: '',
          category: '',
          subject: null,
          answer: '',
          messages: [`Missing column(s): ${missing.map((m) => friendly[m]).join(', ')}`],
          candidate: null,
        },
      ],
      summary: { total: 1, valid: 0, invalid: 1, inFileDuplicates: 0 },
    }
  }

  const objects = matrix.slice(1, MAX_ROWS + 1).map((cells) => {
    const get = (field: string) => (header[field] === undefined ? '' : (cells[header[field]] ?? ''))
    return {
      book: get('book'),
      category: get('category'),
      subject: get('subject'),
      exams: get('exams'),
      question_en: get('question_en'),
      question_ur: get('question_ur'),
      options: { A: get('a'), B: get('b'), C: get('c'), D: get('d') },
      correct_answer: get('correct'),
      explanation: get('explanation'),
      source_ref: get('source_ref'),
    }
  })

  return buildFromObjects(objects, defaults)
}

/** Auto detect: JSON if it starts with [ or {, otherwise the sheet/CSV reader. */
export function parseInput(text: string, defaults: Defaults): BuildResult {
  const head = text.replace(/^\uFEFF/, '').trimStart()
  if (head.startsWith('[') || head.startsWith('{')) return parseJsonInput(text, defaults)
  return parseTableInput(text, defaults)
}

/** Turn a Google Sheets link into a CSV export link. Returns null when unusable. */
export function toSheetCsvUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.hostname !== 'docs.google.com') return null

  // Published-to-web links already return data.
  if (url.pathname.includes('/spreadsheets/d/e/')) {
    const id = url.pathname.split('/spreadsheets/d/e/')[1]
    if (!id) return null
    url.searchParams.set('output', 'csv')
    return `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv&single=true`
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) return null
  const gid = url.searchParams.get('gid') ?? (url.hash.match(/gid=(\d+)/)?.[1] ?? '0')
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`
}
