import { NextResponse } from "next/server"
import { verifyAgentAuth } from "@/lib/agent-auth"
import { scoutTrends } from "@/app/actions/scout"
import { curatorScore } from "@/app/actions/curator"
import { runReflection } from "@/app/actions/reflection"
import { runOrchestrator, findIncompleteRun } from "@/app/actions/orchestrator"
import { autonomousTick } from "@/app/actions/autonomous-agent"
import { autoPackApproved } from "@/app/actions/auto-pack"
import { buildPackDeliverable } from "@/app/actions/pack-builder"
import { generatePackItchListing, markPackUploaded } from "@/app/actions/itchio-listing"
import { buildMastaDigest } from "@/app/actions/digest"
import { getBudgetStatus } from "@/lib/budget/budget"
import { getPackById, getPacks } from "@/lib/firebase/packs"
import { getRecentAssets, getAssetsByStatus, getAssetById } from "@/lib/firebase/assets"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Single dispatch endpoint for Hermes specialists living off-Vercel.
 * Each agent's runbook tells it which `action` to POST to here with
 * `Authorization: Bearer ${KAI_API_TOKEN}` and a JSON body.
 *
 * Surface kept intentionally narrow — exposes only what an outside
 * automation needs. Anything dangerous (deleting data, changing
 * budget caps, mutating Firestore rules) is NOT here on purpose.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const authFailure = verifyAgentAuth(request)
  if (authFailure) return authFailure

  const { action } = await context.params
  let body: Record<string, unknown> = {}
  try {
    if (request.headers.get("content-length") !== "0") {
      body = await request.json()
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON" }, { status: 400 })
  }

  try {
    const result = await dispatch(action, body)
    return NextResponse.json({ ok: true, action, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed"
    return NextResponse.json({ ok: false, action, error: message }, { status: 500 })
  }
}

/** Allow GET for read-only actions so containers can use curl without -X POST. */
export async function GET(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const authFailure = verifyAgentAuth(request)
  if (authFailure) return authFailure

  const { action } = await context.params
  const READ_ONLY = new Set([
    "status",
    "budget",
    "find-incomplete-run",
    "list-recent-runs",
    "list-recent-assets",
    "list-packs",
    "digest",
  ])
  if (!READ_ONLY.has(action)) {
    return NextResponse.json(
      { ok: false, error: `Action '${action}' requires POST` },
      { status: 405 },
    )
  }

  try {
    const url = new URL(request.url)
    const body: Record<string, unknown> = {}
    url.searchParams.forEach((v, k) => {
      body[k] = v
    })
    const result = await dispatch(action, body)
    return NextResponse.json({ ok: true, action, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed"
    return NextResponse.json({ ok: false, action, error: message }, { status: 500 })
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined
}
function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

async function dispatch(action: string, body: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    // ── Observability ──
    case "status":
      return await autonomousTick()
    case "budget":
      return await getBudgetStatus()
    case "find-incomplete-run":
      return (await findIncompleteRun()) ?? { runId: null }
    case "digest":
      return (await buildMastaDigest()).body

    // ── Product specialists ──
    case "scout":
      return await scoutTrends({ theme: asString(body.theme) })
    case "curate":
      return await curatorScore({
        assetName: asString(body.assetName) ?? "",
        assetType: asString(body.assetType) ?? "creature",
        assetStyle: asString(body.assetStyle) ?? "pixel-art",
        prompt: asString(body.prompt) ?? "",
      })
    case "reflect":
      return await runReflection()

    // ── Sales specialists ──
    case "package": {
      const packId = asString(body.packId)
      if (!packId) throw new Error("packId required")
      return await buildPackDeliverable(packId)
    }
    case "listing": {
      const packId = asString(body.packId)
      if (!packId) throw new Error("packId required")
      return await generatePackItchListing(packId)
    }
    case "mark-uploaded": {
      const packId = asString(body.packId)
      const storeUrl = asString(body.storeUrl)
      if (!packId || !storeUrl) throw new Error("packId and storeUrl required")
      return await markPackUploaded(packId, storeUrl)
    }
    case "auto-pack":
      return await autoPackApproved()

    // ── Orchestrator (full pipeline) ──
    case "pipeline":
      return await runOrchestrator({
        theme: asString(body.theme),
        maxAssets: asNumber(body.maxAssets),
        resumeRunId: asString(body.resumeRunId),
      })

    // ── Read-only data accessors for specialists building task files ──
    case "list-recent-runs": {
      const stuck = await findIncompleteRun()
      return { stuck }
    }
    case "list-recent-assets": {
      const lim = asNumber(body.limit) ?? 20
      const status = asString(body.status)
      if (status) return await getAssetsByStatus(status)
      return await getRecentAssets(lim)
    }
    case "get-asset": {
      const assetId = asString(body.assetId)
      if (!assetId) throw new Error("assetId required")
      return (await getAssetById(assetId)) ?? null
    }
    case "list-packs": {
      const all = await getPacks()
      const filter = asString(body.filter)
      if (filter === "ready-to-upload") return all.filter((p) => p.zipUrl && !p.storeUrl)
      if (filter === "live") return all.filter((p) => !!p.storeUrl)
      if (filter === "in-progress") return all.filter((p) => !p.zipUrl)
      return all
    }
    case "get-pack": {
      const packId = asString(body.packId)
      if (!packId) throw new Error("packId required")
      return (await getPackById(packId)) ?? null
    }

    default:
      throw new Error(`Unknown action: ${action}`)
  }
}
