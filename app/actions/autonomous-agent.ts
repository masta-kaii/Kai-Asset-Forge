"use server"

import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { getBudgetStatus } from "@/lib/budget/budget"
import { getRecentAssets, getAssetsByStatus, updateAssetStatus } from "@/lib/firebase/assets"
import { getReadyPacks, createPack, getPacks } from "@/lib/firebase/packs"
import { findIncompleteRun, runOrchestrator } from "@/app/actions/orchestrator"
import { publishPack } from "@/app/actions/marketplace"
import { generateText, generateImage } from "@/lib/ai/client"

const PROVIDERS_COLLECTION = "provider_health"

interface ProviderHealth {
  id: string
  provider: string
  status: "healthy" | "degraded" | "down"
  lastError?: string
  lastChecked: string
  failCount: number
}

export interface AutonomousStatus {
  action: string
  detail: string
  timestamp: string
  backlog: {
    unlistedAssets: number
    stuckRuns: number
    packsNeedingPublish: number
  }
  providers: {
    openai: "healthy" | "degraded" | "down"
    deepseek: "healthy" | "degraded" | "down"
  }
  budget: { used: number; cap: number; remaining: number }
  lastAction: string
  isProcessing: boolean
}

async function getOrCreateProviderHealth(provider: string): Promise<ProviderHealth> {
  const db = getDb()
  const ref = doc(db, PROVIDERS_COLLECTION, provider)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as ProviderHealth
  const health: ProviderHealth = {
    id: provider, provider, status: "healthy", lastChecked: new Date().toISOString(), failCount: 0,
  }
  await updateDoc(ref, { ...health } as Record<string, unknown>).catch(() => {})
  return health
}

async function checkProviderHealth(provider: "openai" | "deepseek"): Promise<"healthy" | "degraded" | "down"> {
  try {
    if (provider === "deepseek") {
      const result = await generateText({ prompt: "ping", provider: "deepseek", maxTokens: 5 })
      if (result.success) {
        await updateDoc(doc(getDb(), PROVIDERS_COLLECTION, provider), { status: "healthy", failCount: 0, lastChecked: new Date().toISOString() } as Partial<ProviderHealth>)
        return "healthy"
      }
      throw new Error(result.error ?? "unknown")
    } else {
      const result = await generateImage({ prompt: "test", provider: "openai", n: 1, quality: "auto" })
      if (result.success) {
        await updateDoc(doc(getDb(), PROVIDERS_COLLECTION, provider), { status: "healthy", failCount: 0, lastChecked: new Date().toISOString() } as Partial<ProviderHealth>)
        return "healthy"
      }
      const error = result.error ?? ""
      if (error.includes("billing") || error.includes("limit") || error.includes("401") || error.includes("403")) {
        await updateDoc(doc(getDb(), PROVIDERS_COLLECTION, provider), { status: "degraded", failCount: 1, lastError: error, lastChecked: new Date().toISOString() } as Partial<ProviderHealth>)
        return "degraded"
      }
      throw new Error(error)
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown"
    const existing = await getOrCreateProviderHealth(provider)
    const failCount = existing.failCount + 1
    const newStatus = failCount >= 3 ? "down" : "degraded"
    await updateDoc(doc(getDb(), PROVIDERS_COLLECTION, provider), { status: newStatus, failCount, lastError: msg, lastChecked: new Date().toISOString() } as Partial<ProviderHealth>)
    return newStatus
  }
}

export async function getAutonomousStatus(): Promise<AutonomousStatus> {
  try {
    const assets = await getRecentAssets(50).catch(() => [])
    const unlistedAssets = assets.filter((a) => a.status === "review" || a.status === "approved").length
    const stuckRuns = (await findIncompleteRun()) ? 1 : 0
    const packs = await getReadyPacks().catch(() => 0)
    const budget = getBudgetStatus()

    const [openaiHealth, deepseekHealth] = await Promise.all([
      getOrCreateProviderHealth("openai"),
      getOrCreateProviderHealth("deepseek"),
    ])

    return {
      action: "idle",
      detail: "Scanning",
      timestamp: new Date().toISOString(),
      backlog: { unlistedAssets, stuckRuns, packsNeedingPublish: packs },
      providers: { openai: openaiHealth.status, deepseek: deepseekHealth.status },
      budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining },
      lastAction: "Status check",
      isProcessing: false,
    }
  } catch {
    return {
      action: "error", detail: "Status check failed", timestamp: new Date().toISOString(),
      backlog: { unlistedAssets: 0, stuckRuns: 0, packsNeedingPublish: 0 },
      providers: { openai: "healthy", deepseek: "healthy" },
      budget: { used: 0, cap: 10, remaining: 10 },
      lastAction: "Error", isProcessing: false,
    }
  }
}

export async function autonomousTick(): Promise<AutonomousStatus> {
  const budget = getBudgetStatus()

  try {
    // ═══ 1. Stuck run — check if it's paused due to provider ═══
    const stuck = await findIncompleteRun()
    if (stuck) {
      // Check if the stuck run is due to provider issues
      const db = getDb()
      const stuckSnap = await getDoc(doc(db, "orchestrator_runs", stuck.runId)).catch(() => null)
      const stuckStatus = (stuckSnap?.data() as Record<string, unknown>)?.status
      
      if (stuckStatus === "paused_provider") {
        return {
          action: "paused", detail: "Forge paused — OpenAI at billing limit. Top up at platform.openai.com then click Resume on Dashboard.",
          timestamp: new Date().toISOString(),
          backlog: { unlistedAssets: 0, stuckRuns: 1, packsNeedingPublish: 0 },
          providers: { openai: "degraded", deepseek: (await getOrCreateProviderHealth("deepseek")).status },
          budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining },
          lastAction: "Provider limit — paused",
          isProcessing: false,
        }
      }
      
      return {
        action: "resume", detail: `Stuck run found with ${stuck.completedSteps.length} steps done — click Resume on dashboard`,
        timestamp: new Date().toISOString(),
        backlog: { unlistedAssets: 0, stuckRuns: 1, packsNeedingPublish: 0 },
        providers: { openai: (await getOrCreateProviderHealth("openai")).status, deepseek: (await getOrCreateProviderHealth("deepseek")).status },
        budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining },
        lastAction: "Stuck run detected",
        isProcessing: true,
      }
    }

    // ═══ 2. Auto-package approved assets that aren't in any pack ═══
    const approved = await getAssetsByStatus("approved").catch(() => [])
    if (approved.length >= 1) {
      const allPacks = await getPacks().catch(() => [])
      const packedAssetIds = new Set(allPacks.flatMap((p) => p.assets))
      const unpackaged = approved.filter((a) => !packedAssetIds.has(a.id))
      
      if (unpackaged.length >= 1) {
        const assetIds = unpackaged.slice(0, 4).map((a) => a.id)
        try {
          const pack = await createPack({
            title: `${unpackaged[0]?.type ?? "Asset"} Pack ${new Date().toLocaleDateString()}`,
            description: `Auto-packaged ${assetIds.length} approved assets.`,
            assets: assetIds, price: 4.99, status: "review",
            previewUrl: unpackaged[0]?.previewUrl ?? "",
          })
          // Mark assets as draft so they aren't re-packaged
          for (const id of assetIds) {
            await updateAssetStatus(id, "draft").catch(() => {})
          }
          // Auto-publish the pack
          await publishPack(pack).catch(() => {})
          return {
            action: "packaged", detail: `Packaged ${assetIds.length} assets → "${pack.title}" (published to itch.io)`,
            timestamp: new Date().toISOString(),
            backlog: { unlistedAssets: 0, stuckRuns: 0, packsNeedingPublish: 1 },
            providers: { openai: "healthy", deepseek: "healthy" },
            budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining },
            lastAction: "Auto-packaged assets",
            isProcessing: true,
          }
        } catch (err) {
          console.error("Auto-package error:", err)
        }
      }
    }

    // ═══ 3. Publish any packs that haven't been published yet ═══
    const packs = await getPacks().catch(() => [])
    const unpublishedPack = packs.find((p) => !p.storeUrl)
    if (unpublishedPack) {
      try {
        await publishPack(unpublishedPack)
        return {
          action: "published", detail: `Published "${unpublishedPack.title}" to marketplaces`,
          timestamp: new Date().toISOString(),
          backlog: { unlistedAssets: 0, stuckRuns: 0, packsNeedingPublish: packs.length },
          providers: { openai: "healthy", deepseek: "healthy" },
          budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining },
          lastAction: "Published existing pack",
          isProcessing: true,
        }
      } catch {}
    }

    // ═══ 4. Budget check ═══
    if (budget.isExceeded) {
      return {
        action: "paused", detail: `Budget exceeded — $${budget.monthlyUsed.toFixed(2)}/$${budget.monthlyCap.toFixed(2)}`,
        timestamp: new Date().toISOString(),
        backlog: { unlistedAssets: approved.length, stuckRuns: 0, packsNeedingPublish: packs.length },
        providers: { openai: (await getOrCreateProviderHealth("openai")).status, deepseek: (await getOrCreateProviderHealth("deepseek")).status },
        budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining },
        lastAction: "Budget cap reached",
        isProcessing: false,
      }
    }

    // ═══ 5. Provider health check ═══
    const [openaiHealth, deepseekHealth] = await Promise.all([
      getOrCreateProviderHealth("openai"),
      getOrCreateProviderHealth("deepseek"),
    ])
    const openaiOk = openaiHealth.status !== "down"
    const deepseekOk = deepseekHealth.status !== "down"

    if (!openaiOk && !deepseekOk) {
      return {
        action: "paused", detail: "All providers down — check API keys and billing",
        timestamp: new Date().toISOString(),
        backlog: { unlistedAssets: approved.length, stuckRuns: 0, packsNeedingPublish: packs.length },
        providers: { openai: "down", deepseek: "down" },
        budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining },
        lastAction: "All providers offline",
        isProcessing: false,
      }
    }

    // ═══ 6. Don't forge if already have approved assets waiting for packaging ═══
    if (approved.length >= 3) {
      return {
        action: "backlog", detail: `${approved.length} approved assets waiting — package them first`,
        timestamp: new Date().toISOString(),
        backlog: { unlistedAssets: approved.length, stuckRuns: 0, packsNeedingPublish: packs.filter(p => !p.storeUrl).length },
        providers: { openai: openaiOk ? "healthy" : "degraded", deepseek: deepseekOk ? "healthy" : "degraded" },
        budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining },
        lastAction: "Backlog — packaging first",
        isProcessing: false,
      }
    }

    // ═══ 7. All clear — forge a new product ═══
    return {
      action: "ready", detail: "All clear — time to forge new assets",
      timestamp: new Date().toISOString(),
      backlog: { unlistedAssets: approved.length, stuckRuns: 0, packsNeedingPublish: packs.filter(p => !p.storeUrl).length },
      providers: { openai: openaiOk ? "healthy" : "degraded", deepseek: deepseekOk ? "healthy" : "degraded" },
      budget: { used: budget.monthlyUsed, cap: budget.monthlyCap, remaining: budget.monthlyRemaining },
      lastAction: "Starting new forge cycle",
      isProcessing: false,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Agent tick failed"
    console.error("Autonomous tick error:", msg)
    return {
      action: "error", detail: msg, timestamp: new Date().toISOString(),
      backlog: { unlistedAssets: 0, stuckRuns: 0, packsNeedingPublish: 0 },
      providers: { openai: "healthy", deepseek: "healthy" },
      budget: { used: 0, cap: 10, remaining: 10 },
      lastAction: "Error: " + msg,
      isProcessing: false,
    }
  }
}
