// Generates an idempotent chapter-import SQL file from a validated content batch.
// Usage: node scripts/build-import.mjs content/<book>/<chapter>.json <Book Title> <Subject Slug> <out.sql>
// The batch must already pass scripts/validate-content.mjs.
import fs from 'node:fs'

const [batchPath, bookTitle, subjectSlug, outPath] = process.argv.slice(2)
if (!batchPath || !bookTitle || !subjectSlug || !outPath) {
  console.error('usage: node scripts/build-import.mjs <batch.json> <Book Title> <subject-slug> <out.sql>')
  process.exit(2)
}

const rows = JSON.parse(fs.readFileSync(batchPath, 'utf8'))
const esc = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`
const chapters = [...new Set(rows.map((r) => r.chapter))]

let sql = `-- DailyTest: ${bookTitle} import (${rows.length} MCQs).\n-- Generated from ${batchPath} (validated + deduped). Idempotent.\n\n`
sql += `insert into public.books (title) values (${esc(bookTitle)}) on conflict (title) do nothing;\n\n`
for (const chapter of chapters) {
  sql += `insert into public.categories (book_id, name)\nselect id, ${esc(chapter)} from public.books where title = ${esc(bookTitle)}\non conflict (book_id, name) do nothing;\n\n`
}
sql += `insert into public.mcqs (book_id, category_id, question_en, question_ur, options,\n  correct_text, explanation, source_ref, difficulty, level, review_status)\nselect b.id, c.id, v.question_en, nullif(v.question_ur, ''), v.options::jsonb,\n  v.correct_text, v.explanation, v.source_ref, v.difficulty, v.level, v.review_status\nfrom public.books b join public.categories c on c.book_id = b.id\njoin (values\n`
sql +=
  rows
    .map(
      (r) =>
        `  (${esc(r.chapter)}, ${esc(r.question_en)}, ${esc(r.question_ur)}, '${JSON.stringify(r.options).replace(/'/g, "''")}', ${esc(r.correct_text)}, ${esc(r.explanation)}, ${esc(r.source_ref)}, ${esc(r.difficulty)}, ${esc(r.level)}, ${esc(r.review_status ?? 'ai_verified')})`,
    )
    .join(',\n') + '\n'
sql += `) as v(chapter, question_en, question_ur, options, correct_text, explanation,\n  source_ref, difficulty, level, review_status) on c.name = v.chapter\nwhere b.title = ${esc(bookTitle)}\non conflict (content_hash) do nothing;\n\n`
sql += `insert into public.mcq_subjects (mcq_id, subject_id)\nselect m.id, s.id from public.mcqs m cross join public.subjects s\nwhere s.slug = ${esc(subjectSlug)} and m.source_ref = any (array[${rows.map((r) => esc(r.source_ref)).join(', ')}])\non conflict do nothing;\n\n`
// Group rows by identical exam-tag set so each insert covers one tier cleanly.
const groups = new Map()
for (const r of rows) {
  const key = [...r.exams].sort().join(',')
  if (!groups.has(key)) groups.set(key, { exams: [...r.exams].sort(), refs: [] })
  groups.get(key).refs.push(r.source_ref)
}
for (const { exams, refs } of groups.values()) {
  sql += `insert into public.mcq_exams (mcq_id, exam_id)\nselect m.id, e.id from public.mcqs m cross join public.exams e\nwhere e.slug = any (array[${exams.map(esc).join(', ')}])\n  and m.source_ref = any (array[${refs.map(esc).join(', ')}])\non conflict do nothing;\n\n`
}
fs.writeFileSync(outPath, sql)
console.log(`wrote ${outPath} (${rows.length} rows, ${groups.size} exam groups)`)
