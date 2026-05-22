import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"

/**
 * Kai-Asset-Forge v3 — Stats API Route
 * Game Dev Story-style stats bar endpoint
 * 
 * GET /api/forge/stats → { trend, quality, hype, revenue }
 */

export const dynamic = "force-dynamic"

async function loadStats() {
  // TREND: Parse trend-report.md if it exists
  let trend = 50 // neutral default
  const trendPath = join(process.cwd(), "workspace", "trend-report.md")
  if (existsSync(trendPath)) {
    try {
      const content = await readFile(trendPath, "utf-8")
      // Extract scores from lines like "Score: 95"
      const scores = content.match(/Score:\s*(\d+)/gi)?.map((s: string) => parseInt(s.replace(/\D/g, ""))) ?? []
      if (scores.length > 0) {
        const maxScore = Math.max(...scores)
        const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length
        trend = Math.round(maxScore * 0.6 + avgScore * 0.4)
      }
    } catch {}
  }

  // QUALITY, HYPE, REVENUE: Simulated for now
  const cycle = Math.floor(Date.now() / 15000) % 100
  const quality = Math.min(10, 5 + (cycle % 10) * 0.5)
  const hype = Math.min(100, 30 + cycle * 1.2)
  const revenue = Math.round(cycle * 4.99 * 100) / 100

  return { trend, quality, hype, revenue }
}

export async function GET() {
  try {
    const stats = await loadStats()
    return NextResponse.json({
      trend: stats.trend,
      quality: Math.round(stats.quality * 10) / 10,
      hype: Math.round(stats.hype),
      revenue: stats.revenue,
    })
  } catch {
    // Absolute fallback
    const cycle = Math.floor(Date.now() / 10000) % 100
    return NextResponse.json({
      trend: Math.min(100, 40 + cycle),
      quality: Math.min(10, 5 + (cycle % 10) * 0.5),
      hype: Math.min(100, 30 + cycle * 1.2),
      revenue: Math.round(cycle * 4.99 * 100) / 100,
    })
  }
}
