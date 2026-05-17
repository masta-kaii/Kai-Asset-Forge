"use server"

import { getRecentAssets, getAssetsByType, getAssetsByStatus, updateAssetStatus } from "@/lib/firebase/assets"
import type { Asset, AssetStatus } from "@/lib/types"

export async function fetchRecentAssets(count: number): Promise<Asset[]> {
  return getRecentAssets(count)
}

export async function fetchAssetsByType(type: string): Promise<Asset[]> {
  return getAssetsByType(type)
}

export async function fetchAssetsByStatus(status: string): Promise<Asset[]> {
  return getAssetsByStatus(status)
}

export async function approveAsset(assetId: string): Promise<void> {
  await updateAssetStatus(assetId, "approved")
}

export async function rejectAsset(assetId: string): Promise<void> {
  await updateAssetStatus(assetId, "rejected")
}
