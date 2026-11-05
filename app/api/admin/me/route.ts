import { NextResponse } from 'next/server'
import { getAdminEmail } from '@/lib/admin/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const email = await getAdminEmail()
  return NextResponse.json({ email })
}
