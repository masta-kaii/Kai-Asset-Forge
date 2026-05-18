"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { autonomousTick } from "@/app/actions/autonomous-agent"
import { getDashboardData } from "@/app/actions/dashboard"
import { pause, resume } from "@/lib/budget/kill-switch"
import { runOrchestrator } from "@/app/actions/orchestrator"
import {
  Play,
  Pause,
  Zap,
  Wifi,
  WifiOff,
  Cpu,
  Package,
  Activity,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Brain,
  BarChart3,
  Sparkles,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentState = "idle" | "working" | "done" | "error"

interface LiveAgent {
  key: string
  name: string
  label: string
  emoji: string
  role: string
  status: AgentState
  lastAction: string
  lastTime: string
  pulse: boolean
}

interface SimStatus {
  forgeAction: string
  forgeDetail: string
  forgeTimestamp: string
  providers: { openai: string; deepseek: string }
  budget: { used: number; cap: number; remaining: number }
  backlog: { unlistedAssets: number; stuckRuns: number; packsToPublish: number }
  isPaused: boolean
  totalAssets: number
  readyPacks: number
  activeWorkflows: number
}

interface LogEntry {
  id: number
  time: string
  agent: string
  msg: string
  type: "info" | "ok" | "warn" | "err"
}

// ---------------------------------------------------------------------------
// Agent definitions (mirrors Hermes fleet + dash agents)
// ---------------------------------------------------------------------------

const AGENT_DEFS = [
  { key: "orchestrator", label: "Orchestrator", emoji: "🧠", role: "Central planner" },
  { key: "scout", label: "Scout", emoji: "🔍", role: "Trend research" },
  { key: "forge", label: "Forge", emoji: "⚡", role: "Asset generation" },
  { key: "curator", label: "Curator", emoji: "✅", role: "Quality review" },
  { key: "packager", label: "Packager", emoji: "📦", role: "Bundle assets" },
  { key: "lister", label: "Lister", emoji: "🏪", role: "Marketplace listing" },
  { key: "deploy", label: "Deploy", emoji: "🚀", role: "Publish packs" },
  { key: "monitor", label: "Monitor", emoji: "📡", role: "Health checks" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtTime(iso?: string) {
  if (!iso) return "--:--"
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour12: false })
  } catch {
    return "--:--"
  }
}

function providerDot(status: string) {
  if (status === "healthy") return "🟢"
  if (status === "degraded") return "🟡"
  return "🔴"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkstationPage() {
  const [status, setStatus] = useState<SimStatus>({
    forgeAction: "idle",
    forgeDetail: "Connecting...",
    forgeTimestamp: "",
    providers: { openai: "unknown", deepseek: "unknown" },
    budget: { used: 0, cap: 10, remaining: 10 },
    backlog: { unlistedAssets: 0, stuckRuns: 0, packsToPublish: 0 },
    isPaused: false,
    totalAssets: 0,
    readyPacks: 0,
    activeWorkflows: 0,
  })

  const [agents, setAgents] = useState<LiveAgent[]>(
    AGENT_DEFS.map((a) => ({
      name: a.key,
      key: a.key,
      label: a.label,
      emoji: a.emoji,
      role: a.role,
      status: "idle" as AgentState,
      lastAction: "—",
      lastTime: "",
      pulse: false,
    }))
  )

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [forgeRunning, setForgeRunning] = useState(false)
  const [uptime, setUptime] = useState(0)
  const logCounter = useRef(0)
  const logsEnd = useRef<HTMLDivElement>(null)

  function addLog(agent: string, msg: string, type: LogEntry["type"] = "info") {
    const id = ++logCounter.current
    const time = new Date().toLocaleTimeString("en-US", { hour12: false })
    setLogs((prev) => [...prev.slice(-50), { id, time, agent, msg, type }])
  }

  // ---- Poll loop ----
  useEffect(() => {
    const interval = setInterval(uptimeTick, 1000)
    return () => clearInterval(interval)
  }, [])

  function uptimeTick() {
    setUptime((u) => u + 1)
  }

  useEffect(() => {
    let mounted = true

    async function poll() {
      if (!mounted) return
      try {
        const [tick, dash] = await Promise.all([
          autonomousTick(),
          getDashboardData(),
        ])

        if (!mounted) return

        setStatus({
          forgeAction: tick.action,
          forgeDetail: tick.detail,
          forgeTimestamp: tick.timestamp,
          providers: tick.providers,
          budget: tick.budget,
          backlog: tick.backlog,
          isPaused: dash.isPaused,
          totalAssets: dash.totalAssets,
          readyPacks: dash.readyPacks,
          activeWorkflows: dash.activeWorkflows,
        })

        // Derive agent states from tick data
        const action = tick.action
        setAgents((prev) =>
          prev.map((a) => {
            let agentStatus: AgentState = "idle"
            let lastAction = a.lastAction
            let pulse = false

            switch (a.key) {
              case "orchestrator":
                if (action === "forging" || action === "scanning") {
                  agentStatus = "working"; pulse = true
                  lastAction = tick.detail
                } else if (action === "paused" || action === "blocked") {
                  agentStatus = "error"
                  lastAction = "Paused — " + tick.detail
                }
                break
              case "scout":
                if (action === "scanning") {
                  agentStatus = "working"; pulse = true
                  lastAction = "Scanning trends"
                }
                break
              case "forge":
                if (action === "forging") {
                  agentStatus = "working"; pulse = true
                  lastAction = "Generating assets"
                }
                break
              case "curator":
                if (action === "forging" || tick.backlog.unlistedAssets > 0) {
                  agentStatus = "working"; pulse = true
                  lastAction = "Reviewing quality"
                }
                break
              case "packager":
                if (action === "packaging") {
                  agentStatus = "working"; pulse = true
                  lastAction = tick.detail
                } else if (tick.backlog.packsToPublish > 0) {
                  agentStatus = "working"; pulse = true
                  lastAction = `${tick.backlog.packsToPublish} pack(s) ready`
                }
                break
              case "lister":
                if (action === "packaging" || action === "publishing") {
                  agentStatus = "working"; pulse = true
                  lastAction = "Generating listing"
                }
                break
              case "deploy":
                if (action === "publishing") {
                  agentStatus = "working"; pulse = true
                  lastAction = tick.detail
                }
                break
              case "monitor":
                agentStatus = "working"
                lastAction = "Watching health every 5m"
                break
            }

            return { ...a, status: agentStatus, lastAction, pulse }
          })
        )

        // Fire events for log when action changes
        // (log throttling done by comparison in tick)
      } catch {
        if (mounted) setAgents((prev) => prev.map((a) => ({ ...a, status: "error" as AgentState })))
      }
    }

    poll()
    const timer = setInterval(poll, 4000)
    return () => { mounted = false; clearInterval(timer) }
  }, [])

  // ---- Orchestrator launch ----
  async function handleLaunch() {
    setForgeRunning(true)
    addLog("orchestrator", "Launching forge pipeline...", "info")
    try {
      const result = await runOrchestrator({ theme: "fantasy creatures", maxAssets: 2 })
      if (result.error) {
        addLog("orchestrator", result.error, "err")
      } else if (result.status === "paused_provider") {
        addLog("orchestrator", `Paused: ${result.error ?? "provider limit"}`, "warn")
      } else {
        addLog("orchestrator", `Forge complete — ${result.status}`, "ok")
      }
    } catch (e: unknown) {
      addLog("orchestrator", (e as Error).message ?? "Unknown error", "err")
    } finally {
      setForgeRunning(false)
    }
  }

  async function handlePause() {
    if (status.isPaused) {
      await resume()
      addLog("system", "Forge resumed", "ok")
    } else {
      await pause()
      addLog("system", "Forge paused — kill switch active", "warn")
    }
    const dash = await getDashboardData()
    setStatus((s) => ({ ...s, isPaused: dash.isPaused }))
  }

  // ---- UI helpers ----
  const budgetPct = status.budget.cap > 0 ? Math.round((status.budget.used / status.budget.cap) * 100) : 0
  const uptimeStr = `${String(Math.floor(uptime / 3600)).padStart(2, "0")}:${String(Math.floor((uptime % 3600) / 60)).padStart(2, "0")}:${String(uptime % 60).padStart(2, "0")}`

  // Auto-scroll logs
  useEffect(() => {
    logsEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  return (
    <div className="space-y-4 p-1">
      {/* ============== TOP STATUS BAR ============== */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/60 px-4 py-2.5 font-mono text-xs">
        {/* Forge status */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">STATUS</span>
          <Badge variant={status.forgeAction === "idle" ? "secondary" : status.forgeAction === "blocked" ? "destructive" : "default"}>
            {status.forgeAction.toUpperCase()}
          </Badge>
          <span className="max-w-64 truncate text-muted-foreground">{status.forgeDetail}</span>
        </div>

        <Separator orientation="vertical" className="h-4" />

        {/* Providers */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">API</span>
          <span>{providerDot(status.providers.openai)} OpenAI</span>
          <span>{providerDot(status.providers.deepseek)} DeepSeek</span>
        </div>

        <Separator orientation="vertical" className="h-4" />

        {/* Budget */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">BUDGET</span>
          <span>${status.budget.used.toFixed(2)} / ${status.budget.cap.toFixed(0)}</span>
          <Progress value={budgetPct} className="w-20" />
          <span className={budgetPct > 90 ? "text-red-500" : "text-muted-foreground"}>{budgetPct}%</span>
        </div>

        <Separator orientation="vertical" className="h-4" />

        {/* Stats */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-muted-foreground"><Package className="h-3 w-3" /> {status.totalAssets}</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Sparkles className="h-3 w-3" /> {status.readyPacks}</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Activity className="h-3 w-3" /> {status.activeWorkflows}</span>
        </div>

        <Separator orientation="vertical" className="h-4" />

        {/* Uptime */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{uptimeStr}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {status.isPaused && (
            <Badge variant="destructive" className="animate-pulse">KILLSWITCH</Badge>
          )}
          <Button size="icon-xs" variant={status.isPaused ? "default" : "ghost"} onClick={handlePause}>
            {status.isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </Button>
          <Button size="xs" onClick={handleLaunch} disabled={forgeRunning}>
            {forgeRunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
            {forgeRunning ? "FORGING" : "FORGE"}
          </Button>
        </div>
      </div>

      {/* ============== AGENT GRID ============== */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {agents.map((agent) => (
          <Card
            key={agent.key}
            className={`group relative overflow-hidden transition-all hover:ring-2 hover:ring-primary/30 ${
              agent.pulse ? "ring-1 ring-primary/40" : ""
            }`}
          >
            {/* Pulse animation overlay */}
            {agent.pulse && (
              <div className="absolute inset-0 animate-pulse bg-primary/5" />
            )}

            <CardHeader className="flex flex-row items-center gap-2.5 pb-1">
              <span className="text-2xl">{agent.emoji}</span>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm font-mono truncate">{agent.label}</CardTitle>
                <p className="text-xs text-muted-foreground font-mono truncate">{agent.role}</p>
              </div>
              <StatusDot status={agent.status} />
            </CardHeader>

            <CardContent className="space-y-1.5 pb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono">STATUS</span>
                <Badge
                  variant={agent.status === "working" ? "default" : agent.status === "error" ? "destructive" : "secondary"}
                  className="font-mono text-[10px]"
                >
                  {agent.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed line-clamp-2 min-h-[2.5em]">
                {agent.lastAction}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ============== BACKLOG + TASK BUS ============== */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> BACKLOG
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <BacklogRow label="Unlisted Assets" count={status.backlog.unlistedAssets} icon={<Package className="h-3.5 w-3.5" />} />
            <BacklogRow label="Stuck Runs" count={status.backlog.stuckRuns} icon={<AlertTriangle className="h-3.5 w-3.5" />} warn />
            <BacklogRow label="Packs to Publish" count={status.backlog.packsToPublish} icon={<Sparkles className="h-3.5 w-3.5" />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Cpu className="h-4 w-4" /> PROVIDER HEALTH
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ProviderRow label="OpenAI" status={status.providers.openai} icon="🖼️" />
            <ProviderRow label="DeepSeek" status={status.providers.deepseek} icon="📝" />
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground font-mono">Auto-forge</span>
              <Badge variant={status.backlog.stuckRuns > 0 ? "destructive" : "secondary"} className="font-mono text-[10px]">
                {status.isPaused ? "PAUSED" : status.backlog.stuckRuns > 0 ? "STUCK" : "READY"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> BUDGET TRACKER
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-mono">Today</span>
              <span className="font-mono">${status.budget.used.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-mono">Monthly</span>
              <span className="font-mono">${status.budget.used.toFixed(2)} / $10</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-mono">Remaining</span>
              <span className={`font-mono ${budgetPct > 90 ? "text-red-500" : ""}`}>
                ${status.budget.remaining.toFixed(2)}
              </span>
            </div>
            <Progress value={budgetPct} className="mt-1" />
          </CardContent>
        </Card>
      </div>

      {/* ============== LIVE LOG ============== */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Brain className="h-4 w-4" /> EVENT LOG
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 font-mono text-xs leading-relaxed">
            {logs.length === 0 && (
              <p className="text-muted-foreground p-1">Waiting for events... drop a task file to start.</p>
            )}
            {logs.map((l) => (
              <div key={l.id} className="flex gap-2 py-0.5">
                <span className="text-muted-foreground shrink-0">[{l.time}]</span>
                <span className="shrink-0 font-semibold">{l.agent}</span>
                <span className={
                  l.type === "err" ? "text-red-400" :
                  l.type === "warn" ? "text-amber-400" :
                  l.type === "ok" ? "text-emerald-400" :
                  "text-foreground"
                }>{l.msg}</span>
              </div>
            ))}
            <div ref={logsEnd} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: AgentState }) {
  const color =
    status === "working" ? "bg-emerald-500 shadow-[0_0_6px_theme(colors.emerald.500)]" :
    status === "error"   ? "bg-red-500 shadow-[0_0_6px_theme(colors.red.500)]" :
    status === "done"    ? "bg-blue-500" :
                           "bg-muted-foreground/30"

  return (
    <div className={`h-2.5 w-2.5 rounded-full ${color} ${
      status === "working" ? "animate-pulse" : ""
    }`} />
  )
}

function BacklogRow({ label, count, icon, warn }: { label: string; count: number; icon: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground font-mono">
        {icon} {label}
      </span>
      <span className={`font-mono font-bold ${warn && count > 0 ? "text-red-400" : ""}`}>
        {count}
      </span>
    </div>
  )
}

function ProviderRow({ label, status, icon }: { label: string; status: string; icon: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 font-mono">
        <span>{icon}</span>
        <span className="text-muted-foreground">{label}</span>
      </span>
      <span className="flex items-center gap-1.5 font-mono">
        {status === "healthy" ? (
          <Wifi className="h-3 w-3 text-emerald-400" />
        ) : status === "degraded" ? (
          <WifiOff className="h-3 w-3 text-amber-400" />
        ) : (
          <WifiOff className="h-3 w-3 text-red-400" />
        )}
        {status}
      </span>
    </div>
  )
}
