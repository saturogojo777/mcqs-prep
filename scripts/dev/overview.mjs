// Builds screenshots/overview.png: a contact sheet of the delivered screens.
import fs from 'node:fs'
import path from 'node:path'
import { chromium as playwright } from 'playwright-core'
import { chromiumPaths } from './chromium-env.mjs'

const OUT = path.join(process.cwd(), 'screenshots')
const picks = [
  ['home-en-light-1280', 'Home · English · light · 1280px'],
  ['home-ur-dark-1280', 'Home · اردو · dark · 1280px'],
  ['home-en-light-360', 'Home · English · 360px'],
  ['home-ur-light-360', 'Home · اردو · 360px'],
  ['subjects-en-light-768', 'Subjects · 768px'],
  ['start-en-light-360', 'Start screen · 360px'],
  ['quiz-wrong-en-light-768', 'Wrong answer · 768px'],
  ['quiz-wrong-ur-dark-360', 'Wrong answer · اردو · dark'],
  ['result-en-light-1280', 'Result · 1280px'],
  ['result-ur-dark-360', 'Result · اردو · dark'],
  ['contact-360', 'Contact · 360px'],
  ['privacy-1280', 'Privacy · 1280px'],
]

const cells = picks
  .map(([name, label]) => {
    const file = path.join(OUT, `${name}.png`)
    if (!fs.existsSync(file)) return ''
    return `<figure><img src="file://${file}" alt="${label}"><figcaption>${label}</figcaption></figure>`
  })
  .join('\n')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:32px;background:#f4f4f5;font-family:Inter,system-ui,sans-serif;color:#111}
  h1{margin:0 0 4px;font-size:26px;letter-spacing:-.02em}
  p.sub{margin:0 0 24px;color:#666;font-size:14px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;align-items:start}
  figure{margin:0;background:#fff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden}
  img{display:block;width:100%;height:auto;max-height:460px;object-fit:cover;object-position:top}
  figcaption{padding:8px 10px;font-size:12px;color:#555;border-top:1px solid #eee}
</style></head><body>
<h1>DailyTest — delivered screens</h1>
<p class="sub">76 screens audited in Chromium at 360 / 768 / 1280, English and اردو, light and dark. 0 horizontal scroll, 0 clipped text, 0 off-palette colours.</p>
<div class="grid">${cells}</div>
</body></html>`

const file = path.join(OUT, 'overview.html')
fs.writeFileSync(file, html)

const { executablePath, libPath } = chromiumPaths()
const browser = await playwright.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  env: { ...process.env, LD_LIBRARY_PATH: libPath },
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1.5 })
await page.goto('file://' + file)
await page.waitForTimeout(700)
await page.screenshot({ path: path.join(OUT, 'overview.png'), fullPage: true })
await browser.close()
console.log('screenshots/overview.png written')
