"use server"

import { getAssetCount, getRecentAssets } from "@/lib/firebase/assets"
import { getRecentGenerations } from "@/lib/firebase/generations"
import { getReadyPacks, getPacks } from "@/lib/firebase/packs"
import { getActiveWorkflows } from "@/lib/firebase/workflows"
import { getBudgetStatus } from "@/lib/budget/budget"
import { getRecentEntries } from "@/lib/firebase/ledger"
import { autonomousTick, type AutonomousStatus } from "@/app/actions/autonomous-agent"
import { findIncompleteRun } from "@/app/actions/orchestrator"
import type { Asset, AssetPack, GenerationRecord } from "@/lib/types"
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
        getAssetCount().catch(() => 0),
        getRecentAssets(12).catch(() => [] as Asset[]),
        getRecentGenerations(8).catch(() => [] as GenerationRecord[]),
        getReadyPacks().catch(() => 0),
        getActiveWorkflows().then((w) => w.length).catch(() => 0),
        getRecentEntries(10).catch(() => [] as CostEntry[]),
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

export interface CockpitData {
  autonomous: AutonomousStatus
  budget: BudgetStatus
  totalAssets: number
  pendingReview: number
  approvedAssets: number
  recentAssets: Asset[]
  packsReadyToUpload: AssetPack[]
  packsLive: AssetPack[]
  packsInProgress: AssetPack[]
  stuckRunId: string | null
  stuckRunStepsDone: number
  recentCosts: CostEntry[]
}

export async function getCockpitData(): Promise<CockpitData> {
  const [autonomous, totalAssets, recentAssets, packs, stuck, recentCosts] = await Promise.all([
    autonomousTick().catch((): AutonomousStatus => ({
      action: "idle",
      detail: "Scan error",
      timestamp: new Date().toISOString(),
      backlog: { unlistedAssets: 0, stuckRuns: 0, packsToPublish: 0 },
      providers: { openai: "healthy", deepseek: "healthy" },
      budget: { used: 0, cap: 10, remaining: 10 },
      shouldForge: false,
      isProcessing: false,
    })),
    getAssetCount().catch(() => 0),
    getRecentAssets(12).catch(() => [] as Asset[]),
    getPacks().catch(() => [] as AssetPack[]),
    findIncompleteRun().catch(() => null),
    getRecentEntries(8).catch(() => [] as CostEntry[]),
  ])

  const pendingReview = recentAssets.filter((a) => a.status === "review").length
  const approvedAssets = recentAssets.filter((a) => a.status === "approved").length

  const packsReadyToUpload = packs.filter((p) => p.zipUrl && !p.storeUrl)
  const packsLive = packs.filter((p) => !!p.storeUrl)
  const packsInProgress = packs.filter((p) => !p.zipUrl)

  return {
    autonomous,
    budget: getBudgetStatus(),
    totalAssets,
    pendingReview,
    approvedAssets,
    recentAssets,
    packsReadyToUpload,
    packsLive,
    packsInProgress,
    stuckRunId: stuck?.runId ?? null,
    stuckRunStepsDone: stuck?.completedSteps.length ?? 0,
    recentCosts,
  }
}

