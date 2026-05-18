"use server"

import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { getRecentEntries } from "@/lib/firebase/ledger"
import { getBudgetStatus } from "@/lib/budget/budget"
import { scoutTrends } from "@/app/actions/scout"
import { forgeStepGenerate } from "@/app/actions/pipeline-steps"
import { curatorScore } from "@/app/actions/curator"
import { forgeStepFinalize } from "@/app/actions/pipeline-steps"
import { runReflection } from "@/app/actions/reflection"
import { generateText } from "@/lib/ai/client"
import type { ScoutProposal } from "@/app/actions/scout"
import type { AssetStyle, AssetType } from "@/lib/types"

const COLLECTION = "orchestrator_runs"

async function markProviderDown(provider: string, error: string) {
  try {
    const db = getDb()
    await updateDoc(doc(db, "provider_health", provider), {
      status: "degraded", lastError: error, failCount: 1, lastChecked: new Date().toISOString(),
    } as Record<string, unknown>)
  } catch {}
}

interface OrchestratorStep {
  step: string
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  summary: string
  data?: unknown
}

interface OrchestratorRun {
  id: string
  status: "running" | "completed" | "failed" | "awaiting_resume"
  steps: OrchestratorStep[]
  decidedBy: string
  startedAt: string
  completedAt?: string
  productName?: string
  assetCount: number
  // Resume data
  resumeData?: {
    completedSteps: string[]
    proposals?: ScoutProposal[]
    winningProposal?: ScoutProposal
    generatedAssetIds?: string[]
    artDirection?: string
  }
  error?: string
}

export interface OrchestratorResult {
  runId: string
  status: string
  steps: OrchestratorStep[]
  isResume: boolean
  error?: string
}

export async function findIncompleteRun(): Promise<{ runId: string; completedSteps: string[] } | null> {
  try {
    const db = getDb()
    const q = query(collection(db, COLLECTION), orderBy("startedAt", "desc"), limit(3))
    const snap = await getDocs(q)
    for (const docSnap of snap.docs) {
      const run = docSnap.data() as OrchestratorRun
      if (run.status === "running" || run.status === "awaiting_resume") {
        return {
          runId: run.id,
          completedSteps: (run.resumeData?.completedSteps ?? run.steps?.filter((s) => s.status === "completed").map((s) => s.step) ?? []),
        }
      }
    }
    return null
  } catch {
    return null
  }
}

export async function runOrchestrator(input?: {
  theme?: string
  maxAssets?: number
  resumeRunId?: string
}): Promise<OrchestratorResult> {
  const isResume = !!input?.resumeRunId
  const runId = input?.resumeRunId ?? `orch-${Date.now()}`
  const theme = input?.theme ?? "fantasy creatures"
  const maxAssets = input?.maxAssets ?? 2
  let assetCount = 0

  const db = getDb()
  const ref = doc(db, COLLECTION, runId)
  let completedSteps: string[] = []
  let cachedProposals: ScoutProposal[] = []
  let cachedWinning: ScoutProposal | undefined
  let cachedAssetIds: string[] = []

  const log = async (step: OrchestratorStep) => {
    const existing = (await getDoc(ref)).data()
    const existingSteps = (existing?.steps as OrchestratorStep[]) ?? []
    const updated = existingSteps.filter((s) => s.step !== step.step)
    updated.push(step)
    completedSteps = updated.filter((s) => s.status === "completed").map((s) => s.step)
    try {
      await updateDoc(ref, {
        steps: updated,
        resumeData: { completedSteps, proposals: cachedProposals, winningProposal: cachedWinning, generatedAssetIds: cachedAssetIds },
      })
    } catch {}
  }

  const isDone = (name: string) => completedSteps.includes(name)

  try {
    if (isResume) {
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const existing = snap.data() as OrchestratorRun
        completedSteps = existing.resumeData?.completedSteps ?? []
        cachedProposals = existing.resumeData?.proposals ?? []
        cachedWinning = existing.resumeData?.winningProposal
        cachedAssetIds = existing.resumeData?.generatedAssetIds ?? []
      }
    } else {
      await setDoc(ref, {
        id: runId, status: "running", steps: [],
        decidedBy: "orchestrator-v2", startedAt: new Date().toISOString(), assetCount: 0,
        resumeData: { completedSteps: [] },
      } satisfies OrchestratorRun)
    }

    // ═══ Step 1: Budget Check ═══
    if (!isDone("Budget Check")) {
      const budget = getBudgetStatus()
      if (budget.isExceeded) {
        await log({ step: "Budget Check", status: "failed", summary: `Budget exceeded: $${budget.monthlyUsed.toFixed(2)}/$${budget.monthlyCap.toFixed(2)}` })
        await updateDoc(ref, { status: "awaiting_resume", error: "Budget exceeded" })
        return { runId, status: "awaiting_resume", steps: [], isResume: true, error: "Budget exceeded. Add funds and resume." }
      }
      await log({ step: "Budget Check", status: "completed", summary: `$${budget.monthlyRemaining.toFixed(2)} remaining` })
    }

    // ═══ Step 2: Ledger Analysis ═══
    if (!isDone("Ledger Analysis")) {
      const ledgerEntries = await getRecentEntries(30).catch(() => [])
      const pastTypes = [...new Set(ledgerEntries.filter(e => e.operation === "image_gen").map(e => e.metadata?.assetType).filter(Boolean))]
      await log({ step: "Ledger Analysis", status: "completed", summary: `${ledgerEntries.length} past entries, ${pastTypes.length} asset types tried` })
    }

    // ═══ Step 3: Scout ═══
    if (!isDone("Scout") && cachedProposals.length === 0) {
      for (let i = 0; i < 3; i++) {
        const scout = await scoutTrends({ theme })
        if (scout.success && scout.proposal) cachedProposals.push(scout.proposal)
      }
      if (cachedProposals.length === 0) {
        await log({ step: "Scout", status: "failed", summary: "No proposals generated" })
        await updateDoc(ref, { status: "awaiting_resume", error: "Scout failed" })
        return { runId, status: "awaiting_resume", steps: [], isResume: true, error: "Scout failed to generate proposals. Resume to retry." }
      }
      await log({ step: "Scout", status: "completed", summary: `${cachedProposals.length} proposals: ${cachedProposals.map(p => p.theme).join(", ")}`, data: cachedProposals })
    }

    // ═══ Step 4: Decision ═══
    if (!isDone("Decision") && !cachedWinning && cachedProposals.length > 0) {
      const ledgerEntries = await getRecentEntries(30).catch(() => [])
      const pastTypes = [...new Set(ledgerEntries.filter(e => e.operation === "image_gen").map(e => e.metadata?.assetType).filter(Boolean))]
      const budget = getBudgetStatus()
      const decision = await generateText({
        prompt: `Pick the BEST proposal from this list. Consider: trending score, avoid recently tried types (${pastTypes.join(", ")}), budget remaining ($${budget.monthlyRemaining.toFixed(2)}). Return ONLY the number (1-${cachedProposals.length}) of the best proposal:\n\n${cachedProposals.map((p, i) => `${i + 1}. Theme: "${p.theme}", Score: ${p.trendingScore}/10, Rationale: ${p.rationale}`).join("\n")}`,
        provider: "deepseek",
        temperature: 0.3,
        maxTokens: 10,
      })
      const choice = parseInt(decision.text?.trim() ?? "1") || 1
      cachedWinning = cachedProposals[Math.min(choice - 1, cachedProposals.length - 1)]
      await log({ step: "Decision", status: "completed", summary: `Picked: ${cachedWinning.theme} (${cachedWinning.assetType}, score ${cachedWinning.trendingScore}/10)` })
      try { await updateDoc(ref, { resumeData: { ...((await getDoc(ref)).data()?.resumeData ?? {}), winningProposal: cachedWinning } }) } catch {}
    }

    if (!cachedWinning) {
      await updateDoc(ref, { status: "awaiting_resume" })
      return { runId, status: "awaiting_resume", steps: [], isResume: true, error: "No winning proposal. Resume to retry." }
    }

    // ═══ Step 5: Forge ═══
    if (!isDone("Forge") && cachedAssetIds.length === 0) {
      const forgePrompt = `${cachedWinning.theme}. ${cachedWinning.styleAnchor}. Pixel art game asset.`
      let lastError = ""
      for (let i = 0; i < Math.min(maxAssets, cachedWinning.count); i++) {
        const gen = await forgeStepGenerate({
          artDirection: forgePrompt,
          assetType: cachedWinning.assetType,
          style: cachedWinning.style,
          imageProvider: "openai",
        })
        if (gen.status === "completed") {
          const assetId = (gen.data as Record<string, unknown>)?.assetId as string
          if (assetId) cachedAssetIds.push(assetId)
        } else {
          lastError = gen.error ?? gen.summary
        }
      }
      if (cachedAssetIds.length === 0) {
        const isProviderErr = /billing|limit|401|403|quota|exceeded/i.test(lastError)
        if (isProviderErr) {
          await markProviderDown("openai", lastError)
          await log({ step: "Forge", status: "failed", summary: `OpenAI unavailable: ${lastError}` })
          await updateDoc(ref, { status: "paused_provider", error: lastError })
          return { runId, status: "paused_provider", steps: [], isResume: true, error: `OpenAI: ${lastError}. Top up at platform.openai.com.` }
        }
        await log({ step: "Forge", status: "failed", summary: lastError || "No assets generated" })
        await updateDoc(ref, { status: "awaiting_resume", error: lastError || "Generation failed" })
        return { runId, status: "awaiting_resume", steps: [], isResume: true, error: "Asset generation failed. Resume to retry." }
      }
      await log({ step: "Forge", status: "completed", summary: `Generated ${cachedAssetIds.length} ${cachedWinning.assetType} assets` })
    }

    // ═══ Step 6: Curator ═══
    if (!isDone("Curator")) {
      let passCount = 0
      for (const id of cachedAssetIds) {
        const score = await curatorScore({
          assetName: `${cachedWinning.assetType}-${id}`,
          assetType: cachedWinning.assetType,
          assetStyle: cachedWinning.style,
          prompt: `${cachedWinning.theme}. Pixel art game asset.`,
        })
        if (score.success && score.score?.verdict === "pass") passCount++
      }
      await log({ step: "Curator", status: "completed", summary: `${passCount}/${cachedAssetIds.length} passed quality review` })
    }

    // ═══ Step 7: Finalize ═══
    if (!isDone("Finalize")) {
      const final = await forgeStepFinalize({ assetIds: cachedAssetIds, theme: cachedWinning.theme })
      await log({ step: "Finalize", status: final.status === "completed" ? "completed" : "failed", summary: final.summary, data: final.data })
    }

    // ═══ Step 8: Reflection ═══
    if (!isDone("Reflection")) {
      const reflection = await runReflection()
      await log({ step: "Reflection", status: reflection.success ? "completed" : "skipped", summary: reflection.success ? reflection.output?.summary?.slice(0, 120) ?? "Analysis complete" : "Skipped" })
    }

    await updateDoc(ref, {
      status: "completed",
      completedAt: new Date().toISOString(),
      productName: cachedWinning.theme.charAt(0).toUpperCase() + cachedWinning.theme.slice(1),
      assetCount: cachedAssetIds.length,
    } satisfies Partial<OrchestratorRun>)

    return { runId, status: "completed", steps: [], isResume }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Orchestrator crashed"
    console.error("Orchestrator error:", msg)
    try {
      await updateDoc(ref, { status: "awaiting_resume", error: msg, completedAt: new Date().toISOString() }).catch(() => {})
    } catch {}
    return { runId, status: "awaiting_resume", steps: [], isResume: true, error: msg }
  }
}
