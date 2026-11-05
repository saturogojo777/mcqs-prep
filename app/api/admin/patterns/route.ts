import { NextResponse } from 'next/server'
import { getAdminEmail } from '@/lib/admin/session'
import { adminClient } from '@/lib/admin/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Payload = {
  examSlug?: unknown
  questionCount?: unknown
  minutes?: unknown
  marksPerQuestion?: unknown
  negativeMarking?: unknown
  passingPercentage?: unknown
}

const num = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

export async function PUT(request: Request) {
  const admin = await getAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  const supabase = adminClient()
  if (!supabase) return NextResponse.json({ error: 'Server is missing Supabase credentials.' }, { status: 503 })

  let body: Payload
  try {
    body = (await request.json()) as Payload
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const slug = typeof body.examSlug === 'string' ? body.examSlug : ''
  if (!slug) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  const { data: exam, error: examError } = await supabase.from('exams').select('id').eq('slug', slug).maybeSingle()
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 })
  if (!exam) return NextResponse.json({ error: 'Unknown exam.' }, { status: 404 })

  const rows = {
    exam_id: exam.id,
    question_count: Math.round(num(body.questionCount, 1, 500, 100)),
    minutes: Math.round(num(body.minutes, 1, 600, 120)),
    marks_per_question: num(body.marksPerQuestion, 0, 100, 1),
    negative_marking: num(body.negativeMarking, 0, 100, 0),
    passing_percentage: Math.round(num(body.passingPercentage, 0, 100, 50)),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('mock_patterns').upsert(rows, { onConflict: 'exam_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, pattern: rows })
}
