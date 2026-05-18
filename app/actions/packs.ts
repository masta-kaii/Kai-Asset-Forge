"use server"

import { createPack, getPacks, updatePackAssets } from "@/lib/firebase/packs"
import type { AssetPack } from "@/lib/types"

export async function fetchPacks(): Promise<AssetPack[]> {
  return getPacks()
}

export async function createNewPack(data: {
  title: string
  description: string
  assets: string[]
  price: number
  previewUrl: string
}): Promise<AssetPack> {
  return createPack({
    title: data.title,
    description: data.description,
    assets: data.assets,
    price: data.price,
    status: "review",
    previewUrl: data.previewUrl,
  })
}

export async function markPackPublished(packId: string): Promise<void> {
  await updatePackAssets(packId, [])
}
