// Resolves the bundled Chromium (from @sparticuz/chromium) for local QA scripts.
// Run once before the shots script if /tmp has been cleared:
//   node scripts/dev/setup-chromium.mjs
import fs from 'node:fs'

export const CHROMIUM_ROOT = '/tmp/chr'

export function chromiumPaths() {
  return {
    executablePath: `${CHROMIUM_ROOT}/chromium`,
    libPath: `${CHROMIUM_ROOT}/root/lib:${CHROMIUM_ROOT}/sw`,
  }
}

export function chromiumReady() {
  return fs.existsSync(chromiumPaths().executablePath)
}
