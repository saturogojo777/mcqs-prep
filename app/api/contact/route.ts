import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/admin/supabaseAdmin'

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const input = (body ?? {}) as Record<string, unknown>
  const name = clean(input.name, 80)
  const email = clean(input.email, 120)
  const message = clean(input.message, 2000)

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Please fill in every field.' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: 'That email address does not look right.' }, { status: 400 })
  }

  const admin = adminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Messages are not set up yet.' }, { status: 503 })
  }

  const { error } = await admin.from('messages').insert({ name, email, message })
  if (error) {
    return NextResponse.json({ error: 'Could not save the message.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
