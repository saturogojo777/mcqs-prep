// Design QA: drives the real app in Chromium, mocks the Supabase REST calls,
// checks layout + colour discipline and writes screenshots for every breakpoint.
//
// Usage: node scripts/dev/shots.mjs [baseUrl]

import fs from 'node:fs'
import path from 'node:path'
import { chromium as playwright } from 'playwright-core'
import sparticuz from '@sparticuz/chromium'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3100'
const OUT = path.join(process.cwd(), 'screenshots')
fs.mkdirSync(OUT, { recursive: true })

const PROGRESS_KEY = 'mcqprep.progress.v1'
const LANG_KEY = 'mcqprep.lang'

const WIDTHS = [360, 390, 768, 1024, 1280, 1920]
const HEIGHTS = { 360: 780, 390: 844, 768: 1024, 1024: 800, 1280: 900, 1920: 1080 }

// ------------------------------------------------------------------ fixtures

const dataset = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/mcqs_all_1to500.json'), 'utf8'))

const BOOK_ID = 'b0000000-0000-0000-0000-000000000001'
const CATEGORIES = [
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Pakistan GK & Constitution', from: 1, to: 100 },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'Pakistan Geography & Symbols', from: 101, to: 200 },
  { id: 'c0000000-0000-0000-0000-000000000003', name: 'International Organizations & Days', from: 201, to: 300 },
  { id: 'c0000000-0000-0000-0000-000000000004', name: 'Science & Computer', from: 301, to: 400 },
  { id: 'c0000000-0000-0000-0000-000000000005', name: 'Math & English', from: 401, to: 500 },
]

const mcqs = []
for (const category of CATEGORIES) {
  for (const item of dataset) {
    if (item.id < category.from || item.id > category.to) continue
    const letter = String(item.correct_answer).trim().toUpperCase()
    const correct = item.options[letter]
    if (!correct) continue
    mcqs.push({
      id: `${category.id}-${item.id}`,
      category_id: category.id,
      question_en: item.question_en,
      question_ur: item.question_ur,
      options: item.options,
      correct_text: correct,
      explanation: null,
      source_ref: String(item.id),
    })
  }
}

const catalog = CATEGORIES.map((category) => ({
  book_id: BOOK_ID,
  title: 'General Knowledge (500 Questions)',
  category_id: category.id,
  category_name: category.name,
  question_count: mcqs.filter((row) => row.category_id === category.id).length,
}))

const PROGRESS = {
  [CATEGORIES[0].id]: { answered: 34, correct: 29, position: 34, updatedAt: Date.now() - 60000 },
  [CATEGORIES[1].id]: { answered: 18, correct: 14, position: 18, updatedAt: Date.now() - 900000 },
  [CATEGORIES[2].id]: { answered: 7, correct: 5, position: 7, updatedAt: Date.now() - 3600000 },
}

const PREVIEW = {
  total: 6,
  newCount: 3,
  duplicateCount: 2,
  invalidCount: 1,
  inFileDuplicates: 1,
  truncated: false,
  rows: [
    { line: 1, status: 'new', question_en: 'Who was the first Caliph?', book: 'Islamic Studies', category: 'History', answer: 'Hazrat Abu Bakr (RA)', messages: [] },
    { line: 2, status: 'new', question_en: 'In which year was the Battle of Badr fought?', book: 'Islamic Studies', category: 'History', answer: '2 AH', messages: [] },
    { line: 3, status: 'duplicate', question_en: 'What is the capital of Pakistan?', book: 'General Knowledge', category: 'Pakistan GK & Constitution', answer: 'Islamabad', messages: ['Already in the database (same question and options)'] },
    { line: 4, status: 'duplicate', question_en: 'Who is the founder of Pakistan?', book: 'General Knowledge', category: 'Pakistan GK & Constitution', answer: 'Muhammad Ali Jinnah', messages: ['Duplicate of row 2 in this file'] },
    { line: 5, status: 'new', question_en: 'Which gas do plants absorb?', book: 'Science', category: 'Biology', answer: 'Carbon dioxide', messages: [] },
    { line: 6, status: 'invalid', question_en: 'Choose the odd one out', book: 'Science', category: 'Biology', answer: 'E', messages: ['Answer "E" does not match any option'] },
  ],
}

// ------------------------------------------------------------------ helpers

async function prepare(context, { lang = 'en', theme = 'light', progress = null } = {}) {
  await context.route('**/rest/v1/catalog*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(catalog),
    }),
  )
  await context.route('**/rest/v1/mcqs*', (route) => {
    const url = new URL(route.request().url())
    const filter = url.searchParams.get('category_id') ?? ''
    const id = filter.replace('eq.', '')
    const rows = mcqs.filter((row) => !id || row.category_id === id)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(rows),
    })
  })
  await context.route('**/api/admin/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'admin@example.com' }) }),
  )
  await context.route('**/api/admin/preview', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PREVIEW) }),
  )
  await context.addInitScript(
    ({ progressKey, langKey, langValue, progressValue }) => {
      try {
        localStorage.setItem(langKey, langValue)
        if (progressValue) localStorage.setItem(progressKey, progressValue)
        else localStorage.removeItem(progressKey)
      } catch {
        // about:blank and other opaque origins have no storage access
      }
    },
    {
      progressKey: PROGRESS_KEY,
      langKey: LANG_KEY,
      langValue: lang,
      progressValue: progress ? JSON.stringify(progress) : null,
    },
  )
  return context
}

async function newPage(browser, width, options) {
  const context = await browser.newContext({
    viewport: { width, height: HEIGHTS[width] ?? 900 },
    deviceScaleFactor: 2,
    colorScheme: options.theme,
    reducedMotion: 'no-preference',
  })
  await prepare(context, options)
  const page = await context.newPage()
  return { page, context }
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(650)
}

async function audit(page, label) {
  const result = await page.evaluate(() => {
    const viewport = window.innerWidth
    const docWidth = document.documentElement.scrollWidth

    const overflowing = []
    const clipped = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && (rect.right > viewport + 1 || rect.left < -1)) {
        overflowing.push({ tag: el.tagName, cls: String(el.className).slice(0, 48) })
      }
      const style = getComputedStyle(el)
      const clips = style.overflowX === 'hidden' || style.textOverflow === 'ellipsis'
      if (clips && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
        clipped.push({ tag: el.tagName, cls: String(el.className).slice(0, 48), text: (el.textContent ?? '').slice(0, 40) })
      }
    }

    const parse = (value) => {
      const match = String(value).match(/rgba?\(([^)]+)\)/)
      if (!match) return null
      const parts = match[1].split(',').map((n) => parseFloat(n))
      if (parts.length > 3 && parts[3] === 0) return null
      return [parts[0], parts[1], parts[2]]
    }
    const green = ([r, g, b]) => g > 90 && g - r > 25 && g - b > 25
    const red = ([r, g, b]) => r > 120 && r - g > 40 && r - b > 40
    const allowed =
      '.option[data-state="correct"], .option[data-state="wrong"], .feedback, .review-row--correct, .note.ok, .note.err, .err-cell, .badge.invalid'
    const offPalette = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (el.closest(allowed)) continue
      const style = getComputedStyle(el)
      for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor']) {
        const colour = parse(style[prop])
        if (colour && (green(colour) || red(colour))) {
          offPalette.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), prop, value: style[prop] })
        }
      }
    }

    return {
      viewport,
      docWidth,
      overflowing: overflowing.slice(0, 8),
      overflowingCount: overflowing.length,
      clipped: clipped.slice(0, 8),
      clippedCount: clipped.length,
      offPalette: offPalette.slice(0, 8),
      offPaletteCount: offPalette.length,
    }
  })

  const problems = []
  if (result.docWidth > result.viewport + 1) problems.push(`page scrolls horizontally (${result.docWidth} > ${result.viewport})`)
  if (result.overflowingCount > 0) problems.push(`${result.overflowingCount} element(s) outside the viewport: ${JSON.stringify(result.overflowing)}`)
  if (result.clippedCount > 0) problems.push(`${result.clippedCount} clipped element(s): ${JSON.stringify(result.clipped)}`)
  if (result.offPaletteCount > 0) problems.push(`off-palette colour: ${JSON.stringify(result.offPalette)}`)
  if (problems.length > 0) console.log(`  ✗ ${label}\n     ${problems.join('\n     ')}`)
  return problems.length === 0
}

const FULL_PAGE = /^(home|result|admin)/

async function shoot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  if (FULL_PAGE.test(name)) {
    await page.screenshot({ path: path.join(OUT, `${name}-full.png`), fullPage: true })
  }
  return file
}

function clock(ms) {
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
}

async function answerCurrent(page, mode) {
  const questionText = (await page.locator('.qtext').first().innerText()).trim()
  const row = mcqs.find(
    (item) => item.question_en === questionText || item.question_ur === questionText,
  )
  if (!row) throw new Error(`unknown question: ${questionText}`)
  const correct = row.correct_text
  if (mode === 'correct') {
    await page.locator('.option', { hasText: correct }).first().click()
    return 'correct'
  }
  const texts = await page.locator('.option .option-text').allInnerTexts()
  const wrong = texts.find((text) => text.trim() !== correct)
  await page.locator('.option', { hasText: wrong }).first().click()
  return 'wrong'
}

// ------------------------------------------------------------------ run

process.on('unhandledRejection', (reason) => console.log('UNHANDLED', reason))
process.on('uncaughtException', (error) => console.log('UNCAUGHT', error))

const executablePath = await sparticuz.executablePath()
const browser = await playwright.launch({
  executablePath,
  args: [...sparticuz.args.filter((arg) => arg !== '--single-process'), '--no-sandbox', '--font-render-hinting=none'],
  headless: true,
})
browser.on('disconnected', () => console.log('BROWSER DISCONNECTED'))

const checks = []
let failures = 0

async function capture(label, width, options, action, name) {
  const { page, context } = await newPage(browser, width, options)
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await settle(page)
  if (action) await action(page)
  const pass = await audit(page, `${name} @${width}`)
  checks.push({ name, width, pass })
  if (!pass) failures++
  await shoot(page, name)
  await context.close()
}

// 1. home at every width, light, English, no progress
for (const width of WIDTHS) {
  await capture('home', width, { lang: 'en', theme: 'light' }, null, `home-en-light-${width}`)
}

// 2. home with progress (continue card) + dark + Urdu
for (const width of [360, 390, 768, 1024, 1280, 1920]) {
  await capture('home-progress', width, { lang: 'en', theme: 'light', progress: PROGRESS }, null, `home-progress-en-light-${width}`)
}
for (const width of [390, 1280]) {
  await capture('home-dark', width, { lang: 'en', theme: 'dark', progress: PROGRESS }, null, `home-progress-en-dark-${width}`)
  await capture('home-urdu', width, { lang: 'ur', theme: 'light', progress: PROGRESS }, null, `home-progress-ur-light-${width}`)
  await capture('home-urdu-dark', width, { lang: 'ur', theme: 'dark', progress: PROGRESS }, null, `home-progress-ur-dark-${width}`)
}

// 3. quiz practice — correct answer state
for (const width of [360, 390, 768, 1024, 1280, 1920]) {
  await capture(
    'quiz-correct',
    width,
    { lang: 'en', theme: 'light', progress: PROGRESS },
    async (page) => {
      await page.locator('.topic-card .btn-practice').first().click()
      await page.waitForSelector('.qtext')
      await page.waitForTimeout(320)
      await answerCurrent(page, 'correct')
      await page.waitForTimeout(420)
    },
    `quiz-correct-en-light-${width}`,
  )
}

// 4. quiz practice — wrong answer state (light + dark)
for (const width of [390, 1280]) {
  await capture(
    'quiz-wrong',
    width,
    { lang: 'en', theme: 'light', progress: PROGRESS },
    async (page) => {
      await page.locator('.topic-card .btn-practice').first().click()
      await page.waitForSelector('.qtext')
      await page.waitForTimeout(320)
      await answerCurrent(page, 'wrong')
      await page.waitForTimeout(420)
    },
    `quiz-wrong-en-light-${width}`,
  )
  await capture(
    'quiz-wrong-dark',
    width,
    { lang: 'en', theme: 'dark', progress: PROGRESS },
    async (page) => {
      await page.locator('.topic-card .btn-practice').first().click()
      await page.waitForSelector('.qtext')
      await page.waitForTimeout(320)
      await answerCurrent(page, 'wrong')
      await page.waitForTimeout(420)
    },
    `quiz-wrong-en-dark-${width}`,
  )
}

// 5. quiz in Urdu
for (const width of [390, 1280]) {
  await capture(
    'quiz-urdu',
    width,
    { lang: 'ur', theme: 'light', progress: PROGRESS },
    async (page) => {
      await page.locator('.topic-card .btn-practice').first().click()
      await page.waitForSelector('.qtext')
      await page.waitForTimeout(320)
      await answerCurrent(page, 'correct')
      await page.waitForTimeout(420)
    },
    `quiz-urdu-correct-${width}`,
  )
}

// 6. test mode (timer + rail)
for (const width of [390, 1280]) {
  await capture(
    'quiz-test',
    width,
    { lang: 'en', theme: 'light', progress: PROGRESS },
    async (page) => {
      await page.locator('.topic-card .btn-test').first().click()
      await page.waitForSelector('.qtext')
      await page.waitForTimeout(300)
      await answerCurrent(page, 'correct')
      await page.waitForTimeout(1200)
    },
    `quiz-test-en-light-${width}`,
  )
}

// 7. results
for (const width of [390, 1280]) {
  await capture(
    'result',
    width,
    { lang: 'en', theme: 'light', progress: PROGRESS },
    async (page) => {
      await page.locator('.topic-card .btn-test').first().click()
      await page.waitForSelector('.qtext')
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(120)
        await answerCurrent(page, i < 7 ? 'correct' : 'wrong')
        await page.locator('.btn-next').click()
      }
      await page.waitForSelector('.result-percent')
      await page.waitForTimeout(1400)
    },
    `result-en-light-${width}`,
  )
}

// 8. admin
for (const width of [390, 1280]) {
  const { page, context } = await newPage(browser, width, { lang: 'en', theme: 'light' })
  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.waitForSelector('.card')
  let pass = await audit(page, `admin-login @${width}`)
  if (!pass) failures++
  checks.push({ name: 'admin-login', width, pass })
  await shoot(page, `admin-login-${width}`)

  await page.fill('input[type="text"], input[type="url"]', 'https://docs.google.com/spreadsheets/d/EXAMPLE/edit')
  await page.locator('button', { hasText: 'Preview' }).first().click()
  await page.waitForSelector('table.rows')
  await page.waitForTimeout(300)
  pass = await audit(page, `admin-preview @${width}`)
  if (!pass) failures++
  checks.push({ name: 'admin-preview', width, pass })
  await page.evaluate(() => {
    const table = document.querySelector('.table-wrap')
    if (table) table.scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(250)
  await shoot(page, `admin-preview-${width}`)
  await context.close()
}

// 9. dark admin
{
  const { page, context } = await newPage(browser, 1280, { lang: 'en', theme: 'dark' })
  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.fill('input[type="text"], input[type="url"]', 'https://docs.google.com/spreadsheets/d/EXAMPLE/edit')
  await page.locator('button', { hasText: 'Preview' }).first().click()
  await page.waitForSelector('table.rows')
  await page.waitForTimeout(300)
  const pass = await audit(page, 'admin-preview-dark @1280')
  if (!pass) failures++
  checks.push({ name: 'admin-preview-dark', width: 1280, pass })
  await page.evaluate(() => {
    const table = document.querySelector('.table-wrap')
    if (table) table.scrollIntoView({ block: 'center' })
  })
  await shoot(page, 'admin-preview-dark-1280')
  await context.close()
}

await browser.close()

console.log(`\n${checks.length} layout audits, ${failures} failure(s)`)
console.log(`screenshots written to ${OUT}`)
process.exit(failures > 0 ? 1 : 0)
