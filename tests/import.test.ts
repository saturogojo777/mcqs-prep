import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  OPTION_KEYS,
  parseDelimited,
  parseInput,
  parseJsonInput,
  parseTableInput,
  toSheetCsvUrl,
  validateCandidate,
} from '../lib/import/parse.ts'

const HEADER = 'book,category,question_en,question_ur,option_a,option_b,option_c,option_d,correct_answer,explanation'

test('resolves a letter answer to option text', () => {
  const { candidate, errors } = validateCandidate({
    book: 'Book',
    category: 'Cat',
    question_en: 'Capital of Pakistan?',
    options: { A: 'Karachi', B: 'Lahore', C: 'Islamabad', D: 'Quetta' },
    correct_answer: 'C',
  })
  assert.deepEqual(errors, [])
  assert.equal(candidate?.correct_text, 'Islamabad')
})

test('accepts lowercase letters, "C." and numeric answers', () => {
  const base = {
    book: 'B',
    category: 'C',
    question_en: 'Pick the right one',
    options: { A: 'one', B: 'two', C: 'three', D: 'four' },
  }
  assert.equal(validateCandidate({ ...base, correct_answer: 'c' }).candidate?.correct_text, 'three')
  assert.equal(validateCandidate({ ...base, correct_answer: 'C.' }).candidate?.correct_text, 'three')
  assert.equal(validateCandidate({ ...base, correct_answer: '3' }).candidate?.correct_text, 'three')
  assert.equal(validateCandidate({ ...base, correct_answer: 'four' }).candidate?.correct_text, 'four')
})

test('rejects an answer that is not one of the options', () => {
  const { candidate, errors } = validateCandidate({
    book: 'B',
    category: 'C',
    question_en: 'Question text here',
    options: { A: 'one', B: 'two', C: 'three', D: 'four' },
    correct_answer: 'E',
  })
  assert.equal(candidate, null)
  assert.match(errors.join(' '), /does not match any option/)
})

test('rejects empty options, duplicate options and missing questions', () => {
  const emptyOption = validateCandidate({
    book: 'B',
    category: 'C',
    question_en: 'Question text',
    options: { A: 'one', B: '', C: 'three', D: 'four' },
    correct_answer: 'A',
  })
  assert.equal(emptyOption.candidate, null)
  assert.match(emptyOption.errors.join(' '), /Option B is empty/)

  const duplicate = validateCandidate({
    book: 'B',
    category: 'C',
    question_en: 'Question text',
    options: { A: 'same', B: 'same', C: 'three', D: 'four' },
    correct_answer: 'A',
  })
  assert.equal(duplicate.candidate, null)
  assert.match(duplicate.errors.join(' '), /identical/)

  const noQuestion = validateCandidate({
    book: 'B',
    category: 'C',
    question_en: '   ',
    options: { A: 'one', B: 'two', C: 'three', D: 'four' },
    correct_answer: 'A',
  })
  assert.equal(noQuestion.candidate, null)
  assert.match(noQuestion.errors.join(' '), /Question text is missing/)
})

test('rejects rows without book or category', () => {
  const { candidate, errors } = validateCandidate({
    question_en: 'Question text',
    options: { A: 'one', B: 'two', C: 'three', D: 'four' },
    correct_answer: 'A',
  })
  assert.equal(candidate, null)
  assert.match(errors.join(' '), /Book title is missing/)
  assert.match(errors.join(' '), /Category is missing/)
})

test('parses a CSV sheet with a header row', () => {
  const csv = [
    HEADER,
    'My Book,Science,"Water is made of, mostly?",,H2O,CO2,O2,NaCl,A,',
    'My Book,Science,Bad row,,a,b,c,d,Z,',
  ].join('\n')
  const result = parseTableInput(csv, {})
  assert.equal(result.rows.length, 2)
  assert.equal(result.rows[0].status, 'new')
  assert.equal(result.rows[0].candidate?.options.A, 'H2O')
  assert.equal(result.rows[0].candidate?.correct_text, 'H2O')
  assert.equal(result.rows[0].candidate?.question_en, 'Water is made of, mostly?')
  assert.equal(result.rows[1].status, 'invalid')
  assert.equal(result.summary.invalid, 1)
})

test('parses tab separated rows pasted from a sheet', () => {
  const tsv = [
    HEADER.replace(/,/g, '\t'),
    'My Book\tScience\t2 + 2 = ?\tدو جمع دو\t3\t4\t5\t6\tB\t',
  ].join('\n')
  const result = parseInput(tsv, {})
  assert.equal(result.rows[0].status, 'new')
  assert.equal(result.rows[0].candidate?.question_ur, 'دو جمع دو')
  assert.equal(result.rows[0].candidate?.correct_text, '4')
})

test('falls back to default book and category', () => {
  const csv = [HEADER, ',,"Q text here?",,a,b,c,d,A,'].join('\n')
  const result = parseTableInput(csv, { book: 'Fallback Book', category: 'Fallback Cat' })
  assert.equal(result.rows[0].status, 'new')
  assert.equal(result.rows[0].candidate?.book, 'Fallback Book')
  assert.equal(result.rows[0].candidate?.category, 'Fallback Cat')
})

test('flags duplicates inside the same file', () => {
  const csv = [
    HEADER,
    'B,C,What is 1 + 1?,,"1 + 1",2,3,4,B,',
    'B,C,What is 1 + 1?,,"1 + 1",2,3,4,B,',
  ].join('\n')
  const result = parseTableInput(csv, {})
  assert.equal(result.rows[0].status, 'new')
  assert.equal(result.rows[1].status, 'duplicate')
  assert.equal(result.summary.inFileDuplicates, 1)
})

test('same question with different options is not a duplicate', () => {
  const csv = [
    HEADER,
    'B,C,Choose the correct spelling:,,recieve,receive,recive,receeve,B,',
    'B,C,Choose the correct spelling:,,goverment,government,governmant,govermant,B,',
  ].join('\n')
  const result = parseTableInput(csv, {})
  assert.equal(result.rows.filter((r) => r.status === 'new').length, 2)
})

test('option order does not change duplicate detection', () => {
  const csv = [
    HEADER,
    'B,C,Capital of France?,,Paris,Berlin,Rome,Madrid,A,',
    'B,C,Capital of France?,,Berlin,Paris,Madrid,Rome,B,',
  ].join('\n')
  const result = parseTableInput(csv, {})
  assert.equal(result.rows[1].status, 'duplicate')
})

test('parses the original dataset shape', () => {
  const json = JSON.stringify([
    {
      id: 7,
      question_en: 'National flower of Pakistan?',
      question_ur: 'قومی پھول؟',
      options: { A: 'Rose', B: 'Jasmine', C: 'Tulip', D: 'Lily' },
      correct_answer: 'B',
    },
  ])
  const result = parseJsonInput(json, { book: 'GK', category: 'Symbols' })
  assert.equal(result.rows[0].status, 'new')
  assert.equal(result.rows[0].candidate?.correct_text, 'Jasmine')
  assert.equal(result.rows[0].candidate?.source_ref, '7')
  assert.equal(result.rows[0].candidate?.book, 'GK')
})

test('reports invalid JSON and missing columns clearly', () => {
  const bad = parseJsonInput('{ not json', {})
  assert.equal(bad.rows[0].status, 'invalid')
  assert.match(bad.rows[0].messages.join(' '), /not valid JSON/)

  const missing = parseTableInput('question_en\toption_a\nhello\tx', {})
  assert.equal(missing.rows[0].status, 'invalid')
  assert.match(missing.rows[0].messages.join(' '), /Missing column/)
})

test('csv parser keeps quoted newlines and escaped quotes', () => {
  const text = 'a,b\n"line one\nline two","he said ""hi"""'
  const matrix = parseDelimited(text)
  assert.equal(matrix.length, 2)
  assert.equal(matrix[1][0], 'line one\nline two')
  assert.equal(matrix[1][1], 'he said "hi"')
})

test('builds a csv export url from a google sheet link', () => {
  assert.equal(
    toSheetCsvUrl('https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0'),
    'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=0',
  )
  assert.equal(
    toSheetCsvUrl('https://docs.google.com/spreadsheets/d/ABC123/edit?gid=42#gid=42'),
    'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=42',
  )
  assert.match(
    String(toSheetCsvUrl('https://docs.google.com/spreadsheets/d/e/2PACX/pubhtml')),
    /\/pub\?output=csv/,
  )
  assert.equal(toSheetCsvUrl('https://evil.example.com/spreadsheets/d/ABC'), null)
  assert.equal(toSheetCsvUrl('not a url'), null)
})

test('correct answer is always one of the stored options', () => {
  const json = JSON.stringify(
    Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      question_en: `Question number ${i + 1}?`,
      options: { A: `a${i}`, B: `b${i}`, C: `c${i}`, D: `d${i}` },
      correct_answer: ['A', 'B', 'C', 'D'][i % 4],
    })),
  )
  const result = parseJsonInput(json, { book: 'B', category: 'C' })
  for (const row of result.rows) {
    assert.equal(row.status, 'new')
    const candidate = row.candidate!
    const values = OPTION_KEYS.map((key) => candidate.options[key])
    assert.ok(values.includes(candidate.correct_text), 'answer must be an option text')
  }
})

// ------------------------------------------------------- JSON book imports

test('reads subject and exams from a JSON book row', () => {
  const json = JSON.stringify([
    {
      id: 1,
      question_en: 'Which gas do plants take in?',
      question_ur: 'پودے کون سی گیس لیتے ہیں؟',
      options: { A: 'Carbon dioxide', B: 'Oxygen', C: 'Nitrogen', D: 'Hydrogen' },
      correct_answer: 'Carbon dioxide',
      subject: 'everyday-science',
      exams: ['ppsc', 'nts-pts-ots'],
      explanation: 'Plants use carbon dioxide.',
    },
  ])
  const result = parseJsonInput(json, { book: 'Science Starter' })
  const row = result.rows[0]
  assert.equal(row.status, 'new')
  assert.equal(row.candidate?.subject, 'everyday-science')
  assert.deepEqual(row.candidate?.exams, ['ppsc', 'nts-pts-ots'])
  assert.equal(row.candidate?.category, 'everyday-science', 'category falls back to the subject')
  assert.equal(row.candidate?.explanation, 'Plants use carbon dioxide.')
})

test('accepts exams as a comma separated string and cleans duplicates', () => {
  const { candidate } = validateCandidate({
    book: 'B',
    subject: 'geography',
    question_en: 'Question text here',
    options: { A: 'one', B: 'two', C: 'three', D: 'four' },
    correct_answer: 'A',
    exams: 'ppsc, ppsc ,fpsc',
  })
  assert.deepEqual(candidate?.exams, ['ppsc', 'fpsc'])
})

test('still rejects a row with no category and no subject', () => {
  const { candidate, errors } = validateCandidate({
    book: 'B',
    question_en: 'Question text here',
    options: { A: 'one', B: 'two', C: 'three', D: 'four' },
    correct_answer: 'A',
  })
  assert.equal(candidate, null)
  assert.match(errors.join(' '), /Category is missing/)
})

test('the shipped sample book parses into 20 valid rows', async () => {
  const { readFile } = await import('node:fs/promises')
  const file = new URL('../public/sample-book.json', import.meta.url)
  const json = await readFile(file, 'utf8')
  const result = parseJsonInput(json, {})
  assert.equal(result.rows.length, 20)
  assert.equal(result.rows.filter((row) => row.status === 'new').length, 20, 'every sample row is importable')
  assert.equal(result.summary.inFileDuplicates, 0, 'no duplicate rows inside the sample')
  const first = result.rows[0].candidate
  assert.equal(first?.book, 'Everyday Science Starter (20 Questions)')
  assert.equal(first?.subject, 'everyday-science')
  assert.equal(first?.correct_text, 'Carbon dioxide')
  assert.ok(first?.question_ur, 'the sample carries Urdu text')
})

test('the sample book is caught as a duplicate when imported twice', async () => {
  const { readFile } = await import('node:fs/promises')
  const file = new URL('../public/sample-book.json', import.meta.url)
  const json = await readFile(file, 'utf8')
  const twice = JSON.parse(json)
  const result = parseJsonInput(JSON.stringify([...twice, ...twice]), {})
  assert.equal(result.summary.total, 40)
  assert.equal(result.summary.inFileDuplicates, 20, 'the second half is flagged before it reaches the database')
  assert.equal(result.rows.filter((row) => row.status === 'new').length, 20)
})
