"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Activity,
  Play,
  Pause,
  RotateCw,
  Clock,
  AlertTriangle,
} from "lucide-react"
import { AGENTS, PIPELINE_STEPS } from "@/lib/agents/agent-types"
import { fetchRecentWorkflows, fetchActiveWorkflows, startWorkflow, failWorkflow } from "@/app/actions/workflows"
import type { Workflow, AgentName, WorkflowType, WorkflowStatus } from "@/lib/types"

interface AgentStatus {
  status: "idle" | "working" | "error"
  completed: number
  lastActive: string
}

const defaultAgentStatus = (): AgentStatus => ({
  status: "idle",
  completed: 0,
  lastActive: "Never",
})

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  working: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  running: "bg-blue-500/10 text-blue-500 border-blue-500/20",
}

export default function AgentsPage() {
  const [agentStates, setAgentStates] = useState<Record<string, AgentStatus>>({})
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [recent, active] = await Promise.all([
        fetchRecentWorkflows(20),
        fetchActiveWorkflows(),
      ])
      setWorkflows(recent)

      const states: Record<string, AgentStatus> = {}
      for (const agent of AGENTS) {
        const agentWorkflows = recent.filter((w) => w.assignedAgent === agent.name)
        states[agent.name] = {
          status: active.some((w) => w.assignedAgent === agent.name) ? "working" : "idle",
          completed: agentWorkflows.filter((w) => w.status === "completed").length,
          lastActive:
            agentWorkflows.length > 0
              ? new Date(agentWorkflows[0].createdAt).toLocaleString()
              : "Never",
        }
      }
      setAgentStates(states)
      setIsRunning(active.length > 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const startPipeline = async () => {
    const pipelineOrder: { type: WorkflowType; agent: AgentName }[] = [
      { type: "trend-research", agent: "trend-researcher" },
      { type: "art-direction", agent: "art-director" },
      { type: "asset-generation", agent: "asset-generator" },
      { type: "quality-review", agent: "quality-controller" },
      { type: "packaging", agent: "packager" },
      { type: "store-listing", agent: "store-lister" },
      { type: "marketing", agent: "marketer" },
    ]

    try {
      for (const step of pipelineOrder) {
        await startWorkflow({
          workflowType: step.type,
          agent: step.agent,
        })
      }
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start pipeline")
    }
  }

  const pausePipeline = async () => {
    try {
      const active = await fetchActiveWorkflows()
      await Promise.all(
        active.map((w) => failWorkflow(w.id))
      )
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause pipeline")
    }
  }

  const resetPipeline = async () => {
    try {
      const active = await fetchActiveWorkflows()
      await Promise.all(
        active.map((w) => failWorkflow(w.id))
      )
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset pipeline")
    }
  }

  const pipelineSteps = PIPELINE_STEPS.map((label) => {
    const stepWorkflows = workflows.filter((w) => {
      const stepMap: Record<string, WorkflowType> = {
        "Trend Research": "trend-research",
        "Art Direction": "art-direction",
        "Asset Generation": "asset-generation",
        "Quality Review": "quality-review",
        "Packaging": "packaging",
        "Store Listing": "store-listing",
        "Marketing Content": "marketing",
      }
      return w.workflowType === stepMap[label]
    })
    const latest = stepWorkflows[0]
    return {
      label,
      status: (latest?.status ?? "pending") as WorkflowStatus,
      updatedAt: latest?.createdAt,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            Agent Monitor
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and control your AI agent fleet
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={pausePipeline} disabled={!isRunning}>
            <Pause className="size-3.5" />
            Pause All
          </Button>
          <Button size="sm" className="gap-2" onClick={startPipeline}>
            <Play className="size-3.5" />
            Start Pipeline
          </Button>
        </div>
      </div>

      <Separator />

      {error && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="py-4 flex items-center gap-2 text-sm text-red-500">
            <AlertTriangle className="size-4" />
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((agent) => {
          const state = agentStates[agent.name] ?? defaultAgentStatus()
          return (
            <Card key={agent.name} className="hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{agent.emoji}</span>
                    <CardTitle className="text-base">{agent.label}</CardTitle>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${STATUS_COLORS[state.status] ?? ""}`}
                  >
                    {state.status === "working" ? "Running" : "Idle"}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {agent.role}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Completed</span>
                  <span className="font-mono">{state.completed} tasks</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Status</span>
                  <span className="font-mono capitalize">{state.status}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Last Active</span>
                  <span className="font-mono flex items-center gap-1">
                    <Clock className="size-3" />
                    {state.lastActive.length > 20
                      ? state.lastActive.slice(0, 20) + "..."
                      : state.lastActive}
                  </span>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={() =>
                      startWorkflow({
                        workflowType: "asset-generation",
                        agent: agent.name,
                      }).then(() => loadData())
                    }
                  >
                    <Play className="size-3" />
                    Run
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={resetPipeline}
                  >
                    <RotateCw className="size-3" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="size-5" />
            Workflow Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 border-l-2 border-border space-y-6">
            {pipelineSteps.map((step, i) => (
              <div key={step.label} className="relative">
                <div
                  className={`absolute -left-[25px] top-1 size-3 rounded-full border-2 ${
                    step.status === "completed"
                      ? "bg-green-500 border-green-500"
                      : step.status === "running"
                      ? "bg-blue-500 border-blue-500"
                      : step.status === "failed"
                      ? "bg-red-500 border-red-500"
                      : "bg-background border-border"
                  }`}
                />
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.status === "completed"
                    ? `Completed at ${step.updatedAt ? new Date(step.updatedAt).toLocaleTimeString() : "--"}`
                    : step.status === "running"
                    ? "Running..."
                    : step.status === "failed"
                    ? "Failed"
                    : "Waiting to start"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
