import { execSync } from 'child_process'
import { NextResponse } from 'next/server'
import { readFile, writeFile, appendFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const STATS_PATH = join(process.cwd(), 'data', 'agent-stats.json')

// Resolve Obsidian vault path
function getVaultPath(): string | null {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const candidates = [
    join(home, 'Documents', 'Kai-Forge-Vault'),
    join(home, 'Documents', 'Obsidian Vault'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

async function logToVault(note: string, content: string) {
  const vault = getVaultPath()
  if (!vault) return
  const path = join(vault, note)
  await appendFile(path, content, 'utf-8').catch(() => {})
}

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

    // Step 1: SCOUT — Research TWO separate tracks
    const scoutOut = hermes(
      `kanban create "Scout: Research ${theme} pixel art trends" --assignee scout --body "Research trending pixel art themes, reference game art, and visual styles for ${theme}. Find asset gaps in 0x72-style tilesets. Output creative brief for Pixel Artist."`
    )
    const scoutId = extractTaskId(scoutOut)
    if (!scoutId) throw new Error('Failed to create Scout task')

    const webScoutOut = hermes(
      `kanban create "Scout: Research Malaysian web design demand" --assignee scout --parent ${scoutId} --body "Research current Malaysian market web design trends: what industries are growing (food delivery, e-commerce, fintech, travel, education), what design styles are popular (modern minimalist, bold interactive, dark mode), what local payment methods matter (FPX, Touch n Go, GrabPay). Find fresh interactive design patterns. Output creative brief for Web Generator — this is a SEPARATE product from pixel art."`
    )
    const webScoutId = extractTaskId(webScoutOut)
    // Web Scout optional — don't block pipeline if it fails

    // Step 2a: PIXEL ARTIST — Generate sprites
    const artistOut = hermes(
      `kanban create "Pixel Artist: Generate ${theme} sprites" --assignee artist --parent ${scoutId} --body "Generate pixel art sprites + tilesets for ${theme} theme. Use aseprite-forge.py. Pass to QC."`
    )
    const artistId = extractTaskId(artistOut)
    if (!artistId) throw new Error('Failed to create Pixel Artist task')

    // Step 2b: WEB GENERATOR — Build Malaysian-market website (SEPARATE product)
    const webgenOut = hermes(
      `kanban create "Web Generator: Build Malaysian-market landing page" --assignee webgen --parent ${webScoutId || scoutId} --body "Build a modern, interactive, and visually striking landing page for the Malaysian market. Use fresh design trends — bold typography, smooth animations, glass morphism, dark mode. Focus on industries with Malaysian demand: food delivery, e-commerce fashion, fintech, travel, education. Include local context: FPX/TNG payment badges, Bahasa Malaysia option, mobile-first (92% mobile users). This is completely separate from pixel art — this is a web product."`
    )
    const webgenId = extractTaskId(webgenOut)
    if (!webgenId) throw new Error('Failed to create Web Generator task')

    // Step 3: QC — Review Pixel Artist AND Web Generator outputs (separate products)
    const qcOut = hermes(
      `kanban create "QC: Review pixel art + Malaysian web product" --assignee qc --body "Review TWO separate products: (1) Pixel Artist's sprites — check against 0x72 standard, palette consistency, outlines. (2) Web Generator's landing page — check design quality, interactivity, mobile responsiveness, Malaysian market relevance (local payments, Bahasa support, industry fit). Score both 1-10 independently. Pass approved assets to Packager."`
    )
    const qcId = extractTaskId(qcOut)
    if (!qcId) throw new Error('Failed to create QC task')

    // Step 4: PACKAGER — Bundle everything
    const pkgOut = hermes(
      `kanban create "Packager: Bundle ${theme} pack" --assignee pkg --parent ${qcId} --body "Bundle approved pixel assets AND web components. Create sprite sheets, deployable web build, and previews."`
    )
    const pkgId = extractTaskId(pkgOut)
    if (!pkgId) throw new Error('Failed to create Packager task')

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

    // ── LOG TO OBSIDIAN VAULT ──
    const batchNum = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    logToVault('Batch History.md', `
## BATCH #${batchNum} — ${theme.toUpperCase()}
- **Date:** ${today}
- **Theme:** ${theme}
- **Status:** 🔄 IN PROGRESS
- **Agents:** SCOUT → PIXEL STUDIO + WEB GENERATOR → QC CHAMBER → PACKAGING BAY
- **Tasks Created:** 5 (Scout: \`${scoutId}\` → Pixel: \`${artistId}\` + Web: \`${webgenId}\` → QC: \`${qcId}\` → PKG: \`${pkgId}\`)
- **XP Awarded:** POPO +20, SCOUT +25, PIXEL +25, WEB +25, QC +15, PKG +10
${levelUps.length > 0 ? `- **⚡ LEVEL UP:** ${levelUps.join(', ')}` : ''}
---
`)
    logToVault('POPO COMMAND.md', `\n## Pipeline Run — ${theme} — ${today}\n- Created 5 Kanban tasks\n- Batch #${batchNum}\n${levelUps.length > 0 ? `- Level ups: ${levelUps.join(', ')}` : ''}\n`)

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
