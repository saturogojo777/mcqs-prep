import { NextResponse } from 'next/server'
import { getAdminEmail } from '@/lib/admin/session'
import { adminClient } from '@/lib/admin/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await getAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  const supabase = adminClient()
  if (!supabase) return NextResponse.json({ error: 'Server is missing Supabase credentials.' }, { status: 503 })

  const [books, chapters, mcqs, reports, patterns, exams] = await Promise.all([
    supabase.from('books').select('id,title').order('title'),
    supabase.from('categories').select('id,book_id,name'),
    supabase.from('mcqs').select('id,book_id,category_id,review_status,question_en,options,correct_text,explanation,level,difficulty'),
    supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('mock_patterns').select('*'),
    supabase.from('exams').select('id,slug,name'),
  ])

  for (const result of [books, chapters, mcqs, reports, patterns, exams]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  const rows = (mcqs.data ?? []) as Array<{
    id: string
    book_id: string | null
    category_id: string | null
    review_status: string
    question_en: string
    options: Record<string, string> | null
    correct_text: string
    explanation: string | null
    level: string
    difficulty: string
  }>

  const chapterName = new Map(((chapters.data ?? []) as Array<{ id: string; book_id: string; name: string }>).map((c) => [c.id, c]))
  const bookName = new Map(((books.data ?? []) as Array<{ id: string; title: string }>).map((b) => [b.id, b.title]))

  const perBook = new Map<string, { book: string; total: number; needsReview: number; chapters: Map<string, { total: number; needsReview: number }> }>()
  for (const row of rows) {
    const bookLabel = row.book_id ? bookName.get(row.book_id) ?? 'Unassigned' : 'Unassigned'
    const entry = perBook.get(bookLabel) ?? { book: bookLabel, total: 0, needsReview: 0, chapters: new Map() }
    entry.total += 1
    if (row.review_status === 'needs_review') entry.needsReview += 1
    const chapterLabel = row.category_id ? chapterName.get(row.category_id)?.name ?? 'General' : 'General'
    const chapter = entry.chapters.get(chapterLabel) ?? { total: 0, needsReview: 0 }
    chapter.total += 1
    if (row.review_status === 'needs_review') chapter.needsReview += 1
    entry.chapters.set(chapterLabel, chapter)
    perBook.set(bookLabel, entry)
  }

  const examById = new Map(((exams.data ?? []) as Array<{ id: string; slug: string; name: string }>).map((e) => [e.id, e]))

  return NextResponse.json({
    totals: {
      questions: rows.length,
      needsReview: rows.filter((row) => row.review_status === 'needs_review').length,
      explained: rows.filter((row) => (row.explanation ?? '').trim().length > 0).length,
      openReports: ((reports.data ?? []) as Array<{ status: string }>).filter((row) => row.status === 'open').length,
    },
    books: Array.from(perBook.values())
      .map((entry) => ({
        book: entry.book,
        total: entry.total,
        needsReview: entry.needsReview,
        chapters: Array.from(entry.chapters.entries())
          .map(([chapter, value]) => ({ chapter, ...value }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total),
    needsReview: rows
      .filter((row) => row.review_status === 'needs_review')
      .slice(0, 100)
      .map((row) => ({
        id: row.id,
        question: row.question_en,
        answer: row.correct_text,
        book: row.book_id ? bookName.get(row.book_id) ?? '—' : '—',
        chapter: row.category_id ? chapterName.get(row.category_id)?.name ?? '—' : '—',
        level: row.level,
        difficulty: row.difficulty,
      })),
    reports: ((reports.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      exam_slug: null,
      question: rows.find((item) => item.id === row.mcq_id)?.question_en ?? null,
      correct_text: rows.find((item) => item.id === row.mcq_id)?.correct_text ?? null,
    })),
    patterns: ((patterns.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      exam: examById.get(String(row.exam_id))?.name ?? '—',
      slug: examById.get(String(row.exam_id))?.slug ?? '',
    })),
  })
}
