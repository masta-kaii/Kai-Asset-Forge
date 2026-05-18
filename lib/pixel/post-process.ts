import { Jimp } from "jimp"

export interface PixelizeOptions {
  /** Target pixel grid size, e.g. 32 / 48 / 64 / 96 / 128. */
  targetSize?: number
  /** Steps per RGB channel — 4 yields 4³ = 64 possible colors. */
  paletteLevels?: number
  /** Strip a solid-ish background to transparent alpha. */
  removeBackground?: boolean
  /** Sum-of-channel-distance threshold for background classification. */
  bgThreshold?: number
  /** Nearest-neighbor upscale factor for the preview image. */
  displayScale?: number
}

export interface PixelizeResult {
  /** The actual pixel-art deliverable, sized targetSize × targetSize. */
  raw: Buffer
  /** Same image upscaled with nearest-neighbor for display in the UI. */
  display: Buffer
  width: number
  height: number
  isTransparent: boolean
  /** Distinct opaque colors after quantization — a quality signal. */
  paletteSize: number
}

function averageDownsample(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 4)
  const blockW = srcW / dstW
  const blockH = srcH / dstH
  for (let y = 0; y < dstH; y++) {
    const y0 = Math.floor(y * blockH)
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * blockH))
    for (let x = 0; x < dstW; x++) {
      const x0 = Math.floor(x * blockW)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * blockW))
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        n = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * srcW + xx) * 4
          r += src[i]
          g += src[i + 1]
          b += src[i + 2]
          a += src[i + 3]
          n++
        }
      }
      const di = (y * dstW + x) * 4
      dst[di] = Math.round(r / n)
      dst[di + 1] = Math.round(g / n)
      dst[di + 2] = Math.round(b / n)
      dst[di + 3] = Math.round(a / n)
    }
  }
  return dst
}

function posterize(buf: Uint8Array, levels: number) {
  if (levels < 2) return
  const step = 255 / (levels - 1)
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = Math.round(Math.round(buf[i] / step) * step)
    buf[i + 1] = Math.round(Math.round(buf[i + 1] / step) * step)
    buf[i + 2] = Math.round(Math.round(buf[i + 2] / step) * step)
  }
}

function removeBackgroundInPlace(
  buf: Uint8Array,
  w: number,
  h: number,
  threshold: number,
) {
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return { r: buf[i], g: buf[i + 1], b: buf[i + 2] }
  }
  const corners = [sample(0, 0), sample(w - 1, 0), sample(0, h - 1), sample(w - 1, h - 1)]
  const bg = {
    r: Math.round(corners.reduce((s, c) => s + c.r, 0) / corners.length),
    g: Math.round(corners.reduce((s, c) => s + c.g, 0) / corners.length),
    b: Math.round(corners.reduce((s, c) => s + c.b, 0) / corners.length),
  }
  for (let i = 0; i < buf.length; i += 4) {
    const d =
      Math.abs(buf[i] - bg.r) +
      Math.abs(buf[i + 1] - bg.g) +
      Math.abs(buf[i + 2] - bg.b)
    if (d < threshold) buf[i + 3] = 0
  }
}

function nearestUpsample(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  scale: number,
): { data: Uint8Array; w: number; h: number } {
  const w = srcW * scale
  const h = srcH * scale
  const dst = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const sy = Math.floor(y / scale)
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(x / scale)
      const si = (sy * srcW + sx) * 4
      const di = (y * w + x) * 4
      dst[di] = src[si]
      dst[di + 1] = src[si + 1]
      dst[di + 2] = src[si + 2]
      dst[di + 3] = src[si + 3]
    }
  }
  return { data: dst, w, h }
}

function countDistinctColors(buf: Uint8Array): number {
  const set = new Set<number>()
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i + 3] === 0) continue
    set.add((buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2])
  }
  return set.size
}

async function encodePng(data: Uint8Array, w: number, h: number): Promise<Buffer> {
  // Jimp 1.x stores pixel data as a Buffer on bitmap.data. Swap in our own.
  const img = new Jimp({ width: w, height: h })
  img.bitmap.data = Buffer.from(data)
  return await img.getBuffer("image/png")
}

/**
 * Convert an AI-generated illustration into a real pixel-art asset:
 * average-pool downsample → palette quantize → background → transparent.
 * Returns the raw deliverable plus a nearest-neighbor upscaled preview.
 */
export async function pixelize(
  input: Buffer,
  opts: PixelizeOptions = {},
): Promise<PixelizeResult> {
  const targetSize = opts.targetSize ?? 64
  const paletteLevels = opts.paletteLevels ?? 4
  const removeBg = opts.removeBackground ?? true
  const bgThreshold = opts.bgThreshold ?? 90
  const displayScale = opts.displayScale ?? 8

  const src = await Jimp.fromBuffer(input)
  const srcW = src.bitmap.width
  const srcH = src.bitmap.height
  const srcData = new Uint8Array(src.bitmap.data.buffer, src.bitmap.data.byteOffset, src.bitmap.data.byteLength)

  const downsampled = averageDownsample(srcData, srcW, srcH, targetSize, targetSize)
  posterize(downsampled, paletteLevels)

  let isTransparent = false
  if (removeBg) {
    removeBackgroundInPlace(downsampled, targetSize, targetSize, bgThreshold)
    isTransparent = true
  }

  const paletteSize = countDistinctColors(downsampled)
  const raw = await encodePng(downsampled, targetSize, targetSize)
  const upscaled = nearestUpsample(downsampled, targetSize, targetSize, displayScale)
  const display = await encodePng(upscaled.data, upscaled.w, upscaled.h)

  return {
    raw,
    display,
    width: targetSize,
    height: targetSize,
    isTransparent,
    paletteSize,
  }
}

/** Default pixel grid for each asset type. */
export function defaultTargetSize(assetType: string): number {
  switch (assetType) {
    case "ui-icon":
      return 32
    case "food":
    case "material":
      return 48
    case "creature":
    case "accessory":
    case "item":
    case "weapon":
    case "animation":
    default:
      return 64
  }
}
