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

    // Step 1: SCOUT — Research trends
    const scoutOut = hermes(
      `kanban create "Scout: Research ${theme} pixel art + web trends" --assignee scout --body "Research trending ${theme}-themed pixel art AND web design trends. Find asset gaps. Output creative briefs for both Pixel Studio and Web Generator."`
    )
    const scoutId = extractTaskId(scoutOut)
    if (!scoutId) throw new Error('Failed to create Scout task')

    // Step 2a: PIXEL STUDIO — Generate sprites (parallel with Web Generator)
    const artistOut = hermes(
      `kanban create "Pixel Studio: Generate ${theme} sprite pack" --assignee artist --parent ${scoutId} --body "Generate pixel art sprites + tilesets for ${theme} theme. Use aseprite-forge.py. Pass to QC."`
    )
    const artistId = extractTaskId(artistOut)
    if (!artistId) throw new Error('Failed to create Pixel Studio task')

    // Step 2b: WEB GENERATOR — Generate web components (parallel)
    const webgenOut = hermes(
      `kanban create "Web Generator: Build ${theme} landing page" --assignee webgen --parent ${scoutId} --body "Generate responsive landing page + components for ${theme} theme. Pass to QC."`
    )
    const webgenId = extractTaskId(webgenOut)
    if (!webgenId) throw new Error('Failed to create Web Generator task')

    // Step 3: QC CHAMBER — Review both outputs
    const qcOut = hermes(
      `kanban create "QC Chamber: Review ${theme} pixel + web assets" --assignee qc --body "Check pixel art against 0x72 standard. Validate web components. Score both 1-10. Pass approved to Packager."`
    )
    const qcId = extractTaskId(qcOut)
    if (!qcId) throw new Error('Failed to create QC task')

    // Step 4: PACKAGING BAY — Bundle everything
    const pkgOut = hermes(
      `kanban create "Packaging Bay: Bundle ${theme} pixel + web pack" --assignee pkg --parent ${qcId} --body "Bundle approved pixel assets AND web components. Create sprite sheets, deployable web build, and previews."`
    )
    const pkgId = extractTaskId(pkgOut)
    if (!pkgId) throw new Error('Failed to create Pkg task')

    // ── FEED AGENT XP ──
    const xpResults: any[] = []
    const feed = async (id: string, xp: number, action: string) => {
      const r = await feedAgentXP(id, xp, action)
      if (r) xpResults.push({ agent: id, ...r })
    }

    await feed('popo', 20, `Pipeline orchestration: ${theme}`)
    await feed('scout', 25, `Trend research: ${theme}`)
    await feed('artist', 25, `Sprite generation: ${theme}`)
    await feed('webgen', 25, `Web component generation: ${theme}`)
    await feed('qc', 15, `Quality review: ${theme}`)
    await feed('pkg', 10, `Asset packaging: ${theme}`)

    const levelUps = xpResults.filter((r: any) => r.leveledUp).map((r: any) => r.agent?.agent?.name || r.agent)

    return NextResponse.json({
      success: true,
      pipeline: [scoutId, artistId, webgenId, qcId, pkgId],
      theme,
      message: `✦ PIPELINE ACTIVE: ${theme.toUpperCase()} — SCOUT→PIXEL+WEB→QC→PKG`,
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
