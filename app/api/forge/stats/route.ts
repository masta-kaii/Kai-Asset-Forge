import { execSync } from 'child_process'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

function hermes(args: string): string {
  try {
    return execSync(`hermes ${args} 2>&1`, { encoding: 'utf-8', timeout: 15000 })
  } catch (e: any) {
    return e.stdout || e.stderr || e.message
  }
}

interface ForgeStats {
  totalProductions: number
  spritesGenerated: number
  tileSetsGenerated: number
  qualityScore: number | null
  lastProduction: string | null
  activeAgents: number
  forgeOutput: Array<{ name: string; type: string; date: string }>
}

export async function GET(): Promise<NextResponse> {
  try {
    const forgeDir = 'C:\\Users\\khair\\Kai-Asset-Forge\\forge-output'

    // Count productions from forge-output directories
    let spritesGenerated = 0
    let tileSetsGenerated = 0
    const recentOutputs: Array<{ name: string; type: string; date: string }> = []

    if (existsSync(forgeDir)) {
      const entries = readdirSync(forgeDir).filter(e => !e.startsWith('.'))
      for (const entry of entries) {
        const fullPath = join(forgeDir, entry)
        try {
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            // Check for sprite directories vs tile directories
            const subFiles = readdirSync(fullPath).filter(f => f.endsWith('.png'))
            if (entry.includes('tile') || entry.includes('tiles')) {
              tileSetsGenerated += subFiles.length
            } else {
              spritesGenerated += subFiles.length
            }

            if (subFiles.length > 0) {
              recentOutputs.push({
                name: entry,
                type: entry.includes('tile') ? 'tiles' : 'sprite',
                date: stat.mtime.toISOString().split('T')[0],
              })
            }
          }
        } catch {}
      }
    }

    // Get done task count from Kanban for total productions
    const kanban = hermes('kanban list')
    const doneMatches = kanban.match(/\b(done|completed)\b/gi) || []
    const totalProductions = doneMatches.length

    // Get active agents
    const activeMatches = kanban.match(/\b(active|running|in_progress)\b/gi) || []
    const activeAgents = activeMatches.length

    // Quality score from last QC review (if any)
    let qualityScore: number | null = null
    const qcComments = kanban.match(/QC.*?(\d+)\/10/i)
    if (qcComments) {
      qualityScore = parseInt(qcComments[1])
    }

    // Sort outputs by date (newest first)
    recentOutputs.sort((a, b) => b.date.localeCompare(a.date))

    const stats: ForgeStats = {
      totalProductions,
      spritesGenerated,
      tileSetsGenerated,
      qualityScore,
      lastProduction: recentOutputs.length > 0 ? recentOutputs[0].name : null,
      activeAgents,
      forgeOutput: recentOutputs.slice(0, 10),
    }

    return NextResponse.json(stats)
  } catch (e: any) {
    return NextResponse.json({
      totalProductions: 0,
      spritesGenerated: 0,
      tileSetsGenerated: 0,
      qualityScore: null,
      lastProduction: null,
      activeAgents: 0,
      forgeOutput: [],
    })
  }
}
