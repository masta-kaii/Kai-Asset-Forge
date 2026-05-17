"use server"

import { getAssetCount, getRecentAssets } from "@/lib/firebase/assets"
import { getRecentGenerations } from "@/lib/firebase/generations"
import { getReadyPacks } from "@/lib/firebase/packs"
import { getActiveWorkflows } from "@/lib/firebase/workflows"
import type { Asset, GenerationRecord } from "@/lib/types"

export interface DashboardData {
  totalAssets: number
  recentAssets: Asset[]
  recentGenerations: { assetId: string; createdAt: string }[]
  readyPacks: number
  activeWorkflows: number
  error?: string
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const [totalAssets, recentAssets, recentGenerations, readyPacks, activeWorkflows] =
      await Promise.all([
        getAssetCount(),
        getRecentAssets(12),
        getRecentGenerations(8),
        getReadyPacks(),
        getActiveWorkflows().then((w) => w.length),
      ])

    return {
      totalAssets,
      recentAssets,
      recentGenerations: recentGenerations.map((g) => ({
        assetId: g.assetId,
        createdAt: g.createdAt,
      })),
      readyPacks,
      activeWorkflows,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard"
    console.error("Dashboard data error:", message)
    return {
      totalAssets: 0,
      recentAssets: [],
      recentGenerations: [],
      readyPacks: 0,
      activeWorkflows: 0,
      error: message,
    }
  }
}
