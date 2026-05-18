"use server"

import { getAssetCount, getRecentAssets } from "@/lib/firebase/assets"
import { getRecentGenerations } from "@/lib/firebase/generations"
import { getReadyPacks } from "@/lib/firebase/packs"
import { getActiveWorkflows } from "@/lib/firebase/workflows"
import { getBudgetStatus } from "@/lib/budget/budget"
import { getRecentEntries } from "@/lib/firebase/ledger"
import type { Asset } from "@/lib/types"
import type { BudgetStatus, CostEntry } from "@/lib/budget/types"

export interface DashboardData {
  totalAssets: number
  recentAssets: Asset[]
  recentGenerations: { assetId: string; createdAt: string }[]
  readyPacks: number
  activeWorkflows: number
  budget: BudgetStatus
  recentCosts: CostEntry[]
  error?: string
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const [totalAssets, recentAssets, recentGenerations, readyPacks, activeWorkflows, recentCosts] =
      await Promise.all([
        getAssetCount(),
        getRecentAssets(12),
        getRecentGenerations(8),
        getReadyPacks(),
        getActiveWorkflows().then((w) => w.length),
        getRecentEntries(10),
      ])

    const budget = getBudgetStatus()

    return {
      totalAssets,
      recentAssets,
      recentGenerations: recentGenerations.map((g) => ({
        assetId: g.assetId,
        createdAt: g.createdAt,
      })),
      readyPacks,
      activeWorkflows,
      budget,
      recentCosts,
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
      budget: { dailyUsed: 0, monthlyUsed: 0, dailyRemaining: 0, monthlyRemaining: 0, dailyCap: 0, monthlyCap: 0, dailyPercent: 0, monthlyPercent: 0, isExceeded: false, lastResetDaily: "", lastResetMonthly: "" },
      recentCosts: [],
      error: message,
    }
  }
}

