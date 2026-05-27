import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const FORGE_DIR = join(process.cwd(), 'forge-output', 'generated')

// Generate pixel data (same logic as factory genPixels)
function genPixels(pal: string[], type: string): string[][] {
  const bg = pal[0] || '#1a1a2e', cols = pal.slice(1)
  const g: string[][] = Array.from({ length: 16 }, () => Array(16).fill(bg))
  const c = (x: number, y: number, i = 0) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = cols[i % cols.length] }

  if (type === 'character') {
    for (let x = 5; x <= 10; x++) { c(x, 2, 0); c(x, 3, 0); c(x, 4, 0) }
    g[3][6] = cols[0]; g[3][9] = cols[0]
    for (let y = 5; y <= 9; y++) for (let x = 4; x <= 11; x++) c(x, y, 1)
    for (let y = 5; y <= 8; y++) { c(3, y, 2); c(12, y, 2) }
    for (let y = 10; y <= 14; y++) { c(5, y, 2); c(6, y, 2); c(9, y, 2); c(10, y, 2) }
  } else if (type === 'item') {
    const cx = 8, cy = 8, r = 5
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (d < r) c(x, y, d < r * .4 ? 0 : d < r * .7 ? 1 : 2)
    }
  } else if (type === 'tile') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 4 < 2) c(x, y, (x + y) % 4)
    for (let x = 0; x < 16; x++) { c(x, 0, 3); c(x, 15, 3) }
    for (let y = 0; y < 16; y++) { c(0, y, 3); c(15, y, 3) }
  } else {
    const cx = 8, cy = 8
    for (let i = 0; i < 12; i++) {
      const a = i * (Math.PI * 2 / 12), r = i % 2 === 0 ? 6 : 3
      c(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), i % 2 === 0 ? 0 : 1)
    }
    c(8, 8, 0)
  }
  return g
}

// Convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

// Generate a minimal PNG (16x16 pixel art)
function generatePNG(pixels: string[][]): Buffer {
  const size = 16
  // Minimal PNG encoder for 16x16 RGBA
  const rawData: number[] = []
  for (let y = 0; y < size; y++) {
    rawData.push(0) // filter byte
    for (let x = 0; x < size; x++) {
      const [r, g, b] = hexToRgb(pixels[y][x])
      rawData.push(r, g, b, 255)
    }
  }

  // Deflate the raw image data
  const zlib = require('zlib')
  const deflated = zlib.deflateSync(Buffer.from(rawData))

  // Build PNG
  const chunks: Buffer[] = []
  // Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  chunks.push(pngChunk('IHDR', ihdr))
  // IDAT
  chunks.push(pngChunk('IDAT', deflated))
  // IEND
  chunks.push(pngChunk('IEND', Buffer.alloc(0)))

  return Buffer.concat(chunks)
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeB = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeB, data])
  const crc = crc32(crcData)
  const crcB = Buffer.alloc(4)
  crcB.writeUInt32BE(crc, 0)
  return Buffer.concat([len, typeB, data, crcB])
}

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const theme = body.theme || 'dungeon'
    const assetType = body.type || 'character'

    // Generate palette based on theme
    const palettes: Record<string, string[]> = {
      dungeon: ['#1a1a2e', '#e94560', '#0f3460', '#16213e', '#f5a623'],
      fantasy: ['#2d1b4e', '#4ade80', '#c084fc', '#1e3a5f', '#f5a623'],
      scifi: ['#0a0a1a', '#22d3ee', '#7c3aed', '#1e1b4b', '#e2e8f0'],
      nature: ['#1a2e1a', '#4ade80', '#166534', '#3b82f6', '#f5a623'],
    }
    const palette = palettes[theme.toLowerCase()] || palettes.dungeon

    // Generate pixel data
    const pixels = genPixels(palette, assetType)

    // Generate PNG
    const png = generatePNG(pixels)

    // Save to forge-output/generated/
    if (!existsSync(FORGE_DIR)) {
      await mkdir(FORGE_DIR, { recursive: true })
    }

    const ts = Date.now()
    const filename = `${theme}-${assetType}-${ts}.png`
    const filepath = join(FORGE_DIR, filename)
    await writeFile(filepath, png)

    return NextResponse.json({
      success: true,
      asset: {
        name: `${theme}-${assetType}`,
        filename,
        path: `/api/library/image?file=${encodeURIComponent(`generated/${filename}`)}`,
        category: 'generated',
        type: assetType,
        size: png.length,
        palette,
        pixels,
        layers: ['background', 'base', 'details', 'outline'],
        animationFrames: 1,
        description: `${theme}-themed ${assetType} sprite generated by Kai Asset Forge`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
