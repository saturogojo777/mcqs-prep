import { NextResponse } from 'next/server'
import { getAdminEmail } from '@/lib/admin/session'
import { adminClient } from '@/lib/admin/supabaseAdmin'
import { buildFromText, resolveSource, reviewImport } from '@/lib/admin/import-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const admin = await getAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })

  const supabase = adminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server is missing Supabase credentials.' }, { status: 503 })
  }

  let body: { source?: unknown; book?: unknown; category?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const source = await resolveSource(body.source)
  if ('error' in source) return NextResponse.json({ error: source.error }, { status: 400 })

  const defaults = {
    book: typeof body.book === 'string' ? body.book.trim() : undefined,
    category: typeof body.category === 'string' ? body.category.trim() : undefined,
  }

  try {
    const build = buildFromText(source.text, defaults)
    const summary = await reviewImport(supabase, build)
    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
