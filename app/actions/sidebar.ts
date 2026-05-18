"use server"

import { getAssetCount, getAssetsByStatus } from "@/lib/firebase/assets"
import { getPacks } from "@/lib/firebase/packs"
import { getActiveWorkflows } from "@/lib/firebase/workflows"
import { findIncompleteRun } from "@/app/actions/orchestrator"
import { getBudgetStatus } from "@/lib/budget/budget"

export interface SidebarBadges {
  totalAssets: number
  pendingReview: number
  readyToUpload: number
  liveOnStore: number
  stuckRun: boolean
  budgetExceeded: boolean
  monthlyPercent: number
}

export async function getSidebarStats(): Promise<SidebarBadges> {
  const [totalAssets, review, packs, active, stuck] = await Promise.all([
    getAssetCount().catch(() => 0),
    getAssetsByStatus("review").catch(() => []),
    getPacks().catch(() => []),
    getActiveWorkflows().then((w) => w.length).catch(() => 0),
    findIncompleteRun().catch(() => null),
  ])
  const readyToUpload = packs.filter((p) => p.zipUrl && !p.storeUrl).length
  const liveOnStore = packs.filter((p) => !!p.storeUrl).length
  const budget = getBudgetStatus()
  void active
  return {
    totalAssets,
    pendingReview: review.length,
    readyToUpload,
    liveOnStore,
    stuckRun: !!stuck,
    budgetExceeded: budget.isExceeded,
    monthlyPercent: Math.round(budget.monthlyPercent ?? 0),
  }
}
