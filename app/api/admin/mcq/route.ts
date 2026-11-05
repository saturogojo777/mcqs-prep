import { NextResponse } from 'next/server'
import { getAdminEmail } from '@/lib/admin/session'
import { adminClient } from '@/lib/admin/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Payload = {
  id?: unknown
  action?: unknown
  question_en?: unknown
  options?: unknown
  correct_text?: unknown
  explanation?: unknown
}

export async function POST(request: Request) {
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

  const id = typeof body.id === 'string' ? body.id : ''
  const action = typeof body.action === 'string' ? body.action : ''
  if (!id) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  if (action === 'delete') {
    const { error } = await supabase.from('mcqs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'verify') {
    const { error } = await supabase.from('mcqs').update({ review_status: 'ai_verified' }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const options = body.options && typeof body.options === 'object' ? body.options : null
  const patch: Record<string, unknown> = {}
  if (typeof body.question_en === 'string' && body.question_en.trim()) patch.question_en = body.question_en.trim()
  if (typeof body.correct_text === 'string' && body.correct_text.trim()) patch.correct_text = body.correct_text.trim()
  if (typeof body.explanation === 'string') patch.explanation = body.explanation.trim() || null
  if (options) {
    const clean = Object.fromEntries(
      Object.entries(options as Record<string, unknown>)
        .map(([key, value]) => [key.toUpperCase(), String(value ?? '').trim()])
        .filter(([, value]) => value),
    )
    if (Object.keys(clean).length < 2) return NextResponse.json({ error: 'At least two options are needed.' }, { status: 400 })
    patch.options = clean
  }
  if (
    typeof patch.correct_text === 'string' &&
    options &&
    !Object.values(patch.options as Record<string, string>).includes(patch.correct_text as string)
  ) {
    return NextResponse.json({ error: 'The correct answer must be one of the options.' }, { status: 400 })
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  const { error } = await supabase.from('mcqs').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
