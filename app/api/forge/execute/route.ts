import { execSync } from 'child_process'
import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const STATS_PATH = join(process.cwd(), 'data', 'agent-stats.json')

function hermes(args: string): string {
  try {
    return execSync(`hermes ${args} 2>&1`, { encoding: 'utf-8', timeout: 30000 })
  } catch (e: any) {
    return e.stdout || e.stderr || e.message
  }
}

function extractTaskId(output: string): string | null {
  const match = output.match(/(t_[a-zA-Z0-9]+)/)
  return match ? match[1] : null
}

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1))
}

async function feedAgentXP(agentId: string, xp: number, action: string) {
  try {
    const raw = await readFile(STATS_PATH, 'utf-8')
    const stats = JSON.parse(raw)
    const agent = stats[agentId]
    if (!agent) return null

    agent.totalXP = (agent.totalXP || 0) + xp
    const required = xpForLevel(agent.level)
    let leveledUp = false
    
    if (agent.totalXP >= required) {
      agent.level = agent.level + 1
      agent.xpToNext = xpForLevel(agent.level + 1)
      agent.xp = agent.totalXP - required
      leveledUp = true
    } else {
      agent.xpToNext = required
      agent.xp = agent.totalXP
    }

    agent.trainingHistory = agent.trainingHistory || []
    agent.trainingHistory.unshift({ action, xp, ts: new Date().toISOString() })
    if (agent.trainingHistory.length > 20) {
      agent.trainingHistory = agent.trainingHistory.slice(0, 20)
    }

    await writeFile(STATS_PATH, JSON.stringify(stats, null, 2), 'utf-8')
    return { agent: stats[agentId], leveledUp }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const theme = body.theme || 'dungeon'

    // Step 1: Create Scout task
    const scoutOut = hermes(
      `kanban create "Scout: Research ${theme} pixel art trends" --assignee scout --body "Research trending ${theme}-themed pixel art. Find asset gaps. Output list of sprite descriptions."`
    )
    const scoutId = extractTaskId(scoutOut)
    if (!scoutId) throw new Error('Failed to create Scout task')

    // Step 2: Create Forge task (parent = Scout)
    const forgeOut = hermes(
      `kanban create "Forge: Generate ${theme} pixel art sprites" --assignee forge --parent ${scoutId} --body "Generate sprites using aseprite-forge.py. Pass to Curator."`
    )
    const forgeId = extractTaskId(forgeOut)
    if (!forgeId) throw new Error('Failed to create Forge task')

    // Step 3: Create Curator task (parent = Forge)
    const curatorOut = hermes(
      `kanban create "Curator: Quality check ${theme} sprites" --assignee curator --parent ${forgeId} --body "Check against 0x72 standard. Score 1-10. Pass approved to Packager."`
    )
    const curatorId = extractTaskId(curatorOut)
    if (!curatorId) throw new Error('Failed to create Curator task')

    // Step 4: Create Packager task (parent = Curator)
    const packagerOut = hermes(
      `kanban create "Packager: Bundle ${theme} assets" --assignee packager --parent ${curatorId} --body "Bundle approved assets. Create sprite sheets and previews. Pass to Lister."`
    )
    const packagerId = extractTaskId(packagerOut)
    if (!packagerId) throw new Error('Failed to create Packager task')

    // Step 5: Create Lister task (parent = Packager)
    const listerOut = hermes(
      `kanban create "Lister: Marketplace listing for ${theme} pack" --assignee lister --parent ${packagerId} --body "Write SEO titles, descriptions, pricing. Draft for Popo approval."`
    )
    const listerId = extractTaskId(listerOut)
    if (!listerId) throw new Error('Failed to create Lister task')

    // ── FEED AGENT XP from production ──
    const xpResults: any[] = []
    
    // Popo gets XP for orchestrating
    const popoResult = await feedAgentXP('popo', 20, `Pipeline orchestration: ${theme}`)
    if (popoResult) xpResults.push({ agent: 'popo', ...popoResult })
    
    // Artist gets XP for generating
    const artistResult = await feedAgentXP('artist', 25, `Asset generation: ${theme}`)
    if (artistResult) xpResults.push({ agent: 'artist', ...artistResult })
    
    // QC gets XP for reviewing
    const qcResult = await feedAgentXP('qc', 15, `Quality review: ${theme}`)
    if (qcResult) xpResults.push({ agent: 'qc', ...qcResult })
    
    // Pkg gets XP for packaging
    const pkgResult = await feedAgentXP('pkg', 10, `Asset packaging: ${theme}`)
    if (pkgResult) xpResults.push({ agent: 'pkg', ...pkgResult })

    const levelUps = xpResults.filter((r: any) => r.leveledUp).map((r: any) => r.agent.agent?.name || r.agent)

    return NextResponse.json({
      success: true,
      pipeline: [scoutId, forgeId, curatorId, packagerId, listerId],
      theme,
      message: `✦ PIPELINE ACTIVE: ${theme.toUpperCase()} PACK IN PRODUCTION`,
      agentXP: xpResults.map((r: any) => ({
        agent: r.agent?.agent?.id || r.agent,
        name: r.agent?.agent?.name,
        xp: r.agent?.agent?.xp,
        level: r.agent?.agent?.level,
        leveledUp: r.leveledUp,
      })),
      levelUps: levelUps.length > 0 ? levelUps : undefined,
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message || 'Pipeline creation failed',
    })
  }
}
