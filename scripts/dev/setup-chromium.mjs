// Decompresses @sparticuz/chromium into /tmp/chr so playwright-core can launch
// it inside the sandbox (no root, no apt). Run once per fresh sandbox.
import fs from 'node:fs'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'

const dir = '/tmp/chr'
fs.mkdirSync(dir, { recursive: true })

for (const name of ['al2023.tar.br', 'swiftshader.tar.br', 'fonts.tar.br', 'chromium.br']) {
  const out = `${dir}/${name.replace('.br', '')}`
  if (!fs.existsSync(out)) {
    const body = zlib.brotliDecompressSync(fs.readFileSync(`node_modules/@sparticuz/chromium/bin/${name}`))
    fs.writeFileSync(out, body)
    console.log('extracted', out)
  }
}

const run = (args) => execFileSync('tar', args, { stdio: 'inherit' })
if (!fs.existsSync(`${dir}/root/lib`)) run(['-xf', `${dir}/al2023.tar`, '-C', `${dir}/root`])
if (!fs.existsSync(`${dir}/sw`)) {
  fs.mkdirSync(`${dir}/sw`, { recursive: true })
  run(['-xf', `${dir}/swiftshader.tar`, '-C', `${dir}/sw`])
}
fs.chmodSync(`${dir}/chromium`, 0o755)
console.log('chromium ready at', `${dir}/chromium`)
