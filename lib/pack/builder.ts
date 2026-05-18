import { Jimp } from "jimp"
import JSZip from "jszip"

export interface PackAssetInput {
  /** Source PNG bytes (the raw pixel-art deliverable, NOT the upscaled preview). */
  raw: Buffer
  /** Source PNG bytes for preview (upscaled / display version). Used for the grid + cover. */
  preview: Buffer
  /** Filename-safe asset name without extension. */
  filename: string
  /** Human-readable asset type, e.g. "creature". */
  type: string
  pixelSize?: number
}

export interface PackMetadata {
  title: string
  description: string
  slug: string
  price: number
  aiDisclosure?: boolean
  license?: string
}

export interface BuiltPack {
  zip: Buffer
  previewGrid: Buffer
  cover: Buffer
  readmeText: string
}

const DEFAULT_LICENSE = `License — Royalty-free commercial use.
You may use these assets in commercial and personal game projects.
You may modify, edit, and combine them with other work.
You may NOT redistribute or resell the assets as-is (modified or not) as a standalone asset pack.
Attribution is appreciated but not required.`

function safeName(s: string): string {
  return s.replace(/[^a-z0-9\-_]/gi, "_").toLowerCase()
}

function buildReadme(meta: PackMetadata, assets: PackAssetInput[]): string {
  const byType = new Map<string, number>()
  for (const a of assets) byType.set(a.type, (byType.get(a.type) ?? 0) + 1)
  const typeLines = [...byType.entries()].map(([t, n]) => `  - ${t}: ${n}`).join("\n")
  const sizeLine = assets[0]?.pixelSize ? `${assets[0].pixelSize}px pixel art` : "pixel art"
  const lines = [
    meta.title,
    "=".repeat(meta.title.length),
    "",
    meta.description,
    "",
    `Contents (${assets.length} assets, ${sizeLine}):`,
    typeLines,
    "",
    "Folder structure:",
    "  sprites/    — individual sprite PNGs (the buyer-facing assets)",
    "  preview.png — grid preview of all sprites",
    "  cover.png   — pack cover image",
    "  README.txt  — this file",
    "  LICENSE.txt — usage terms",
    "",
    meta.license ?? DEFAULT_LICENSE,
    "",
  ]
  if (meta.aiDisclosure ?? true) {
    lines.push(
      "AI Disclosure: Sprites in this pack were generated with AI assistance",
      "and post-processed (downscale, palette quantization, background removal)",
      "into pixel-art deliverables.",
      "",
    )
  }
  return lines.join("\n")
}

async function buildPreviewGrid(
  previewBuffers: Buffer[],
  cell = 256,
  maxCols = 4,
): Promise<Buffer> {
  const count = Math.min(previewBuffers.length, maxCols * maxCols)
  const cols = Math.min(maxCols, count)
  const rows = Math.ceil(count / cols)
  const W = cols * cell
  const H = rows * cell

  const canvas = new Jimp({ width: W, height: H, color: 0xffffffff })

  for (let i = 0; i < count; i++) {
    const tile = await Jimp.fromBuffer(previewBuffers[i])
    tile.contain({ w: cell, h: cell })
    const col = i % cols
    const row = Math.floor(i / cols)
    canvas.composite(tile, col * cell, row * cell)
  }

  return await canvas.getBuffer("image/png")
}

async function buildCover(previewGrid: Buffer, w = 630, h = 500): Promise<Buffer> {
  const img = await Jimp.fromBuffer(previewGrid)
  img.cover({ w, h })
  return await img.getBuffer("image/png")
}

/**
 * Assemble a buyer-facing ZIP deliverable + preview grid + cover image
 * from the already-downloaded asset buffers.
 */
export async function buildPack(
  meta: PackMetadata,
  assets: PackAssetInput[],
): Promise<BuiltPack> {
  if (assets.length === 0) {
    throw new Error("buildPack: at least one asset required")
  }

  const previewGrid = await buildPreviewGrid(assets.map((a) => a.preview))
  const cover = await buildCover(previewGrid)
  const readmeText = buildReadme(meta, assets)

  const zip = new JSZip()
  const root = zip.folder(meta.slug)
  if (!root) throw new Error("buildPack: could not create root folder")
  const sprites = root.folder("sprites")
  if (!sprites) throw new Error("buildPack: could not create sprites folder")

  for (const a of assets) {
    sprites.file(`${safeName(a.filename)}.png`, a.raw)
  }
  root.file("preview.png", previewGrid)
  root.file("cover.png", cover)
  root.file("README.txt", readmeText)
  root.file("LICENSE.txt", meta.license ?? DEFAULT_LICENSE)

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })

  return { zip: zipBuffer, previewGrid, cover, readmeText }
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}
