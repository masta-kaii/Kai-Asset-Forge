"use server"

import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { getRecentEntries } from "@/lib/firebase/ledger"
import { getBudgetStatus, canProceed } from "@/lib/budget/budget"
import { scoutTrends } from "@/app/actions/scout"
import { forgeStepGenerate } from "@/app/actions/pipeline-steps"
import { curatorScore } from "@/app/actions/curator"
import { forgeStepFinalize } from "@/app/actions/pipeline-steps"
import { runReflection } from "@/app/actions/reflection"
import { generateText } from "@/lib/ai/client"
import type { ScoutProposal } from "@/app/actions/scout"
import type { AssetStyle, AssetType } from "@/lib/types"

const COLLECTION = "orchestrator_runs"

interface OrchestratorStep {
  step: string
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  summary: string
  data?: unknown
}

interface OrchestratorRun {
  id: string
  status: "running" | "completed" | "failed"
  steps: OrchestratorStep[]
  decidedBy: string
  startedAt: string
  completedAt?: string
  productName?: string
  assetCount: number
}

export interface OrchestratorResult {
  runId: string
  status: string
  steps: OrchestratorStep[]
  error?: string
}

export async function runOrchestrator(input?: {
  theme?: string
  maxAssets?: number
}): Promise<OrchestratorResult> {
  const runId = `orch-${Date.now()}`
  const steps: OrchestratorStep[] = []
  const theme = input?.theme ?? "fantasy creatures"
  const maxAssets = input?.maxAssets ?? 2
  let assetCount = 0

  const db = getDb()
  const ref = doc(db, COLLECTION, runId)

  const log = async (step: OrchestratorStep) => {
    steps.push(step)
    try { await updateDoc(ref, { steps: [...steps] }) } catch {}
  }

  try {
    await setDoc(ref, {
      id: runId, status: "running", steps: [],
      decidedBy: "orchestrator-v1", startedAt: new Date().toISOString(), assetCount: 0,
    } satisfies OrchestratorRun)

    // ═══ Step 1: Check budget ═══
    const budget = getBudgetStatus()
    if (budget.isExceeded) {
      await log({ step: "Budget Check", status: "failed", summary: `Budget exceeded: $${budget.monthlyUsed.toFixed(2)}/$${budget.monthlyCap.toFixed(2)}` })
      await updateDoc(ref, { status: "failed", completedAt: new Date().toISOString() })
      return { runId, status: "failed", steps, error: "Budget exceeded" }
    }
    await log({ step: "Budget Check", status: "completed", summary: `$${budget.monthlyRemaining.toFixed(2)} remaining today` })

    // ═══ Step 2: Read ledger for past performance ═══
    const ledgerEntries = await getRecentEntries(30).catch(() => [])
    const pastTypes = [...new Set(ledgerEntries.filter(e => e.operation === "image_gen").map(e => e.metadata?.assetType).filter(Boolean))]
    const pastThemes = ledgerEntries.filter(e => e.operation === "text_gen" && e.metadata?.agent === "scout")
    await log({ step: "Ledger Analysis", status: "completed", summary: `${ledgerEntries.length} past entries, ${pastTypes.length} asset types tried` })

    // ═══ Step 3: Scout proposes 3 ideas ═══
    const proposals: ScoutProposal[] = []
    for (let i = 0; i < 3; i++) {
      const scout = await scoutTrends({ theme })
      if (scout.success && scout.proposal) proposals.push(scout.proposal)
    }
    if (proposals.length === 0) {
      await log({ step: "Scout", status: "failed", summary: "No proposals generated" })
      await updateDoc(ref, { status: "failed", completedAt: new Date().toISOString() })
      return { runId, status: "failed", steps, error: "Scout failed to generate proposals" }
    }
    await log({ step: "Scout", status: "completed", summary: `${proposals.length} proposals: ${proposals.map(p => p.theme).join(", ")}` })

    // ═══ Step 4: Decision Agent picks the best proposal ═══
    const decision = await generateText({
      prompt: `You are the Orchestrator Decision Agent. Pick the BEST proposal from this list to generate assets for. Consider: trending score, avoids recently tried types (${pastTypes.join(", ")}), commercial potential, budget remaining ($${budget.monthlyRemaining.toFixed(2)}).

Proposals:
${proposals.map((p, i) => `${i + 1}. Theme: "${p.theme}", Type: ${p.assetType}, Score: ${p.trendingScore}/10, Rationale: ${p.rationale}`).join("\n")}

Return ONLY the number (1-3) of the best proposal:`,
      provider: "deepseek",
      temperature: 0.3,
      maxTokens: 10,
    })

    const choice = parseInt(decision.text?.trim() ?? "1") || 1
    const winning = proposals[Math.min(choice - 1, proposals.length - 1)]
    await log({ step: "Decision", status: "completed", summary: `Picked: ${winning.theme} (${winning.assetType}, score ${winning.trendingScore}/10)`, data: winning })

    // ═══ Step 5: Forge — generate assets ═══
    const forgePrompt = `${winning.theme}. ${winning.styleAnchor}. Pixel art game asset.`
    const generatedIds: string[] = []

    for (let i = 0; i < Math.min(maxAssets, winning.count); i++) {
      const gen = await forgeStepGenerate({
        artDirection: forgePrompt,
        assetType: winning.assetType,
        style: winning.style,
        imageProvider: "openai",
      })
      if (gen.status === "completed") {
        const assetId = (gen.data as Record<string, unknown>)?.assetId as string
        if (assetId) generatedIds.push(assetId)
      }
    }

    assetCount = generatedIds.length
    if (assetCount === 0) {
      await log({ step: "Forge", status: "failed", summary: "No assets generated successfully" })
      await updateDoc(ref, { status: "failed", completedAt: new Date().toISOString() })
      return { runId, status: "failed", steps, error: "Generation failed" }
    }
    await log({ step: "Forge", status: "completed", summary: `Generated ${assetCount} ${winning.assetType} assets` })

    // ═══ Step 6: Curator — score assets ═══
    let curatorPassCount = 0
    for (const id of generatedIds) {
      const score = await curatorScore({
        assetName: `${winning.assetType}-${id}`,
        assetType: winning.assetType,
        assetStyle: winning.style,
        prompt: forgePrompt,
      })
      if (score.success && score.score?.verdict === "pass") curatorPassCount++
    }
    await log({ step: "Curator", status: "completed", summary: `${curatorPassCount}/${assetCount} passed quality review` })

    // ═══ Step 7: Finalize — approve + pack ═══
    const final = await forgeStepFinalize({ assetIds: generatedIds, theme: winning.theme })
    await log({ step: "Finalize", status: final.status === "completed" ? "completed" : "failed", summary: final.summary, data: final.data })

    const productName = winning.theme.charAt(0).toUpperCase() + winning.theme.slice(1)

    // ═══ Step 8: Reflection — learn ═══
    const reflection = await runReflection()
    await log({
      step: "Reflection",
      status: reflection.success ? "completed" : "skipped",
      summary: reflection.success ? reflection.output?.summary?.slice(0, 120) ?? "Analysis complete" : "Skipped (no data)",
      data: reflection.output,
    })

    await updateDoc(ref, {
      status: "completed",
      completedAt: new Date().toISOString(),
      productName,
      assetCount,
    } satisfies Partial<OrchestratorRun>)

    return { runId, status: "completed", steps }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Orchestrator crashed"
    console.error("Orchestrator error:", msg)
    try {
      await updateDoc(ref, { status: "failed", completedAt: new Date().toISOString() }).catch(() => {})
    } catch {}
    return { runId, status: "failed", steps, error: msg }
  }
}
