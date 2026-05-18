"use server"

import { doc, getDoc, updateDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { getBudgetStatus } from "@/lib/budget/budget"
import { getAssetsByStatus, updateAssetStatus } from "@/lib/firebase/assets"
import { createPack, getPacks } from "@/lib/firebase/packs"
import { findIncompleteRun } from "@/app/actions/orchestrator"
import { publishPack } from "@/app/actions/marketplace"

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
        await publishPack(pack).catch(() => {})
        return { action: "packaging", detail: `Packaged ${batch.length} assets → published "${pack.title}"`, timestamp: new Date().toISOString(), backlog: { unlistedAssets: unlisted.length - batch.length, stuckRuns: 0, packsToPublish: 1 }, providers: { openai: "healthy", deepseek: "healthy" }, budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining }, shouldForge: false, isProcessing: true }
      } catch (err) {
        console.error("Auto-package failed:", err)
      }
    }

    // 3. Publish any unpublished packs
    const packs = await getPacks().catch(() => [])
    const unpub = packs.find((p) => !p.storeUrl)
    if (unpub) {
      try {
        await publishPack(unpub)
        return { action: "publishing", detail: `Published "${unpub.title}" to marketplace`, timestamp: new Date().toISOString(), backlog: { unlistedAssets: unlisted.length, stuckRuns: 0, packsToPublish: packs.filter((p) => !p.storeUrl).length }, providers: { openai: "healthy", deepseek: "healthy" }, budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining }, shouldForge: false, isProcessing: true }
      } catch {}
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
