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

    // ── SWARM MODE: Agents work together, discuss freely ──
    // Workers (parallel): Pixel Artist + Web Generator
    // Verifier: QC reviews everything
    // Synthesizer: Packager bundles final output
    const swarmOut = hermes(
      `kanban swarm "Create a ${theme}-themed asset pack with TWO products: (1) pixel art sprites and tilesets following 0x72 standards, (2) a modern Malaysian-market landing page with local payments (FPX/TNG). Both products must be high quality and market-ready." --worker pixel-artist:"Pixel Artist: Generate pixel art" --worker web-builder:"Web Generator: Build Malaysian landing page" --verifier qc-reviewer --synthesizer packager`
    )

    // Parse swarm output for task IDs
    const rootMatch = swarmOut.match(/root:\s*(t_\w+)/)
    const workerMatches = swarmOut.match(/Workers:\s*(t_\w+),\s*(t_\w+)/)
    const verifierMatch = swarmOut.match(/Verifier:\s*(t_\w+)/)
    const synthMatch = swarmOut.match(/Synthesizer:\s*(t_\w+)/)

    if (!rootMatch || !workerMatches || !verifierMatch || !synthMatch) {
      throw new Error('Swarm creation failed: ' + swarmOut.slice(0, 200))
    }

    const rootId = rootMatch[1]
    const artistId = workerMatches[1]
    const webgenId = workerMatches[2]
    const qcId = verifierMatch[1]
    const pkgId = synthMatch[1]

    log("✦ SWARM DEPLOYED — agents discussing freely","success","POPO")
    log("Pixel Artist assigned: " + artistId,"info","POPO")
    log("Web Generator assigned: " + webgenId,"info","POPO")
    log("QC Verifier assigned: " + qcId,"info","POPO")
    log("Packager assigned: " + pkgId,"info","POPO")

    // The swarm mode lets agents:
    // - Work in PARALLEL (not rigid sequential pipeline)
    // - Comment on each other's tasks (free discussion)
    // - QC can ask Pixel Artist to revise (not just pass/fail)
    // - Packager sees everything and synthesizes

    // ── FEED AGENT XP ──
    const xpResults: any[] = []
    const feed = async (id: string, xp: number, action: string) => {
      const r = await feedAgentXP(id, xp, action)
      if (r) xpResults.push({ agent: id, ...r })
    }

    await feed('popo', 20, `Swarm orchestration: ${theme}`)
    await feed('artist', 25, `Pixel art worker: ${theme}`)
    await feed('webgen', 25, `Web worker: ${theme}`)
    await feed('qc', 15, `Swarm verification: ${theme}`)
    await feed('pkg', 10, `Synthesis: ${theme}`)

    const levelUps = xpResults.filter((r: any) => r.leveledUp).map((r: any) => r.agent?.agent?.name || r.agent)

    // ── LOG TO OBSIDIAN VAULT ──
    const batchNum = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    logToVault('Batch History.md', `
## SWARM #${batchNum} — ${theme.toUpperCase()}
- **Date:** ${today}
- **Mode:** 🐝 SWARM (agents freely collaborating)
- **Root:** \`${rootId}\`
- **Workers:** Pixel Artist (\`${artistId}\`) + Web Generator (\`${webgenId}\`)
- **Verifier:** QC (\`${qcId}\`) — reviews both products
- **Synthesizer:** Packager (\`${pkgId}\`) — bundles final output
- **XP Awarded:** POPO +20, PIXEL +25, WEB +25, QC +15, PKG +10
${levelUps.length > 0 ? `- **⚡ LEVEL UP:** ${levelUps.join(', ')}` : ''}
---
`)

    return NextResponse.json({
      success: true,
      swarm: { root: rootId, workers: [artistId, webgenId], verifier: qcId, synthesizer: pkgId },
      theme,
      message: `🐝 SWARM ACTIVE: ${theme.toUpperCase()} — Pixel Artist + Web Generator collaborating`,
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
