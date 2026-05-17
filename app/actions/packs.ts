"use server"

import { createPack, getPacks } from "@/lib/firebase/packs"
import { fetchAssetsByStatus } from "@/app/actions/assets"
import type { AssetPack, Asset } from "@/lib/types"

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
