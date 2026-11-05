import { NextResponse } from 'next/server'
import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE,
  adminEmailFromEnv,
  createSessionToken,
  safeEqual,
  sessionSecret,
} from '@/lib/admin/session'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const adminEmail = adminEmailFromEnv()
  const secret = sessionSecret()
  const accessKey = process.env.ADMIN_ACCESS_KEY

  if (!adminEmail || !secret || !accessKey) {
    return NextResponse.json(
      { error: 'Admin access is not configured on this deployment.' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Send an email and access key.' }, { status: 400 })
  }

  const payload = body as { email?: unknown; key?: unknown }
  const email = String(payload?.email ?? '').trim().toLowerCase()
  const key = String(payload?.key ?? '')

  const emailOk = safeEqual(email, adminEmail)
  const keyOk = safeEqual(key, accessKey)

  if (!emailOk || !keyOk) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return NextResponse.json({ error: 'Wrong email or access key.' }, { status: 401 })
  }

  const response = NextResponse.json({ email })
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: createSessionToken(email, secret),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}
