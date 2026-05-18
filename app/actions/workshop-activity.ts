"use server"

import { collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { getBudgetStatus } from "@/lib/budget/budget"
import { autonomousTick, type AutonomousStatus } from "@/app/actions/autonomous-agent"

export type WorkshopAgentId =
  | "scout"
  | "director"
  | "forge"
  | "curator"
  | "packager"
  | "lister"
  | "reflector"
  | "masta"

export interface WorkshopStep {
  step: string
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  summary: string
  /** Sequence number — strictly increasing across polls. */
  seq: number
  /** Which agent this step belongs to, for the sim scene. */
  agent: WorkshopAgentId
}

export interface WorkshopActivity {
  runId: string | null
  runStatus: string | null
  steps: WorkshopStep[]
  autonomous: AutonomousStatus
  budgetPercent: number
}

/**
 * Map an orchestrator step name to the agent that owns it on the sim scene.
 * Anything unrecognized falls through to Masta (the boss handles unowned work).
 */
function agentForStep(step: string): WorkshopAgentId {
  const s = step.toLowerCase()
  if (s.includes("scout")) return "scout"
  if (s.includes("art direction") || s.includes("trend")) return "director"
  if (s.includes("forge") || s.includes("generation")) return "forge"
  if (s.includes("curator") || s.includes("quality")) return "curator"
  if (s.includes("finalize") || s.includes("pack")) return "packager"
  if (s.includes("listing") || s.includes("store")) return "lister"
  if (s.includes("reflect")) return "reflector"
  if (s.includes("budget") || s.includes("ledger") || s.includes("decision")) return "masta"
  return "masta"
}

export async function getWorkshopActivity(): Promise<WorkshopActivity> {
  const db = getDb()
  let runId: string | null = null
  let runStatus: string | null = null
  let steps: WorkshopStep[] = []

  try {
    const snap = await getDocs(
      query(collection(db, "orchestrator_runs"), orderBy("startedAt", "desc"), limit(1)),
    )
    const top = snap.docs[0]
    if (top) {
      const data = top.data() as Record<string, unknown>
      runId = (data.id as string) ?? top.id
      runStatus = (data.status as string) ?? null
      const rawSteps = (data.steps as Array<{ step: string; status: string; summary: string }> | undefined) ?? []
      steps = rawSteps.map((s, i) => ({
        step: s.step,
        status: (s.status as WorkshopStep["status"]) ?? "pending",
        summary: s.summary ?? "",
        seq: i,
        agent: agentForStep(s.step),
      }))
    }
  } catch (err) {
    console.error("getWorkshopActivity steps:", err)
  }

  const autonomous = await autonomousTick().catch((): AutonomousStatus => ({
    action: "idle",
    detail: "Scan error",
    timestamp: new Date().toISOString(),
    backlog: { unlistedAssets: 0, stuckRuns: 0, packsToPublish: 0 },
    providers: { openai: "healthy", deepseek: "healthy" },
    budget: { used: 0, cap: 10, remaining: 10 },
    shouldForge: false,
    isProcessing: false,
  }))

  const budget = getBudgetStatus()

  return {
    runId,
    runStatus,
    steps,
    autonomous,
    budgetPercent: Math.round(budget.monthlyPercent ?? 0),
  }
}
