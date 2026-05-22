"use server"

/**
 * Kai-Asset-Forge v3 — Stats Engine
 * ==================================
 * Computes the four core stats for the Game Dev Story-style dashboard:
 *
 *   TREND   — from workspace/trend-report.md (parsed trending scores)
 *   QUALITY — average QC score from Firestore "generations" collection
 *   HYPE    — from lister draft quality (pack descriptions & listing metadata)
 *   REVENUE — pack count × estimated price (projected gross)
 *
 * All data sources fall back gracefully to 0 (or sane defaults) when unavailable.
 */

import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { exec } from "child_process"
import { getDocs, collection, query, orderBy, limit } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import type { GenerationRecord, AssetPack, Workflow } from "@/lib/types"

// ── Types ──────────────────────────────────────────────────────────────────

export interface ForgeStats {
  /** Trend power (0-100) — higher means stronger market signal */
  trend: number
  /** Average quality score (0-10) across all generated assets */
  quality: number
  /** Hype level (0-100) — based on listing draft quality & marketplace readiness */
  hype: number
  /** Projected revenue (USD) — pack count × average estimated price */
  revenue: number
  /** Timestamp of when stats were computed */
  computedAt: string
  /** Any warnings about data sources that fell back */
  warnings: string[]
}

export interface StatsInput {
  /** Optional: path to trend report (default: workspace/trend-report.md) */
  trendReportPath?: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TREND_PATH = join(
  process.cwd(), "workspace", "trend-report.md"
)

const FIRESTORE_COLLECTIONS = {
  generations: "generations",
  packs: "packs",
  workflows: "workflows",
} as const

// ── TREND: Parse trend-report.md ────────────────────────────────────────────

/**
 * Parse workspace/trend-report.md and extract an aggregate trending score (0-100).
 * Falls back to 50 (neutral) if the report is missing or unparseable.
 */
async function computeTrend(reportPath?: string): Promise<{ score: number; warning?: string }> {
  const path = reportPath ?? DEFAULT_TREND_PATH

  if (!existsSync(path)) {
    return {
      score: 50, // neutral default
      warning: `Trend report not found at ${path} — using neutral score (50). Run scout-scan.py to generate one.`,
    }
  }

  try {
    const content = await readFile(path, "utf-8")
    const lines = content.split("\n")

    // Find all "Score: XX/100" patterns
    const scorePattern = /Score:\s*(\d+)\s*\/\s*100/
    const scores: number[] = []

    for (const line of lines) {
      const match = line.match(scorePattern)
      if (match) {
        const s = parseInt(match[1], 10)
        if (!isNaN(s) && s >= 0 && s <= 100) {
          scores.push(s)
        }
      }
    }

    if (scores.length === 0) {
      return {
        score: 50,
        warning: "Trend report found but no scores parsed — using neutral (50).",
      }
    }

    // Weighted: top score gets more weight, plus average
    const maxScore = Math.max(...scores)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

    // Blend: 60% max + 40% average (trending categories matter more if one is hot)
    const blended = Math.round(maxScore * 0.6 + avgScore * 0.4)

    return { score: Math.min(blended, 100) }
  } catch (err) {
    return {
      score: 50,
      warning: `Failed to read trend report: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ── QUALITY: Average QC score from Firestore ────────────────────────────────

/**
 * Fetches recent generation records from Firestore and averages their qualityScore.
 * Falls back to 5.0 if Firestore is unavailable or no scores exist.
 */
async function computeQuality(): Promise<{ score: number; warning?: string }> {
  try {
    const db = getDb()
    const q = query(
      collection(db, FIRESTORE_COLLECTIONS.generations),
      orderBy("createdAt", "desc"),
      limit(50)
    )
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      return { score: 5.0, warning: "No generation records found — using default quality (5.0)." }
    }

    const scores: number[] = []
    for (const doc of snapshot.docs) {
      const data = doc.data() as Partial<GenerationRecord>
      if (typeof data.qualityScore === "number" && !isNaN(data.qualityScore)) {
        scores.push(data.qualityScore)
      }
    }

    if (scores.length === 0) {
      return { score: 5.0, warning: "Generation records lack qualityScore values — using default (5.0)." }
    }

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    // Clamp to 0-10 range, round to 1 decimal
    const clamped = Math.min(10, Math.max(0, avg))
    const rounded = Math.round(clamped * 10) / 10

    return { score: rounded }
  } catch (err) {
    return {
      score: 5.0,
      warning: `Firestore quality fetch failed: ${err instanceof Error ? err.message : String(err)} — using default (5.0).`,
    }
  }
}

// ── HYPE: Lister draft quality ──────────────────────────────────────────────

/**
 * Computes HYPE (0-100) from:
 *   - Pack description length & richness (has tags, category, theme)
 *   - Store-listing workflow completion status
 *   - Packs with high qualityScore
 *
 * Falls back to 50 (neutral) if no packs exist.
 */
async function computeHype(): Promise<{ score: number; warning?: string }> {
  try {
    const db = getDb()
    const [packsSnap, workflowsSnap] = await Promise.all([
      getDocs(collection(db, FIRESTORE_COLLECTIONS.packs)),
      getDocs(collection(db, FIRESTORE_COLLECTIONS.workflows)),
    ])

    const packs = packsSnap.docs.map((d) => d.data() as Partial<AssetPack>)
    const workflows = workflowsSnap.docs.map((d) => d.data() as Partial<Workflow>)

    if (packs.length === 0) {
      return { score: 30, warning: "No packs found — using low hype default (30). Forge some assets first!" }
    }

    // Score each pack's listing quality
    const packScores = packs.map((pack) => {
      let score = 40 // base

      // Description richness: length bonus
      const descLen = (pack.description ?? "").length
      if (descLen > 200) score += 15
      else if (descLen > 100) score += 10
      else if (descLen > 50) score += 5

      // Has tags
      if ((pack.tags ?? []).length >= 4) score += 10
      else if ((pack.tags ?? []).length >= 2) score += 5

      // Has category
      if (pack.category && pack.category !== "mixed") score += 5

      // Has qualityScore
      if ((pack.qualityScore ?? 0) >= 7) score += 10
      else if ((pack.qualityScore ?? 0) >= 5) score += 5

      // Approved packs are more hype-worthy
      if (pack.status === "approved") score += 10
      else if (pack.status === "review") score += 5

      return score
    })

    const avgPackScore = packScores.reduce((a, b) => a + b, 0) / packScores.length

    // Bonus from store-listing workflows completed
    const listingWorkflows = workflows.filter(
      (w) => w.workflowType === "store-listing" && w.status === "completed"
    )
    const listingBonus = Math.min(listingWorkflows.length * 3, 15)

    const finalScore = Math.min(Math.round(avgPackScore + listingBonus), 100)

    return { score: finalScore }
  } catch (err) {
    return {
      score: 50,
      warning: `Hype computation failed: ${err instanceof Error ? err.message : String(err)} — using neutral (50).`,
    }
  }
}

// ── REVENUE: Pack count × estimated price ───────────────────────────────────

/**
 * Computes projected REVENUE (USD):
 *   Sum of (each pack's price × pack's asset count factor)
 *   Falls back to 0 if no packs exist.
 */
async function computeRevenue(): Promise<{ amount: number; warning?: string }> {
  try {
    const db = getDb()
    const snapshot = await getDocs(collection(db, FIRESTORE_COLLECTIONS.packs))

    if (snapshot.empty) {
      return { amount: 0, warning: "No packs found — projected revenue is $0.00." }
    }

    let totalRevenue = 0
    for (const doc of snapshot.docs) {
      const data = doc.data() as Partial<AssetPack>
      const price = typeof data.price === "number" ? data.price : 3.99
      const assetCount = data.assets?.length ?? data.assetCount ?? 4

      // Revenue = price × asset count factor (bigger packs command higher prices)
      // Use the pack's actual price, capped at reasonable range
      const cappedPrice = Math.min(Math.max(price, 0.99), 29.99)
      totalRevenue += cappedPrice
    }

    // Round to 2 decimal places
    const rounded = Math.round(totalRevenue * 100) / 100

    return { amount: rounded }
  } catch (err) {
    return {
      amount: 0,
      warning: `Revenue computation failed: ${err instanceof Error ? err.message : String(err)} — using $0.00.`,
    }
  }
}

// ── Kanban: Parse Hermes kanban for task velocity ───────────────────────────

/**
 * Attempts to read Kanban task history from `hermes kanban list`.
 * Used to weight stats with pipeline velocity context.
 * Returns the number of completed tasks or null on failure.
 */
async function getKanbanTaskCount(): Promise<number | null> {
  try {
    const result = await new Promise<string>((resolve, reject) => {
      exec("hermes kanban list", { timeout: 10_000 }, (error, stdout) => {
        if (error) reject(error)
        else resolve(stdout)
      })
    })

    // Count lines that look like completed tasks (have ✓ or [x] or DONE)
    const lines = result.split("\n")
    const completed = lines.filter(
      (line) =>
        line.includes("✓") ||
        line.includes("[x]") ||
        line.toLowerCase().includes("done") ||
        line.toLowerCase().includes("completed")
    ).length

    return completed > 0 ? completed : null
  } catch {
    return null // Kanban not available — not critical
  }
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Computes all four core stats for the Kai-Asset-Forge dashboard.
 *
 * @param input - Optional configuration
 * @returns ForgeStats with trend, quality, hype, revenue + computedAt timestamp
 *
 * @example
 * ```ts
 * import { getStats } from "@/lib/stats-engine"
 * const stats = await getStats()
 * console.log(stats.trend)   // 87
 * console.log(stats.revenue) // 19.95
 * ```
 */
export async function getStats(input?: StatsInput): Promise<ForgeStats> {
  const warnings: string[] = []

  // Run all four stat computations in parallel
  const [trendResult, qualityResult, hypeResult, revenueResult, kanbanCount] =
    await Promise.all([
      computeTrend(input?.trendReportPath),
      computeQuality(),
      computeHype(),
      computeRevenue(),
      getKanbanTaskCount(),
    ])

  // Collect warnings
  if (trendResult.warning) warnings.push(trendResult.warning)
  if (qualityResult.warning) warnings.push(qualityResult.warning)
  if (hypeResult.warning) warnings.push(hypeResult.warning)
  if (revenueResult.warning) warnings.push(revenueResult.warning)

  // Kanban context bonus: if we have task history, slightly boost trend/hype
  let trendScore = trendResult.score
  let hypeScore = hypeResult.score

  if (kanbanCount !== null && kanbanCount > 0) {
    // Small velocity bonus: up to +5 based on kanban activity
    const velocityBonus = Math.min(kanbanCount, 5)
    trendScore = Math.min(trendScore + velocityBonus, 100)
    hypeScore = Math.min(hypeScore + Math.floor(velocityBonus / 2), 100)
  }

  if (kanbanCount === null) {
    warnings.push("Kanban task history unavailable — velocity bonus skipped. (hermes CLI not found or no tasks)")
  }

  return {
    trend: trendScore,
    quality: qualityResult.score,
    hype: hypeScore,
    revenue: revenueResult.amount,
    computedAt: new Date().toISOString(),
    warnings,
  }
}

/**
 * Lightweight version: returns only the four numerical stats without warnings or kanban.
 * Useful for quick polling in the UI.
 */
export async function getQuickStats(input?: StatsInput): Promise<{
  trend: number
  quality: number
  hype: number
  revenue: number
}> {
  const full = await getStats(input)
  return {
    trend: full.trend,
    quality: full.quality,
    hype: full.hype,
    revenue: full.revenue,
  }
}
