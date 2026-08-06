// Rasterizes the MoneySmart coin mark into PNG app icons using headless
// Chromium (no image libraries). Run: node scripts/make-icons.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '..')
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

function markSVG(size, rx) {
  return `<svg viewBox="0 0 512 512" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2FBF87"/><stop offset="1" stop-color="#159C6A"/></linearGradient>
      <linearGradient id="ar" x1="150" y1="330" x2="360" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#159C6A"/><stop offset="1" stop-color="#2FBF87"/></linearGradient>
    </defs>
    <rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>
    <circle cx="256" cy="256" r="156" fill="#fff"/>
    <path d="M148 306 C 186 306, 206 322, 236 306 S 300 236, 336 188" fill="none" stroke="url(#ar)" stroke-width="30" stroke-linecap="round"/>
    <path d="M300 176 L 352 168 L 348 220" fill="none" stroke="url(#ar)" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="176" cy="252" r="12" fill="#FFC94D"/>
    <circle cx="228" cy="238" r="10" fill="#FF8A5B"/>
  </svg>`
}

// [filename, pixel size, corner radius (in 512 space), transparent corners?]
const TARGETS = [
  ['icon-192.png', 192, 118, true],
  ['icon-512.png', 512, 118, true],
  ['icon-maskable-512.png', 512, 0, false],
  ['apple-touch-icon.png', 180, 0, false],
]

const browser = await pw.chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const [name, size, rx, transparent] of TARGETS) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;padding:0">${markSVG(size, rx)}</body></html>`,
    { waitUntil: 'load' },
  )
  const el = await page.$('svg')
  await el.screenshot({ path: join(out, name), omitBackground: transparent })
  console.log('wrote', name, `${size}x${size}`)
}
await browser.close()
