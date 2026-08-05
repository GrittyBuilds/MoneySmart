// Generates the PWA PNG icons without any image dependencies.
// Draws a rounded green tile with a white "$" glyph, then encodes a PNG by hand.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public')
mkdirSync(outDir, { recursive: true })

const BG = [16, 185, 129] // brand-500 #10b981
const BG2 = [5, 150, 105] // brand-600 for a subtle diagonal
const FG = [255, 255, 255]

function inRoundedRect(x, y, w, h, r) {
  const rx = Math.min(r, w / 2)
  const cx = Math.max(rx, Math.min(x, w - rx))
  const cy = Math.max(rx, Math.min(y, h - rx))
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= rx * rx
}

// Coarse pixel font for the "$" sign, scaled to fill the tile.
// 7 columns x 9 rows grid.
const GLYPH = [
  '..X..',
  '.XXX.',
  'X.X.X',
  'X.X..',
  '.XXX.',
  '..X.X',
  'X.X.X',
  '.XXX.',
  '..X..',
]

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4)
  const r = Math.round(size * 0.22)
  const cols = GLYPH[0].length
  const rows = GLYPH.length
  const cell = Math.floor(size * 0.62 / rows)
  const gw = cols * cell
  const gh = rows * cell
  const ox = Math.floor((size - gw) / 2)
  const oy = Math.floor((size - gh) / 2)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const inside = inRoundedRect(x, y, size, size, r)
      if (!inside) {
        buf[i] = 0
        buf[i + 1] = 0
        buf[i + 2] = 0
        buf[i + 3] = 0
        continue
      }
      // diagonal gradient background
      const t = (x + y) / (2 * size)
      let col = [
        Math.round(BG[0] * (1 - t) + BG2[0] * t),
        Math.round(BG[1] * (1 - t) + BG2[1] * t),
        Math.round(BG[2] * (1 - t) + BG2[2] * t),
      ]
      // glyph
      const gx = Math.floor((x - ox) / cell)
      const gy = Math.floor((y - oy) / cell)
      if (gx >= 0 && gx < cols && gy >= 0 && gy < rows && GLYPH[gy][gx] === 'X') {
        col = FG
      }
      buf[i] = col[0]
      buf[i + 1] = col[1]
      buf[i + 2] = col[2]
      buf[i + 3] = 255
    }
  }
  return buf
}

// --- Minimal PNG encoder (RGBA, no interlace) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  const png = encodePNG(drawIcon(size), size)
  writeFileSync(join(outDir, name), png)
  console.log(`wrote public/${name} (${png.length} bytes)`)
}
