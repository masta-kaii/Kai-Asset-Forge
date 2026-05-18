"use server"

import { generateImage } from "@/lib/ai/client"
import { createAsset } from "@/lib/firebase/assets"
import { createGeneration } from "@/lib/firebase/generations"
import { uploadAssetBuffer } from "@/lib/firebase/storage"
import { postProcessPixelArt } from "@/app/actions/postprocess"
import type { AssetType, AssetStyle } from "@/lib/types"
import type { ImageGenParams, AIProvider } from "@/lib/ai/types"
import { guardImageGen, logImageCost } from "@/app/actions/budget-guard"
import { doc, updateDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"

async function markProviderDegraded(provider: string, error: string) {
  try {
    const db = getDb()
    await updateDoc(doc(db, "provider_health", provider), {
      status: "degraded", lastError: error, failCount: 1, lastChecked: new Date().toISOString(),
    })
  } catch {}
}

export interface GenerateInput {
  prompt: string
  assetType: AssetType
  style: AssetStyle
  batchCount: number
  provider?: AIProvider
  quality?: "low" | "medium" | "high" | "auto"
}

export interface GenerateResult {
  success: boolean
  assets: {
    id: string
    name: string
    type: AssetType
    style: AssetStyle
    previewUrl: string
    status: string
  }[]
  error?: string
}

async function downloadImageBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
  }
  return response.arrayBuffer()
}

export async function generateAssets(input: GenerateInput): Promise<GenerateResult> {
  try {
    return await generateAssetsInternal(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("generateAssets error:", message)
    return { success: false, assets: [], error: message }
  }
}

async function generateAssetsInternal(input: GenerateInput): Promise<GenerateResult> {
  const { prompt, assetType, style, batchCount, quality, provider } = input

  const imageProvider = provider ?? "openai"
  const guard = await guardImageGen(imageProvider, batchCount)
  if (!guard.allowed) {
    return { success: false, assets: [], error: guard.error }
  }

  const params: ImageGenParams = {
    prompt: `pixel art game asset, ${style.replace(/-/g, " ")}, ${prompt}. 32x32 true pixel art style, limited 16-color palette, sharp pixel edges, no anti-aliasing, no smooth shading, blocky retro aesthetic, transparent background, game-ready sprite.`,
    provider,
    size: "1024x1024",
    n: batchCount,
    quality: quality ?? "auto",
  }

  const result = await generateImage(params)

  if (!result.success || result.images.length === 0) {
    const error = result.error ?? "Generation failed"
    if (error.includes("billing") || error.includes("limit") || error.includes("401") || error.includes("403")) {
      markProviderDegraded(imageProvider, error)
    }
    return { success: false, assets: [], error }
  }

  const timestamp = Date.now()
  let storageErrors = 0

  const assets = await Promise.all(
    result.images.map(async (img, i) => {
      const name = `${assetType}-${style}-${timestamp}-${i + 1}`

      let storageUrl = ""
      try {
        const rawBuffer = img.buffer ?? new Uint8Array(await downloadImageBuffer(img.url))

        // Post-process into pixel art: downscale + quantize
        const pxUrl = await postProcessPixelArt(rawBuffer, {
          targetSize: 128,
          assetType,
          identifier: `${timestamp}-${i + 1}`,
        })

        if (pxUrl) {
          storageUrl = pxUrl
        } else {
          // Post-processing failed, upload original
          const path = `assets/${assetType}/${timestamp}-${i + 1}.png`
          storageUrl = await uploadAssetBuffer(rawBuffer, path, "image/png")
        }
      } catch (uploadErr) {
        console.error(`Storage upload failed for ${name}:`, uploadErr)
        storageErrors++
        return null
      }

      if (!storageUrl) {
        console.error(`Storage upload returned empty URL for ${name}`)
        storageErrors++
        return null
      }

      const asset = await createAsset({
        name,
        type: assetType,
        style,
        previewUrl: storageUrl,
        thumbnailUrl: storageUrl,
        status: "review",
        tags: [assetType, style],
        dimensions: { width: img.width, height: img.height },
        isTransparent: false,
        qualityScore: 0,
      })

      await createGeneration({
        assetId: asset.id,
        agentName: "asset-generator",
        promptId: "",
        generationTime: `${result.images.length}`,
        qualityScore: 0,
        outputUrl: storageUrl,
      })

      return {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        style: asset.style,
        previewUrl: asset.previewUrl,
        status: asset.status,
      }
    })
  )

  const succeeded = assets.filter((a): a is NonNullable<typeof a> => a !== null)

  if (succeeded.length === 0 && result.images.length > 0) {
    return {
      success: false,
      assets: [],
      error: `Firebase Storage upload failed for all ${result.images.length} images. Go to Firebase Console → Storage → Rules and set: allow read, write: if request.auth != null;`,
    }
  }

  logImageCost(imageProvider, "default", result.images.length, params.size ?? "1024x1024", {
    assetType,
    style,
    batchCount: String(batchCount),
  }).catch(() => {})

  return { success: true, assets: succeeded }
}
