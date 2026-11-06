// STEP 4B visual proof: drives the no-repeat UI in Chromium against the mock.
// Usage: node scripts/dev/shots-4b.mjs  (mock :3101 + site :3100 running)
import fs from 'node:fs'
import path from 'node:path'
import { chromium as playwright } from 'playwright-core'
import { chromiumPaths } from './chromium-env.mjs'

const BASE = 'http://127.0.0.1:3100'
const OUT = path.join(process.cwd(), 'screenshots', 'step-4b')
fs.mkdirSync(OUT, { recursive: true })

const mockRpc = async (name, body) => {
  const res = await fetch(`http://127.0.0.1:3101/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

const mathIds = (await mockRpc('pool_question_ids', { p_kind: 'subject', p_key: 'mathematics' })).map((r) => r.id)
console.log('math pool:', mathIds.length)

const seenMap = (ids, wrongEvery = 0) => {
  const map = {}
  ids.forEach((id, i) => {
    map[id] = {
      lastSeenAt: 1000 + i,
      timesSeen: 1,
      lastResult: wrongEvery > 0 && i % wrongEvery === 0 ? 'wrong' : 'right',
    }
  })
  return map
}

const { executablePath, libPath } = chromiumPaths()
const browser = await playwright.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none', '--hide-scrollbars'],
  env: { ...process.env, LD_LIBRARY_PATH: libPath },
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
const bodyText = () => page.evaluate(() => document.body.textContent ?? '')

// 1. fresh start screen
await page.goto(`${BASE}/practice/subject/mathematics`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.seen-line', { timeout: 8000 })
await shot('1-start-fresh')
console.log('fresh:', (await bodyText()).includes('99 new for you of 99') ? '99-new line OK' : 'LINE MISSING')

// 2. shortfall: 95 of 99 seen -> 10-pick gated
await page.evaluate(
  ([key, map]) => window.localStorage.setItem(key, JSON.stringify(map)),
  ['dailytest.seen.v1', seenMap(mathIds.slice(0, 95), 7)],
)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.shortfall-note', { timeout: 8000 })
const startDisabled = await page.evaluate(() => document.querySelector('.btn-start')?.disabled ?? null)
await shot('2-start-shortfall')
console.log('shortfall note + start disabled:', startDisabled === true ? 'OK' : `BROKEN (${startDisabled})`)

// 3. only-new off -> start enabled
await page.click('.checkline input[type="checkbox"]')
const startEnabled = await page.evaluate(() => document.querySelector('.btn-start')?.disabled ?? null)
await shot('3-start-onlynew-off')
console.log('only-new off enables start:', startEnabled === false ? 'OK' : `BROKEN (${startEnabled})`)

// 4. all seen -> empty state, then fresh round
await page.evaluate(
  ([key, map]) => window.localStorage.setItem(key, JSON.stringify(map)),
  ['dailytest.seen.v1', seenMap(mathIds, 5)],
)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.empty-state .btn-dark', { timeout: 8000 })
await shot('4-start-allseen')
await page.click('.empty-state .btn-dark')
await page.waitForSelector('.btn-start:not([disabled])', { timeout: 8000 })
const freshText = await bodyText()
await shot('5-start-after-fresh')
console.log('fresh round restores start:', freshText.includes('99 new for you of 99') ? 'OK' : 'BROKEN')

// 5. progress page seen section + reset dialog
await page.evaluate(
  ([key, map]) => window.localStorage.setItem(key, JSON.stringify(map)),
  ['dailytest.seen.v1', seenMap(mathIds.slice(0, 40), 4)],
)
await page.goto(`${BASE}/progress`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.bars', { timeout: 8000 }).catch(() => {})
await shot('6-progress-seen')
console.log('progress seen line:', (await bodyText()).includes('Seen 40 of 99') ? 'OK' : 'MISSING')
const resetBtn = page.getByRole('button', { name: 'Reset my seen history' })
if ((await resetBtn.count()) > 0) {
  await resetBtn.click()
  await page.waitForSelector('.dialog', { timeout: 5000 })
  await shot('7-progress-reset-dialog')
  await page.getByRole('button', { name: 'Yes, reset' }).click()
  await page.waitForTimeout(500)
  await shot('8-progress-after-reset')
  console.log('reset confirm:', (await bodyText()).includes('Seen history cleared') ? 'OK' : 'BROKEN')
} else {
  console.log('reset button: MISSING')
}

// 6. today done card (seeded as finished)
const seed = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Karachi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
await page.evaluate(
  ([key, value]) => window.localStorage.setItem(key, JSON.stringify(value)),
  ['dailytest.today.v1', { seed, right: 8, total: 10, at: Date.now() }],
)
await page.goto(`${BASE}/today`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
await shot('9-today-done')
console.log('today done card:', (await bodyText()).includes('Done for today') ? 'OK' : 'BROKEN')

await browser.close()
console.log('done ->', OUT)
