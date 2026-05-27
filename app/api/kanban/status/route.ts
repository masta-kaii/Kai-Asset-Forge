import { execSync } from 'child_process'
import { NextResponse } from 'next/server'

function hermes(args: string): string {
  try {
    return execSync(`hermes ${args} 2>&1`, { encoding: 'utf-8', timeout: 15000 })
  } catch (e: any) {
    return e.stdout || e.stderr || e.message
  }
}

// Agent ID mapping: Kanban assignee → factory agent ID
const ASSIGNEE_MAP: Record<string, string> = {
  scout: 'scout',
  forge: 'artist',
  curator: 'qc',
  packager: 'pkg',
  lister: 'pkg',
  default: 'popo',
}

interface AgentStatus {
  agentId: string
  status: string       // idle | working | reviewing | packaging | failed
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

export async function GET(): Promise<NextResponse> {
  try {
    const output = hermes('kanban list')

    // Parse Kanban output
    const agents: Record<string, AgentStatus> = {
      popo: { agentId: 'popo', status: 'idle', progress: 0, tasks: [] },
      artist: { agentId: 'artist', status: 'idle', progress: 0, tasks: [] },
      qc: { agentId: 'qc', status: 'idle', progress: 0, tasks: [] },
      pkg: { agentId: 'pkg', status: 'idle', progress: 0, tasks: [] },
    }

    const lines = output.split('\n')
    let currentTask: any = null
    let activeCount = 0
    let doneCount = 0
    let totalCount = 0

    // Parse task lines — format: "  t_xxx  Task Name  status  assignee"
    for (const line of lines) {
      const match = line.match(/^\s*(t_\w+)\s+(.+?)\s{2,}(\w+)\s{2,}(\S+)/)
      if (match) {
        const [, id, name, status, assignee] = match
        const factoryId = ASSIGNEE_MAP[assignee.toLowerCase()] || 'popo'
        totalCount++

        const taskStatus = status.toLowerCase()
        if (taskStatus === 'done' || taskStatus === 'completed') {
          doneCount++
        } else if (taskStatus === 'active' || taskStatus === 'running' || taskStatus === 'in_progress') {
          activeCount++
        }

        const task = {
          id,
          name: name.trim(),
          status: taskStatus,
          progress: null as number | null,
        }

        if (taskStatus === 'done') task.progress = 100
        else if (taskStatus === 'active') task.progress = 50

        if (factoryId && agents[factoryId]) {
          agents[factoryId].tasks.push(task)
        }
      }
    }

    // Derive agent statuses from their tasks
    for (const [id, agent] of Object.entries(agents)) {
      if (agent.tasks.length === 0) {
        agent.status = 'idle'
        agent.progress = 0
        continue
      }

      const hasActive = agent.tasks.some(t => t.status === 'active' || t.status === 'running')
      const hasFailed = agent.tasks.some(t => t.status === 'failed')
      const allDone = agent.tasks.every(t => t.status === 'done' || t.status === 'completed')

      if (hasFailed) {
        agent.status = 'failed'
        agent.progress = 50
      } else if (hasActive) {
        agent.status = id === 'artist' ? 'working' : id === 'qc' ? 'reviewing' : 'packaging'
        agent.progress = Math.round(
          agent.tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / agent.tasks.length
        )
      } else if (allDone) {
        agent.status = 'idle'
        agent.progress = 100
      } else {
        agent.status = 'idle'
        agent.progress = 0
      }
    }

    // Determine pipeline step
    const pipelineOrder = ['artist', 'qc', 'pkg']
    let pipeline: string | null = null
    for (const id of pipelineOrder) {
      if (agents[id].tasks.some(t => t.status === 'active' || t.status === 'running')) {
        pipeline = id === 'artist' ? '✦ SPRITE GENERATION' : id === 'qc' ? '✦ QUALITY CONTROL' : '✦ PACKAGING'
        break
      }
    }

    const result: KanbanStatus = {
      agents,
      pipeline,
      activeCount,
      doneCount,
      totalCount,
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({
      agents: {
        popo: { agentId: 'popo', status: 'idle', progress: 0, tasks: [] },
        artist: { agentId: 'artist', status: 'idle', progress: 0, tasks: [] },
        qc: { agentId: 'qc', status: 'idle', progress: 0, tasks: [] },
        pkg: { agentId: 'pkg', status: 'idle', progress: 0, tasks: [] },
      },
      pipeline: null,
      activeCount: 0,
      doneCount: 0,
      totalCount: 0,
    })
  }
}
