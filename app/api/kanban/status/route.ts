import { NextResponse } from 'next/server'
import { listRuns, type RunDoc, type RunStage } from '@/lib/runs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Live factory status, derived from the durable runs store.
 *
 * This used to shell out to `hermes kanban list` via execSync — but `hermes`
 * lives on the home PC, not on Vercel, so in production it always fell into
 * the catch block and reported every agent idle. Now we read the unified run
 * ledger (written by both the Vercel pipeline and the Hermes fleet) so the
 * dashboard reflects what is actually happening.
 *
 * The response shape is unchanged so app/factory/page.tsx keeps working.
 */

interface AgentStatus {
  agentId: string
  status: string // idle | working | reviewing | packaging | failed
  progress: number
  tasks: Array<{ id: string; name: string; status: string; progress: number | null }>
}

interface KanbanStatus {
  agents: Record<string, AgentStatus>
  pipeline: string | null
  activeCount: number
  doneCount: number
  totalCount: number
}

// Pipeline stage → factory agent that owns it.
const STAGE_AGENT: Record<RunStage, string> = {
  scout: 'scout',
  forge: 'artist',
  qc: 'qc',
  rework: 'qc',
  package: 'pkg',
  list: 'pkg',
  done: 'pkg',
}

const PIPELINE_LABEL: Partial<Record<RunStage, string>> = {
  scout: '✦ RESEARCH & BRIEF',
  forge: '✦ SPRITE GENERATION',
  qc: '✦ QUALITY CONTROL',
  rework: '✦ REWORK LOOP',
  package: '✦ PACKAGING',
  list: '✦ LISTING',
}

function emptyAgents(): Record<string, AgentStatus> {
  return {
    popo: { agentId: 'popo', status: 'idle', progress: 0, tasks: [] },
    scout: { agentId: 'scout', status: 'idle', progress: 0, tasks: [] },
    artist: { agentId: 'artist', status: 'idle', progress: 0, tasks: [] },
    qc: { agentId: 'qc', status: 'idle', progress: 0, tasks: [] },
    pkg: { agentId: 'pkg', status: 'idle', progress: 0, tasks: [] },
  }
}

function buildStatus(runs: RunDoc[]): KanbanStatus {
  const agents = emptyAgents()
  let activeCount = 0
  let doneCount = 0
  let pipelineStage: RunStage | null = null

  for (const run of runs) {
    const taskName = run.theme || run.kind || run.id
    if (run.status === 'running') {
      activeCount++
      const stage = (run.stage || 'forge') as RunStage
      const agentId = STAGE_AGENT[stage] || 'popo'
      const agent = agents[agentId]
      if (agent) {
        agent.tasks.push({ id: run.id, name: taskName, status: 'active', progress: run.progress ?? 50 })
      }
      // The most-recent running run (runs come back newest-first) drives the
      // headline pipeline label and POPO's "directing" state.
      if (!pipelineStage) {
        pipelineStage = stage
        agents.popo.status = 'working'
        agents.popo.progress = run.progress ?? 50
        agents.popo.tasks.push({ id: run.id, name: `Directing: ${taskName}`, status: 'active', progress: run.progress ?? 50 })
      }
    } else if (run.status === 'passed') {
      doneCount++
    } else if (run.status === 'failed') {
      const stage = (run.stage || 'qc') as RunStage
      const agentId = STAGE_AGENT[stage] || 'qc'
      const agent = agents[agentId]
      if (agent) {
        agent.tasks.push({ id: run.id, name: taskName, status: 'failed', progress: run.progress ?? null })
      }
    }
  }

  // Derive each agent's headline status from its tasks.
  for (const [id, agent] of Object.entries(agents)) {
    if (id === 'popo') continue // already set above
    if (agent.tasks.length === 0) continue
    const hasFailed = agent.tasks.some(t => t.status === 'failed')
    const hasActive = agent.tasks.some(t => t.status === 'active')
    if (hasFailed && !hasActive) {
      agent.status = 'failed'
      agent.progress = 50
    } else if (hasActive) {
      agent.status = id === 'artist' ? 'working' : id === 'qc' ? 'reviewing' : id === 'scout' ? 'working' : 'packaging'
      agent.progress = Math.round(
        agent.tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / agent.tasks.length,
      )
    }
  }

  return {
    agents,
    pipeline: pipelineStage ? PIPELINE_LABEL[pipelineStage] ?? null : null,
    activeCount,
    doneCount,
    totalCount: runs.length,
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const runs = await listRuns({ limit: 50 })
    return NextResponse.json(buildStatus(runs), { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    console.error('kanban status error:', e)
    return NextResponse.json(
      { agents: emptyAgents(), pipeline: null, activeCount: 0, doneCount: 0, totalCount: 0 },
      { headers: { 'cache-control': 'no-store' } },
    )
  }
}
