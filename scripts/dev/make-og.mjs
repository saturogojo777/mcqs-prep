// Renders the social preview card from local HTML and writes public/og.png.
// Chromium is already needed for the design audit, so this reuses it instead of
// shipping a heavy image library.
//
//   node scripts/dev/setup-chromium.mjs && node scripts/dev/make-og.mjs

import path from 'node:path'
import { chromium as playwright } from 'playwright-core'
import { chromiumPaths, chromiumReady } from './chromium-env.mjs'

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1200px; height: 630px; }
  body {
    background: #ffffff;
    color: #101012;
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    display: grid;
    grid-template-rows: auto 1fr auto;
    padding: 64px 72px;
  }
  .top { display: flex; align-items: center; gap: 16px; }
  .mark {
    width: 56px; height: 56px; border-radius: 16px; background: #101012;
    display: grid; place-items: center;
  }
  .mark svg { display: block; }
  .name { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
  h1 {
    margin: 0; align-self: center; font-size: 76px; line-height: 1.04;
    letter-spacing: -0.035em; font-weight: 700; max-width: 900px;
  }
  h1 span { display: block; color: #74747c; font-weight: 500; font-size: 40px; margin-top: 22px; letter-spacing: -0.02em; }
  .bottom { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #e2e2e6; padding-top: 24px; }
  .tags { display: flex; gap: 10px; flex-wrap: wrap; }
  .tag { border: 1px solid #e2e2e6; border-radius: 999px; padding: 6px 14px; font-size: 20px; color: #5b5b62; }
  .url { font-size: 20px; color: #74747c; }
</style></head>
<body>
  <div class="top">
    <div class="mark">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 4h7a8 8 0 0 1 0 16H5z"/><path d="M9 9h2.5M9 13h2.5"/>
      </svg>
    </div>
    <div class="name">DailyTest</div>
  </div>
  <h1>Daily practice for Pakistan's exams<span>PPSC · FPSC · NTS · CSS · Police · Teachers · MDCAT</span></h1>
  <div class="bottom">
    <div class="tags">
      <span class="tag">Free</span><span class="tag">No sign-up</span><span class="tag">English + اردو</span>
    </div>
    <div class="url">Practice · Mock tests · Explanations</div>
  </div>
</body></html>`

if (!chromiumReady()) {
  console.error('Chromium is missing. Run: node scripts/dev/setup-chromium.mjs')
  process.exit(1)
}

const { executablePath, libPath } = chromiumPaths()
const browser = await playwright.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none', '--hide-scrollbars'],
  env: { ...process.env, LD_LIBRARY_PATH: libPath },
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(HTML, { waitUntil: 'load' })
await page.screenshot({ path: path.join(process.cwd(), 'public/og.png'), type: 'png' })
await browser.close()
console.log('public/og.png written')
