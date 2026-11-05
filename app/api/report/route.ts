import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Wrong-question reports land in the `reports` table, which has RLS on and no
 * policies: only this route (service role, server side) can write to it.
 */
const REASONS = new Set(['wrong-answer', 'typo', 'unclear', 'duplicate', 'other'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'not-configured' }, { status: 503 })
  }

  let body: { mcqId?: unknown; reason?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }

  const mcqId = typeof body.mcqId === 'string' ? body.mcqId : ''
  const reason = typeof body.reason === 'string' && REASONS.has(body.reason) ? body.reason : null
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null

  if (!UUID.test(mcqId) || !reason) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await admin.from('reports').insert({ mcq_id: mcqId, reason, note })
  if (error) {
    return NextResponse.json({ error: 'insert-failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
