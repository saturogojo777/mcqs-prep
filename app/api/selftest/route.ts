import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminClient } from '@/lib/admin/supabaseAdmin'
import { createSessionToken, ADMIN_COOKIE } from '@/lib/admin/session'
import { timingSafeEqual } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TEST_BOOK = 'Self Test Book'
const TEST_CATEGORY = 'Self Test Category'

function same(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

const CSV = [
  'book,category,question_en,question_ur,option_a,option_b,option_c,option_d,correct_answer,explanation',
  `${TEST_BOOK},${TEST_CATEGORY},Self test: what is 7 + 5?,سیلف ٹیسٹ سوال,11,12,13,14,B,`,
  `${TEST_BOOK},${TEST_CATEGORY},Self test: what is 7 + 5?,سیلف ٹیسٹ سوال,11,12,13,14,B,`,
  `${TEST_BOOK},${TEST_CATEGORY},Self test: bad answer row,,one,two,three,four,Z,`,
  `${TEST_BOOK},${TEST_CATEGORY},Self test: duplicate options row,,same,same,three,four,A,`,
].join('\n')

export async function GET(request: Request) {
  const expected = process.env.SELFTEST_TOKEN
  const given = new URL(request.url).searchParams.get('token') ?? ''
  if (!expected || !given || !same(given, expected)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const origin = new URL(request.url).origin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const admin = adminClient()
  const report: Record<string, unknown> = {}

  // 1. public read works and every stored answer is one of its options
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const catalog = await anon.from('catalog').select('*')
  report.catalog_rows = catalog.data?.length ?? 0
  report.catalog_error = catalog.error?.message ?? null

  const total = await anon.from('mcqs').select('id', { count: 'exact', head: true })
  report.mcqs_total = total.count ?? 0

  const sample = await anon
    .from('mcqs')
    .select('question_en,question_ur,options,correct_text,category_id')
    .limit(2000)
  const rows = (sample.data ?? []) as {
    question_en: string
    question_ur: string | null
    options: Record<string, string>
    correct_text: string
  }[]
  report.rows_checked = rows.length
  report.bad_option_shape = rows.filter(
    (r) => !r.options || ['A', 'B', 'C', 'D'].some((k) => !r.options[k]),
  ).length
  report.answer_not_in_options = rows.filter(
    (r) => !Object.values(r.options ?? {}).includes(r.correct_text),
  ).length
  report.rows_with_urdu = rows.filter((r) => (r.question_ur ?? '').trim() !== '').length

  // 2. the public key must not be able to write
  const anonInsertBook = await anon.from('books').insert({ title: 'hack attempt' }).select('id')
  report.anon_book_insert_error = anonInsertBook.error?.message ?? null
  const anonInsertMcq = await anon.from('mcqs').insert({
    book_id: '00000000-0000-0000-0000-000000000000',
    question_en: 'hack',
    options: { A: 'a', B: 'b', C: 'c', D: 'd' },
    correct_text: 'a',
  })
  report.anon_mcq_insert_error = anonInsertMcq.error?.message ?? null
  const anonDelete = await anon.from('mcqs').delete().eq('question_en', 'nothing').select('id')
  report.anon_delete_error = anonDelete.error?.message ?? null

  if (!admin) {
    report.admin_client = 'missing credentials'
    return NextResponse.json([report], { status: 500 })
  }

  const cleanup = async () => {
    const book = await admin.from('books').select('id').eq('title', TEST_BOOK).maybeSingle()
    if (book.data?.id) {
      await admin.from('mcqs').delete().eq('book_id', book.data.id)
      await admin.from('categories').delete().eq('book_id', book.data.id)
      await admin.from('books').delete().eq('id', book.data.id)
    }
  }
  await cleanup()

  // 3. the real HTTP admin flow: login, unauthenticated rejection, preview, import, dedupe
  const source = { kind: 'text', value: CSV }
  const body = JSON.stringify({ source, book: '', category: '' })

  const badLogin = await fetch(`${origin}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, key: 'wrong-key' }),
  })
  report.login_wrong_key_status = badLogin.status

  const goodLogin = await fetch(`${origin}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, key: process.env.ADMIN_ACCESS_KEY }),
  })
  const loginJson = (await goodLogin.json()) as { email?: string }
  report.login_ok_status = goodLogin.status
  report.login_email_matches = loginJson.email === process.env.ADMIN_EMAIL

  const wrongEmail = await fetch(`${origin}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'someone-else@example.com', key: process.env.ADMIN_ACCESS_KEY }),
  })
  report.login_wrong_email_status = wrongEmail.status

  const unauth = await fetch(`${origin}/api/admin/import`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  report.unauth_import_status = unauth.status

  const cookie = `${ADMIN_COOKIE}=${createSessionToken(
    String(process.env.ADMIN_EMAIL).toLowerCase(),
    String(process.env.ADMIN_SESSION_SECRET),
  )}`
  const authHeaders = { 'content-type': 'application/json', cookie }

  const preview1 = await fetch(`${origin}/api/admin/preview`, {
    method: 'POST',
    headers: authHeaders,
    body,
  })
  const preview1Json = (await preview1.json()) as {
    newCount?: number
    invalidCount?: number
    duplicateCount?: number
  }
  report.preview_status = preview1.status
  report.preview_new = preview1Json.newCount ?? null
  report.preview_duplicates = preview1Json.duplicateCount ?? null
  report.preview_invalid = preview1Json.invalidCount ?? null

  const import1 = await fetch(`${origin}/api/admin/import`, {
    method: 'POST',
    headers: authHeaders,
    body,
  })
  const import1Json = (await import1.json()) as { imported?: number; categories?: string[] }
  report.import_status = import1.status
  report.imported = import1Json.imported ?? null
  report.import_categories = import1Json.categories ?? null

  const import2 = await fetch(`${origin}/api/admin/import`, {
    method: 'POST',
    headers: authHeaders,
    body,
  })
  const import2Json = (await import2.json()) as { imported?: number; skippedDuplicates?: number }
  report.import_again_imported = import2Json.imported ?? null
  report.import_again_skipped_duplicates = import2Json.skippedDuplicates ?? null

  const stored = await admin
    .from('mcqs')
    .select('question_en,options,correct_text')
    .eq('question_en', 'Self test: what is 7 + 5?')
  report.stored_rows = stored.data?.length ?? 0

  await cleanup()
  const leftover = await admin.from('books').select('id').eq('title', TEST_BOOK)
  report.cleanup_leftovers = leftover.data?.length ?? 0

  return NextResponse.json([report])
}
