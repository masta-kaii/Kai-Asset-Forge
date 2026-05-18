"use server"

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc,
  Timestamp,
} from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { getBudgetStatus } from "@/lib/budget/budget"
import { getRecentAssets, getAssetsByStatus } from "@/lib/firebase/assets"
import { getPacks } from "@/lib/firebase/packs"

export interface DigestPayload {
  /** Plain-text, Masta-style summary. */
  body: string
  /** Structured snapshot for storage / UI consumption. */
  snapshot: {
    windowStartIso: string
    windowEndIso: string
    runs: { started: number; completed: number; failed: number; stuck: number }
    assets: { total: number; new: number; pendingReview: number; approved: number }
    packs: { total: number; readyToUpload: number; uploaded: number }
    budget: { used: number; cap: number; remainingPercent: number }
    stuckRunIds: string[]
    needsAttention: string[]
  }
}

interface OrchestratorRunDoc {
  id?: string
  status?: string
  startedAt?: string
  completedAt?: string
  error?: string
  productName?: string
  assetCount?: number
}

function within24h(iso: string | undefined, end: Date): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return end.getTime() - t < 24 * 60 * 60 * 1000
}

/**
 * Build a "yesterday in the forge" digest from current Firestore state.
 * Pure-ish: only reads, never writes. The caller decides whether to persist
 * the result and / or post it to a user chat thread.
 */
export async function buildMastaDigest(): Promise<DigestPayload> {
  const db = getDb()
  const end = new Date()
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)

  // Pull the most recent ~30 orchestrator runs and filter to the 24h window.
  let runs: OrchestratorRunDoc[] = []
  try {
    const snap = await getDocs(
      query(collection(db, "orchestrator_runs"), orderBy("startedAt", "desc"), limit(30)),
    )
    runs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrchestratorRunDoc) }))
  } catch (err) {
    console.error("buildMastaDigest runs:", err)
  }

  const inWindow = runs.filter((r) => within24h(r.startedAt, end))
  const completed = inWindow.filter((r) => r.status === "completed").length
  const failed = inWindow.filter((r) => r.status === "failed").length
  const stuckList = runs.filter(
    (r) => r.status === "running" || r.status === "awaiting_resume" || r.status === "paused_provider",
  )

  const [recentAssets, reviewQueue, approvedQueue, packs] = await Promise.all([
    getRecentAssets(50).catch(() => []),
    getAssetsByStatus("review").catch(() => []),
    getAssetsByStatus("approved").catch(() => []),
    getPacks().catch(() => []),
  ])

  const newAssets = recentAssets.filter((a) => within24h(a.createdAt, end)).length
  const readyToUpload = packs.filter((p) => p.zipUrl && !p.storeUrl)
  const uploaded = packs.filter((p) => !!p.storeUrl)
  const budget = getBudgetStatus()

  const needsAttention: string[] = []
  if (stuckList.length > 0) needsAttention.push(`Resume ${stuckList.length} stuck run${stuckList.length === 1 ? "" : "s"}.`)
  if (readyToUpload.length > 0)
    needsAttention.push(
      `Upload ${readyToUpload.length} ready pack${readyToUpload.length === 1 ? "" : "s"}: ${readyToUpload.slice(0, 3).map((p) => p.title).join(", ")}${readyToUpload.length > 3 ? "…" : ""}`,
    )
  if (budget.isExceeded) needsAttention.push("Monthly budget is exhausted — top up before the forge can run.")
  if (reviewQueue.length > 20) needsAttention.push(`Curate the review queue (${reviewQueue.length} assets waiting).`)
  if (needsAttention.length === 0) needsAttention.push("Nothing on fire. Crew can keep working.")

  const lines = [
    `Masta — daily report`,
    `Window: ${start.toISOString().slice(0, 16).replace("T", " ")}Z → ${end.toISOString().slice(0, 16).replace("T", " ")}Z`,
    ``,
    `Runs: ${inWindow.length} started · ${completed} completed · ${failed} failed · ${stuckList.length} stuck`,
    `Assets: ${newAssets} new in window · ${reviewQueue.length} pending review · ${approvedQueue.length} approved`,
    `Packs: ${packs.length} total · ${readyToUpload.length} ready to upload · ${uploaded.length} live on store`,
    `Budget: $${budget.monthlyUsed.toFixed(2)} of $${budget.monthlyCap.toFixed(2)} used (${Math.round(budget.monthlyPercent ?? 0)}%)`,
    ``,
    `Needs you:`,
    ...needsAttention.map((n) => `- ${n}`),
  ]

  return {
    body: lines.join("\n"),
    snapshot: {
      windowStartIso: start.toISOString(),
      windowEndIso: end.toISOString(),
      runs: {
        started: inWindow.length,
        completed,
        failed,
        stuck: stuckList.length,
      },
      assets: {
        total: recentAssets.length,
        new: newAssets,
        pendingReview: reviewQueue.length,
        approved: approvedQueue.length,
      },
      packs: {
        total: packs.length,
        readyToUpload: readyToUpload.length,
        uploaded: uploaded.length,
      },
      budget: {
        used: budget.monthlyUsed,
        cap: budget.monthlyCap,
        remainingPercent: Math.max(0, 100 - Math.round(budget.monthlyPercent ?? 0)),
      },
      stuckRunIds: stuckList.map((r) => r.id ?? "").filter(Boolean),
      needsAttention,
    },
  }
}

export async function persistMastaDigest(digest: DigestPayload): Promise<{ digestId: string }> {
  const db = getDb()
  const ref = await addDoc(collection(db, "masta_digests"), {
    body: digest.body,
    snapshot: digest.snapshot,
    createdAt: Timestamp.now(),
  })
  return { digestId: ref.id }
}

/**
 * Append the digest as an assistant-role message in the configured operator's
 * Masta chat thread. Requires MASTA_OPERATOR_UID env var; otherwise no-op.
 */
export async function postDigestToOperatorChat(digest: DigestPayload): Promise<{ posted: boolean; reason?: string }> {
  const uid = process.env.MASTA_OPERATOR_UID
  if (!uid) return { posted: false, reason: "MASTA_OPERATOR_UID not configured" }
  try {
    const db = getDb()
    await addDoc(collection(db, "masta_chats", uid, "messages"), {
      role: "assistant",
      content: digest.body,
      toolEvents: [],
      createdAt: Timestamp.now(),
      kind: "digest",
    })
    return { posted: true }
  } catch (err) {
    return { posted: false, reason: err instanceof Error ? err.message : "post failed" }
  }
}
