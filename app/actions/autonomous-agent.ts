"use server"

import { doc, getDoc, updateDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { getBudgetStatus } from "@/lib/budget/budget"
import { getAssetsByStatus, updateAssetStatus } from "@/lib/firebase/assets"
import { createPack, getPacks } from "@/lib/firebase/packs"
import { findIncompleteRun } from "@/app/actions/orchestrator"
import { buildPackDeliverable } from "@/app/actions/pack-builder"

export interface AutonomousStatus {
  action: "scanning" | "paused" | "packaging" | "publishing" | "forging" | "blocked" | "idle"
  detail: string
  timestamp: string
  backlog: { unlistedAssets: number; stuckRuns: number; packsToPublish: number }
  providers: { openai: string; deepseek: string }
  budget: { used: number; cap: number; remaining: number }
  shouldForge: boolean
  isProcessing: boolean
}

async function getProviderStatus(provider: string): Promise<string> {
  try {
    const snap = await getDoc(doc(getDb(), "provider_health", provider))
    if (!snap.exists()) return "healthy"
    return (snap.data() as Record<string, string>).status ?? "healthy"
  } catch { return "healthy" }
}

async function getUnlistedApprovedAssets(): Promise<{ id: string; type: string; previewUrl: string }[]> {
  const approved = await getAssetsByStatus("approved").catch(() => [])
  const packs = await getPacks().catch(() => [])
  const packedIds = new Set(packs.flatMap((p) => p.assets))
  return approved.filter((a) => !packedIds.has(a.id)).map((a) => ({ id: a.id, type: a.type, previewUrl: a.previewUrl }))
}

export async function autonomousTick(): Promise<AutonomousStatus> {
  const budget = getBudgetStatus()
  const openaiOk = (await getProviderStatus("openai")) !== "down"
  const deepseekOk = (await getProviderStatus("deepseek")) !== "down"

  try {
    // 1. Check for stuck run
    const stuck = await findIncompleteRun()
    if (stuck) {
      const stuckSnap = await getDoc(doc(getDb(), "orchestrator_runs", stuck.runId)).catch(() => null)
      const stuckStatus = (stuckSnap?.data() as Record<string, unknown>)?.status
      if (stuckStatus === "paused_provider") {
        return { action: "blocked", detail: "OpenAI at limit — top up and Resume", timestamp: new Date().toISOString(), backlog: { unlistedAssets: 0, stuckRuns: 1, packsToPublish: 0 }, providers: { openai: "degraded", deepseek: deepseekOk ? "healthy" : "degraded" }, budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining }, shouldForge: false, isProcessing: false }
      }
      // Non-provider stuck — ready to auto-resume
      return { action: "forging", detail: `Auto-resuming stuck run (${stuck.completedSteps.length}/8 steps done)`, timestamp: new Date().toISOString(), backlog: { unlistedAssets: 0, stuckRuns: 1, packsToPublish: 0 }, providers: { openai: openaiOk ? "healthy" : "degraded", deepseek: deepseekOk ? "healthy" : "degraded" }, budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining }, shouldForge: true, isProcessing: true }
    }

    // 2. Auto-package unlisted approved assets
    const unlisted = await getUnlistedApprovedAssets()
    if (unlisted.length >= 1) {
      const batch = unlisted.slice(0, 4)
      try {
        const pack = await createPack({
          title: `${batch[0].type.charAt(0).toUpperCase() + batch[0].type.slice(1)} Pack`,
          description: `Auto-packaged ${batch.length} approved ${batch[0].type} assets.`,
          assets: batch.map((a) => a.id), price: 4.99, status: "review",
          previewUrl: batch[0].previewUrl ?? "",
        })
        for (const a of batch) await updateAssetStatus(a.id, "draft").catch(() => {})
        const built = await buildPackDeliverable(pack.id).catch(() => null)
        const detail = built?.success
          ? `Packaged ${batch.length} assets → "${pack.title}" ZIP ready`
          : `Packaged ${batch.length} assets → "${pack.title}" (ZIP build failed)`
        return { action: "packaging", detail, timestamp: new Date().toISOString(), backlog: { unlistedAssets: unlisted.length - batch.length, stuckRuns: 0, packsToPublish: 1 }, providers: { openai: "healthy", deepseek: "healthy" }, budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining }, shouldForge: false, isProcessing: true }
      } catch (err) {
        console.error("Auto-package failed:", err)
      }
    }

    // 3. Build the deliverable ZIP for any pack that's missing one.
    const packs = await getPacks().catch(() => [])
    const unbuilt = packs.find((p) => !p.zipUrl && p.assets && p.assets.length > 0)
    if (unbuilt) {
      const built = await buildPackDeliverable(unbuilt.id).catch(() => null)
      if (built?.success) {
        return { action: "packaging", detail: `Built deliverable for "${unbuilt.title}" — ready to upload`, timestamp: new Date().toISOString(), backlog: { unlistedAssets: unlisted.length, stuckRuns: 0, packsToPublish: packs.filter((p) => !p.zipUrl).length }, providers: { openai: "healthy", deepseek: "healthy" }, budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining }, shouldForge: false, isProcessing: true }
      }
    }

    // 4. Check budget
    if (budget.isExceeded) {
      return { action: "blocked", detail: `Budget $${budget.monthlyUsed.toFixed(2)}/$${budget.monthlyCap}`, timestamp: new Date().toISOString(), backlog: { unlistedAssets: unlisted.length, stuckRuns: 0, packsToPublish: packs.filter((p) => !p.storeUrl).length }, providers: { openai: openaiOk ? "healthy" : "degraded", deepseek: deepseekOk ? "healthy" : "degraded" }, budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining }, shouldForge: false, isProcessing: false }
    }

    // 5. Check providers
    if (!openaiOk || !deepseekOk) {
      return { action: "blocked", detail: `Providers: OpenAI=${openaiOk ? "up" : "down"}, DeepSeek=${deepseekOk ? "up" : "down"}`, timestamp: new Date().toISOString(), backlog: { unlistedAssets: unlisted.length, stuckRuns: 0, packsToPublish: packs.filter((p) => !p.storeUrl).length }, providers: { openai: openaiOk ? "healthy" : "degraded", deepseek: deepseekOk ? "healthy" : "degraded" }, budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining }, shouldForge: false, isProcessing: false }
    }

    // 6. Idle — ready
    return { action: "idle", detail: "All clear — ready to forge", timestamp: new Date().toISOString(), backlog: { unlistedAssets: unlisted.length, stuckRuns: 0, packsToPublish: packs.filter((p) => !p.storeUrl).length }, providers: { openai: "healthy", deepseek: "healthy" }, budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining }, shouldForge: true, isProcessing: false }
  } catch (e) {
    return { action: "idle", detail: "Scan error", timestamp: new Date().toISOString(), backlog: { unlistedAssets: 0, stuckRuns: 0, packsToPublish: 0 }, providers: { openai: "healthy", deepseek: "healthy" }, budget: { used: 0, cap: 10, remaining: 10 }, shouldForge: false, isProcessing: false }
  }
}
