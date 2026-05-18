import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron-auth"
import { autonomousTick } from "@/app/actions/autonomous-agent"
import { runOrchestrator } from "@/app/actions/orchestrator"
import { getBudgetStatus } from "@/lib/budget/budget"
import { addDoc, collection, Timestamp } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Vercel cron tick — runs autonomousTick(). If CRON_AUTO_FORGE=true and the
 * org is healthy, kicks a small forge run. Logs every invocation to the
 * cron_runs collection so the audit trail survives serverless cold starts.
 */
export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (auth) return auth

  const startedAt = new Date()
  let action: string | undefined
  let detail: string | undefined
  let forge: { triggered: boolean; runId?: string; status?: string; error?: string } = {
    triggered: false,
  }

  try {
    const tick = await autonomousTick()
    action = tick.action
    detail = tick.detail

    if (process.env.CRON_AUTO_FORGE === "true" && tick.shouldForge) {
      const budget = getBudgetStatus()
      if (!budget.isExceeded) {
        const r = await runOrchestrator({ maxAssets: 1 }).catch((err) => ({
          runId: "",
          status: "failed",
          steps: [],
          isResume: false,
          error: err instanceof Error ? err.message : "Orchestrator crashed",
        }))
        forge = { triggered: true, runId: r.runId, status: r.status, error: r.error }
      } else {
        forge = { triggered: false, error: "Budget exhausted — skipped forge" }
      }
    }
  } catch (err) {
    detail = err instanceof Error ? err.message : "tick failed"
  }

  const finishedAt = new Date()

  // Best-effort audit log; never block the response on it.
  try {
    await addDoc(collection(getDb(), "cron_runs"), {
      endpoint: "tick",
      startedAt: Timestamp.fromDate(startedAt),
      finishedAt: Timestamp.fromDate(finishedAt),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      action,
      detail,
      forge,
    })
  } catch (err) {
    console.error("cron_runs log failed:", err)
  }

  return NextResponse.json({
    ok: true,
    action,
    detail,
    forge,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  })
}
