import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface KanbanTask {
  id: string
  status: string        // "ready" | "active" | "done" | "blocked" | "todo"
  assignee: string      // profile name
  title: string
  parent?: string
  children?: string[]
}

interface AgentStatus {
  profile: string
  label: string
  activeCount: number    // currently running
  readyCount: number     // waiting to be picked up
  doneCount: number      // completed
  blockedCount: number   // stuck
  currentTask?: { id: string; title: string }
}

/**
 * GET /api/kanban/status
 * Returns real-time Kanban board status for all factory agents
 */
export async function GET() {
  try {
    // Run hermes kanban list --json for real data
    const { stdout } = await execAsync("hermes kanban list --json", {
      timeout: 10000,
      cwd: process.env.HOME || process.env.USERPROFILE,
    })

    const tasks: KanbanTask[] = JSON.parse(stdout)

    // Map our 5 pipeline agents
    const pipelineProfiles = ["scout", "forge", "curator", "packager", "lister"]
    const agents: Record<string, AgentStatus> = {}

    for (const profile of pipelineProfiles) {
      const agentTasks = tasks.filter((t) => t.assignee === profile)
      const active = agentTasks.filter((t) => t.status === "active")
      const ready = agentTasks.filter((t) => t.status === "ready")
      const done = agentTasks.filter((t) => t.status === "done")
      const blocked = agentTasks.filter((t) => t.status === "blocked")

      agents[profile] = {
        profile,
        label: profile.charAt(0).toUpperCase() + profile.slice(1),
        activeCount: active.length,
        readyCount: ready.length,
        doneCount: done.length,
        blockedCount: blocked.length,
        currentTask: active.length > 0
          ? { id: active[0].id, title: active[0].title }
          : undefined,
      }
    }

    // Determine current pipeline step
    // The pipeline is SCAN→FORGE→QC→BUNDLE→LIST
    // We find which agent currently has active/ready tasks (first in chain wins)
    const pipelineOrder = ["scout", "forge", "curator", "packager", "lister"]
    let currentStep = -1
    let totalTasks = tasks.length
    let doneTotal = tasks.filter((t) => t.status === "done").length
    let blockedTotal = tasks.filter((t) => t.status === "blocked").length

    for (let i = 0; i < pipelineOrder.length; i++) {
      const a = agents[pipelineOrder[i]]
      if (a && (a.activeCount > 0 || a.readyCount > 0)) {
        currentStep = i
        break
      }
    }

    // All done = cycle complete
    const allDone = currentStep === -1 && doneTotal > 0

    return NextResponse.json({
      agents,
      pipeline: {
        currentStep,
        currentAgent: currentStep >= 0 ? pipelineOrder[currentStep] : null,
        allDone,
      },
      board: {
        totalTasks,
        doneTotal,
        blockedTotal,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
        agents: {},
        pipeline: { currentStep: -1, currentAgent: null, allDone: false },
        board: { totalTasks: 0, doneTotal: 0, blockedTotal: 0 },
      },
      { status: 200 } // Don't fail — just return empty
    )
  }
}
