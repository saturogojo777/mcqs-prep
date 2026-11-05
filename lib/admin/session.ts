import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const ADMIN_COOKIE = 'mcqprep_admin'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

const b64 = (value: string) => Buffer.from(value, 'utf8').toString('base64url')

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createSessionToken(email: string, secret: string): string {
  const payload = b64(JSON.stringify({ e: email.toLowerCase(), x: Date.now() + SESSION_MAX_AGE * 1000 }))
  return `${payload}.${sign(payload, secret)}`
}

export function readSessionToken(token: string | undefined, secret: string): { email: string } | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = sign(payload, secret)
  const given = Buffer.from(signature)
  const want = Buffer.from(expected)
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      e?: unknown
      x?: unknown
    }
    if (typeof data.x !== 'number' || data.x < Date.now()) return null
    if (typeof data.e !== 'string' || !data.e) return null
    return { email: data.e }
  } catch {
    return null
  }
}

/** Constant time string compare that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) {
    // Still do a comparison so timing does not leak the length.
    timingSafeEqual(left, left)
    return false
  }
  return timingSafeEqual(left, right)
}

export function adminEmailFromEnv(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return email && email.includes('@') ? email : null
}

export function sessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET
  return secret && secret.length >= 16 ? secret : null
}

/** Returns the signed-in admin email, or null when the request is not an admin. */
export async function getAdminEmail(): Promise<string | null> {
  const secret = sessionSecret()
  const adminEmail = adminEmailFromEnv()
  if (!secret || !adminEmail) return null
  const store = await cookies()
  const session = readSessionToken(store.get(ADMIN_COOKIE)?.value, secret)
  if (!session) return null
  return session.email === adminEmail ? session.email : null
}
