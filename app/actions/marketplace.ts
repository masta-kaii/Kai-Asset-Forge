"use server"

import { publishToItchIO, isItchIOConfigured } from "@/lib/marketplace/itchio"
import { publishToGumroad, isGumroadConfigured } from "@/lib/marketplace/gumroad"
import type { AssetPack } from "@/lib/types"

export interface MarketplaceResult {
  success: boolean
  platform: string
  url?: string
  error?: string
}

export async function publishPack(pack: AssetPack): Promise<MarketplaceResult[]> {
  const results: MarketplaceResult[] = []

  // itch.io
  if (isItchIOConfigured()) {
    const result = await publishToItchIO({
      title: pack.title,
      description: pack.description,
      price: pack.price,
      tags: [],
      files: pack.assets.map((id) => ({ name: `${id}.png`, url: pack.previewUrl })),
      aiDisclosure: true,
    })
    results.push({ success: result.success, platform: "itch.io", url: result.url, error: result.error })
  } else {
    results.push({ success: false, platform: "itch.io", url: undefined, error: "API key not configured" })
  }

  // Gumroad
  if (isGumroadConfigured()) {
    const result = await publishToGumroad({
      title: pack.title,
      description: pack.description,
      price: pack.price,
      tags: [],
      previewUrl: pack.previewUrl,
      aiDisclosure: true,
    })
    results.push({ success: result.success, platform: "Gumroad", url: result.url, error: result.error })
  } else {
    results.push({ success: false, platform: "Gumroad", url: undefined, error: "API key not configured" })
  }

  return results
}
