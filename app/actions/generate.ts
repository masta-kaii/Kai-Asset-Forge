"use server"

import { generateImage } from "@/lib/ai/client"
import { createAsset } from "@/lib/firebase/assets"
import { createGeneration } from "@/lib/firebase/generations"
import { uploadAssetBuffer } from "@/lib/firebase/storage"
import type { AssetType, AssetStyle } from "@/lib/types"
import type { ImageGenParams, AIProvider } from "@/lib/ai/types"

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

  const params: ImageGenParams = {
    prompt,
    provider,
    size: "1024x1024",
    n: batchCount,
    quality: quality ?? "auto",
  }

  const result = await generateImage(params)

  if (!result.success || result.images.length === 0) {
    return { success: false, assets: [], error: result.error ?? "Generation failed" }
  }

  const timestamp = Date.now()

  const assets = await Promise.all(
    result.images.map(async (img, i) => {
      const name = `${assetType}-${style}-${timestamp}-${i + 1}`

      let storageUrl = img.url
      try {
        const rawBuffer = img.buffer ?? new Uint8Array(await downloadImageBuffer(img.url))
        const path = `assets/${assetType}/${timestamp}-${i + 1}.png`
        storageUrl = await uploadAssetBuffer(rawBuffer, path, "image/png")
      } catch {
        // fall back to OpenAI CDN URL if storage upload fails
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

  return { success: true, assets }
}
