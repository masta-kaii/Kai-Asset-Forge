"use server"

import { uploadAssetBuffer } from "@/lib/firebase/storage"
import { pixelize, defaultTargetSize } from "@/lib/pixel/post-process"

export interface PostProcessResult {
  rawAssetUrl: string
  previewUrl: string
  pixelSize: number
  paletteSize: number
  isTransparent: boolean
}

/**
 * Convert an AI-generated illustration buffer into a real pixel-art deliverable
 * (raw PNG at the target grid size) plus a nearest-neighbor upscaled preview,
 * and upload both to Firebase Storage.
 *
 * Returns null if anything fails — callers are expected to fall back to the
 * original buffer if they want to.
 */
export async function postProcessPixelArt(
  buffer: Uint8Array,
  options: {
    /** e.g. "creature", "ui-icon" — selects default pixel size. */
    assetType: string
    /** Stable suffix for the storage path. */
    identifier: string
    /** Override the default pixel grid size for this asset type. */
    targetSize?: number
  },
): Promise<PostProcessResult | null> {
  try {
    const targetSize = options.targetSize ?? defaultTargetSize(options.assetType)
    const result = await pixelize(Buffer.from(buffer), { targetSize })

    const rawPath = `assets/${options.assetType}/${options.identifier}-raw-${result.width}px.png`
    const previewPath = `assets/${options.assetType}/${options.identifier}-preview.png`

    const [rawAssetUrl, previewUrl] = await Promise.all([
      uploadAssetBuffer(new Uint8Array(result.raw), rawPath, "image/png"),
      uploadAssetBuffer(new Uint8Array(result.display), previewPath, "image/png"),
    ])

    if (!rawAssetUrl || !previewUrl) return null

    return {
      rawAssetUrl,
      previewUrl,
      pixelSize: result.width,
      paletteSize: result.paletteSize,
      isTransparent: result.isTransparent,
    }
  } catch (err) {
    console.error("postProcessPixelArt failed:", err)
    return null
  }
}
