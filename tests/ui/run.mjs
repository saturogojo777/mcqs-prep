// Bundles the UI harness with esbuild, sets up jsdom and runs it.
// Usage: node tests/ui/run.mjs

import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const outfile = path.join(root, '.next', 'ui-harness.mjs')

mkdirSync(path.dirname(outfile), { recursive: true })

await build({
  entryPoints: [path.join(here, 'harness.tsx')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  jsx: 'automatic',
  tsconfig: path.join(root, 'tsconfig.json'),
  alias: {
    '@/lib/supabase': path.join(here, 'stub-supabase.ts'),
  },
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'warning',
})

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: 'https://mcqs-prep.test/',
  pretendToBeVisual: true,
})

global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.HTMLElement = dom.window.HTMLElement
global.Element = dom.window.Element
global.Node = dom.window.Node
global.Event = dom.window.Event
global.MouseEvent = dom.window.MouseEvent
global.localStorage = dom.window.localStorage
global.getComputedStyle = dom.window.getComputedStyle
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
global.IS_REACT_ACT_ENVIRONMENT = true

setTimeout(() => {
  console.error('watchdog: harness did not finish in 25s')
  process.exit(2)
}, 25000)

await import(`${outfile}?t=${Date.now()}`)
