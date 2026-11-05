import { NextResponse } from 'next/server'
import { getAdminEmail } from '@/lib/admin/session'
import { adminClient } from '@/lib/admin/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES = new Set(['open', 'fixed', 'ignored'])

type Payload = { id?: unknown; status?: unknown }

async function readBody(request: Request): Promise<Payload> {
  try {
    return (await request.json()) as Payload
  } catch {
    return {}
  }
}

export async function PATCH(request: Request) {
  const admin = await getAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  const supabase = adminClient()
  if (!supabase) return NextResponse.json({ error: 'Server is missing Supabase credentials.' }, { status: 503 })

  const body = await readBody(request)
  const id = typeof body.id === 'string' ? body.id : ''
  const status = typeof body.status === 'string' && STATUSES.has(body.status) ? body.status : null
  if (!id || !status) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  const { error } = await supabase.from('reports').update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const admin = await getAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  const supabase = adminClient()
  if (!supabase) return NextResponse.json({ error: 'Server is missing Supabase credentials.' }, { status: 503 })

  const body = await readBody(request)
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  const { error } = await supabase.from('reports').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
