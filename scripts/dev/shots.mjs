// Design QA for DailyTest: drives the real app in Chromium against the local
// mock Supabase, audits every screen (no horizontal scroll, nothing clipped,
// no colour outside the palette) and writes the screenshot set.
//
//   node scripts/dev/setup-chromium.mjs        # once per sandbox
//   node scripts/dev/mock-supabase.mjs &       # port 3101
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3101 npm run build && npm start
//   node scripts/dev/shots.mjs [baseUrl]

import fs from 'node:fs'
import path from 'node:path'
import { chromium as playwright } from 'playwright-core'
import { chromiumPaths } from './chromium-env.mjs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3100'
const OUT = path.join(process.cwd(), 'screenshots')
fs.mkdirSync(OUT, { recursive: true })

const HEIGHTS = { 360: 780, 390: 844, 768: 1024, 1024: 800, 1280: 900, 1920: 1080 }

const dataset = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/mcqs_all_1to500.json'), 'utf8'))
const answerByQuestion = new Map()
for (const item of dataset) {
  const letter = String(item.correct_answer ?? '').trim().toUpperCase()
  const correct = item.options?.[letter]
  if (!correct) continue
  if (item.question_en) answerByQuestion.set(item.question_en.trim(), correct)
  if (item.question_ur) answerByQuestion.set(item.question_ur.trim(), correct)
}

const ISOLATE = /[\u2066-\u2069]/g
const clean = (value) => String(value ?? '').replace(ISOLATE, '').trim()

async function newPage(browser, { width, lang, theme }) {
  const context = await browser.newContext({
    viewport: { width, height: HEIGHTS[width] ?? 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: 'reduce',
    locale: lang === 'ur' ? 'ur-PK' : 'en-PK',
  })
  await context.addInitScript((value) => {
    try {
      localStorage.setItem('dailytest.lang', value)
    } catch {
      /* opaque origin */
    }
  }, lang)
  const page = await context.newPage()
  return { page, context }
}

async function goto(page, route) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(250)
}

async function audit(page, label, expectedDir) {
  const result = await page.evaluate(
    ({ expectedDir }) => {
      const viewport = window.innerWidth
      const overflowing = []
      const clipped = []
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && (rect.right > viewport + 1 || rect.left < -1)) {
          overflowing.push({ tag: el.tagName, cls: String(el.className).slice(0, 48) })
        }
        const style = getComputedStyle(el)
        const clips = style.overflowX === 'hidden' || style.textOverflow === 'ellipsis'
        if (clips && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0) {
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
        '.option[data-state="correct"], .option[data-state="wrong"], .feedback, .review-item, .review-row--right, .review-value, .pill.new, .badge.new, .badge.invalid, .form-success, .form-error, .note.err, .err-cell, .note.ok'
      const offPalette = []
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        if (el.closest(allowed)) continue
        const style = getComputedStyle(el)
        for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor', 'borderRightColor']) {
          const colour = parse(style[prop])
          if (colour && (green(colour) || red(colour))) {
            offPalette.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), prop, value: style[prop] })
          }
        }
      }

      const englishVisible = Array.from(document.querySelectorAll('.t-en')).some(
        (el) => el.getBoundingClientRect().width > 0,
      )
      const urduVisible = Array.from(document.querySelectorAll('.t-ur')).some(
        (el) => el.getBoundingClientRect().width > 0,
      )

      return {
        viewport,
        docWidth: document.documentElement.scrollWidth,
        dir: document.documentElement.dir,
        englishVisible,
        urduVisible,
        overflowing: overflowing.slice(0, 6),
        overflowingCount: overflowing.length,
        clipped: clipped.slice(0, 6),
        clippedCount: clipped.length,
        offPalette: offPalette.slice(0, 6),
        offPaletteCount: offPalette.length,
      }
    },
    { expectedDir },
  )

  const problems = []
  if (result.docWidth > result.viewport + 1) {
    problems.push(`page scrolls horizontally (${result.docWidth} > ${result.viewport})`)
  }
  if (result.overflowingCount > 0) {
    problems.push(`${result.overflowingCount} element(s) outside the viewport: ${JSON.stringify(result.overflowing)}`)
  }
  if (result.clippedCount > 0) {
    problems.push(`${result.clippedCount} clipped element(s): ${JSON.stringify(result.clipped)}`)
  }
  if (result.offPaletteCount > 0) {
    problems.push(`off-palette colour: ${JSON.stringify(result.offPalette)}`)
  }
  if (expectedDir && result.dir !== expectedDir) {
    problems.push(`document direction should be ${expectedDir}, it is ${result.dir}`)
  }
  if (problems.length > 0) console.log(`  x ${label}\n     ${problems.join('\n     ')}`)
  return problems.length === 0
}

// ------------------------------------------------------------------ actions

async function openStart(page) {
  await goto(page, '/practice/subject/pakistan-studies')
  await page.waitForSelector('.btn-start')
}

async function answerOne(page, mode) {
  const text = clean(await page.locator('.qtext').first().innerText())
  // Questions added through the admin import are not in the source file, so an
  // unknown question just gets the first option: the screenshot still shows a
  // real state, and the audit does not depend on which answer was right.
  const correct = answerByQuestion.get(text)
  const texts = (await page.locator('.option .option-text').allInnerTexts()).map(clean)
  const wanted =
    mode === 'correct' && correct
      ? correct
      : texts.find((option) => option !== correct) ?? texts[0]
  const index = texts.indexOf(wanted)
  await page.locator('.option').nth(Math.max(0, index)).click()
  return { correct: correct ?? null, chosen: wanted, right: wanted === correct }
}

async function playToResult(page, rightCount = 7) {
  await page.waitForSelector('.qtext')
  for (let i = 0; i < 10; i++) {
    await answerOne(page, i < rightCount ? 'correct' : 'wrong')
    await page.waitForTimeout(120)
    await page.locator('.btn-next').click()
    await page.waitForTimeout(180)
  }
  await page.waitForSelector('.result-percent')
  await page.waitForTimeout(500)
}

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
}

// ------------------------------------------------------------------ run

process.on('unhandledRejection', (reason) => console.log('UNHANDLED', reason))

const { executablePath, libPath } = chromiumPaths()
const browser = await playwright.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none', '--hide-scrollbars'],
  env: { ...process.env, LD_LIBRARY_PATH: libPath },
  headless: true,
})

const WIDTHS = [360, 768, 1280]
const LANGS = ['en', 'ur']
const THEMES = ['light', 'dark']
const checks = []
let failures = 0

async function capture({ width, lang, theme, route, action, name, dir }) {
  const { page, context } = await newPage(browser, { width, lang, theme })
  try {
    if (action) await action(page)
    else await goto(page, route)
    await page.waitForTimeout(320)
    const label = `${name} @${width}`
    const pass = await audit(page, label, dir)
    checks.push({ name, width, pass })
    if (!pass) failures++
    await shoot(page, name)
  } finally {
    await context.close()
  }
}

for (const width of WIDTHS) {
  for (const lang of LANGS) {
    for (const theme of THEMES) {
      const suffix = `${lang}-${theme}-${width}`
      const dir = lang === 'ur' ? 'rtl' : 'ltr'

      await capture({ width, lang, theme, route: '/', name: `home-${suffix}`, dir })

      await capture({
        width,
        lang,
        theme,
        action: async (page) => {
          await goto(page, '/subjects')
          await page.waitForSelector('.item')
        },
        name: `subjects-${suffix}`,
        dir,
      })

      await capture({
        width,
        lang,
        theme,
        action: async (page) => {
          await openStart(page)
        },
        name: `start-${suffix}`,
        dir,
      })

      await capture({
        width,
        lang,
        theme,
        action: async (page) => {
          await openStart(page)
          await page.locator('.btn-start').click()
          await page.waitForSelector('.qtext')
          await page.waitForTimeout(260)
          await answerOne(page, 'wrong')
          await page.waitForTimeout(420)
        },
        name: `quiz-wrong-${suffix}`,
        dir,
      })

      await capture({
        width,
        lang,
        theme,
        action: async (page) => {
          await goto(page, '/practice/subject/pakistan-studies')
          await page.waitForSelector('.btn-start')
          await page.locator('.btn-start').click()
          await playToResult(page)
        },
        name: `result-${suffix}`,
        dir,
      })
    }
  }
}

// a few extra screens, one width each
await capture({
  width: 1280,
  lang: 'en',
  theme: 'light',
  action: async (page) => {
    await goto(page, '/subjects')
    await page.waitForSelector('.item')
    await page.locator('.item').first().click()
    await page.waitForSelector('.btn-start')
  },
  name: 'start-click-through-1280',
  dir: 'ltr',
})

await capture({
  width: 360,
  lang: 'en',
  theme: 'light',
  action: async (page) => {
    await goto(page, '/exams')
    await page.waitForSelector('.item')
  },
  name: 'exams-360',
  dir: 'ltr',
})

await capture({
  width: 360,
  lang: 'ur',
  theme: 'dark',
  action: async (page) => {
    await goto(page, '/exams')
    await page.waitForSelector('.item')
  },
  name: 'exams-360-ur-dark',
  dir: 'rtl',
})

for (const route of ['/about', '/contact', '/privacy', '/terms', '/disclaimer']) {
  const slug = route.slice(1)
  await capture({ width: 360, lang: 'en', theme: 'light', route, name: `${slug}-360`, dir: 'ltr' })
  await capture({ width: 1280, lang: 'en', theme: 'light', route, name: `${slug}-1280`, dir: 'ltr' })
}

await capture({
  width: 360,
  lang: 'en',
  theme: 'light',
  action: async (page) => {
    await goto(page, '/today')
    await page.waitForSelector('.qtext')
    await page.waitForTimeout(300)
    await answerOne(page, 'correct')
    await page.waitForTimeout(400)
  },
  name: 'today-360',
  dir: 'ltr',
})

await capture({
  width: 1280,
  lang: 'en',
  theme: 'light',
  action: async (page) => {
    await goto(page, '/admin')
    await page.waitForSelector('.card')
  },
  name: 'admin-login-1280',
  dir: 'ltr',
})

await capture({
  width: 360,
  lang: 'en',
  theme: 'light',
  action: async (page) => {
    await goto(page, '/admin')
    await page.waitForSelector('.card')
  },
  name: 'admin-login-360',
  dir: 'ltr',
})

await browser.close()

console.log(`\n${checks.length} screens audited, ${failures} with problems.`)
if (failures > 0) process.exit(1)
console.log('UI AUDIT PASSED')
