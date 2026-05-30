import { NextResponse } from 'next/server'
import { listRuns } from '@/lib/runs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Production stats for the factory HUD, aggregated from the durable runs
 * store. Previously this scanned a hardcoded Windows path
 * (C:\Users\khair\...) and shelled out to `hermes kanban list` — both dead on
 * Vercel. Now it reads the same unified ledger every other view uses.
 */

interface ForgeStats {
  totalProductions: number
  spritesGenerated: number
  tileSetsGenerated: number
  qualityScore: number | null
  lastProduction: string | null
  activeAgents: number
  forgeOutput: Array<{ name: string; type: string; date: string }>
}

const EMPTY: ForgeStats = {
  totalProductions: 0,
  spritesGenerated: 0,
  tileSetsGenerated: 0,
  qualityScore: null,
  lastProduction: null,
  activeAgents: 0,
  forgeOutput: [],
}

export async function GET(): Promise<NextResponse> {
  try {
    const runs = await listRuns({ limit: 100 })

    let spritesGenerated = 0
    let totalProductions = 0
    let activeAgents = 0
    let qualityScore: number | null = null
    let lastProduction: string | null = null
    const forgeOutput: Array<{ name: string; type: string; date: string }> = []

    for (const run of runs) {
      if (run.status === 'running') activeAgents++
      if (run.status === 'passed') {
        totalProductions++
        const meta = (run.meta as Record<string, unknown>) || {}
        spritesGenerated += Number(meta.sprites) || 0
        if (lastProduction === null) {
          lastProduction = run.theme || run.kind || run.id
          const qc = Number(meta.qcScore)
          if (!Number.isNaN(qc) && qc > 0) qualityScore = qc
        }
        forgeOutput.push({
          name: run.theme || run.kind || run.id,
          type: 'sprite',
          date: (run.finishedAt || run.startedAt || '').split('T')[0],
        })
      }
    }

    const stats: ForgeStats = {
      totalProductions,
      spritesGenerated,
      tileSetsGenerated: 0,
      qualityScore,
      lastProduction,
      activeAgents,
      forgeOutput: forgeOutput.slice(0, 10),
    }
    return NextResponse.json(stats, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    console.error('forge stats error:', e)
    return NextResponse.json(EMPTY, { headers: { 'cache-control': 'no-store' } })
  }
}
