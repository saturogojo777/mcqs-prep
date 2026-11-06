// Validates content/*.json batches before import (quality gates).
//   node scripts/validate-content.mjs [dir]
// Checks: 4 distinct options, correct answer present and matching an option,
// no empty fields, explanation present, difficulty/level valid, answer-position
// spread, exact + near duplicates (normalised text, shuffled options).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = process.argv[2] ?? path.join(process.cwd(), 'content')
const DIFF = new Set(['easy', 'medium', 'hard'])
const LEVEL = new Set(['basic', 'intermediate', 'advanced'])

const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

function files(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'audit') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...files(full))
    else if (entry.name.endsWith('.json')) out.push(full)
  }
  return out
}

let failures = 0
const fail = (file, i, msg) => {
  failures++
  console.log(`FAIL ${path.relative(process.cwd(), file)}#${i}: ${msg}`)
}

const seenExact = new Map() // hash -> where
const seenQuestion = new Map() // normalised question -> where
const positions = { A: 0, B: 0, C: 0, D: 0 }
let total = 0
let live = 0

for (const file of files(ROOT)) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  rows.forEach((row, i) => {
    total++
    const tag = `${path.basename(file)}#${i}(${row.source_ref ?? '?'})`
    if (!row.question_en?.trim()) fail(file, i, 'empty question_en')
    if (!row.explanation?.trim()) fail(file, i, 'missing explanation')
    const opts = row.options ?? {}
    const values = ['A', 'B', 'C', 'D'].map((k) => String(opts[k] ?? '').trim())
    if (values.some((v) => !v)) fail(file, i, 'options must all be non-empty')
    if (new Set(values).size !== 4) fail(file, i, 'options must be 4 distinct values')
    const letters = values.map((v, n) => (v === String(row.correct_text ?? '').trim() ? 'ABCD'[n] : null)).filter(Boolean)
    if (letters.length !== 1) fail(file, i, `correct_text must match exactly one option (matched ${letters.length})`)
    else positions[letters[0]]++
    if (!DIFF.has(row.difficulty)) fail(file, i, `bad difficulty ${row.difficulty}`)
    if (!LEVEL.has(row.level)) fail(file, i, `bad level ${row.level}`)
    if (!row.chapter?.trim()) fail(file, i, 'missing chapter')
    if (!row.subject?.trim()) fail(file, i, 'missing subject')
    if (!Array.isArray(row.exams) || row.exams.length === 0) fail(file, i, 'missing exam tags')
    if (row.review_status !== 'needs_review') live++
    // exact hash (same formula as public.mcq_hash)
    const hash = crypto.createHash('md5').update(`${norm(row.question_en)}|${values.map(norm).sort().join('|')}`).digest('hex')
    if (seenExact.has(hash)) fail(file, i, `exact duplicate of ${seenExact.get(hash)}`)
    else seenExact.set(hash, tag)
    // near duplicate: same normalised question text
    const nq = norm(row.question_en)
    if (nq && seenQuestion.has(nq)) fail(file, i, `near-duplicate question of ${seenQuestion.get(nq)}`)
    else if (nq) seenQuestion.set(nq, tag)
  })
}

console.log(`rows: ${total}, live: ${live}, needs_review: ${total - live}`)
console.log(`answer positions: A=${positions.A} B=${positions.B} C=${positions.C} D=${positions.D}`)
const counts = Object.values(positions)
if (total > 0 && (Math.max(...counts) - Math.min(...counts)) / total > 0.15) {
  console.log('WARN answer spread is skewed (>15pp range)')
}
if (failures > 0) {
  console.log(`${failures} failure(s)`)
  process.exit(1)
}
console.log('content OK')
