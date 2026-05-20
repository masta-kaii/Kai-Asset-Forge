"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { autonomousTick, type AutonomousStatus } from "@/app/actions/autonomous-agent"
import { getDashboardData } from "@/app/actions/dashboard"
import { pause, resume } from "@/lib/budget/kill-switch"
import { runOrchestrator } from "@/app/actions/orchestrator"
import {
  Play, Pause, Zap, Loader2, Wifi, WifiOff, Clock,
  Cpu, Brain, Activity, TrendingUp, CheckCircle2, XCircle,
  AlertTriangle, Package, Sparkles, Eye, EyeOff, ScrollText,
  Filter, ChevronRight, X, Monitor,
} from "lucide-react"

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const POLL_INTERVAL = 5000
const FRAME_INTERVAL = 200
const SCALE = 3 // sprite pixel scale

interface AgentDef {
  id: string; label: string; role: string; sprite: string
  homeX: number; homeY: number
  floorTile: string  // floor variant for this agent's room
  wallDecor?: string  // wall decoration (banner, etc.)
  prop?: string       // room prop (crate, column, etc.)
  propX?: number; propY?: number // prop position offset
}

const AGENTS: AgentDef[] = [
  { id: "popo",       label: "Popo",    role: "CEO ✦ COMMANDER", sprite: "wizzard_m", homeX: 0, homeY: 1, floorTile: "8", wallDecor: "wall_banner_red", prop: "column" },
  { id: "monitor",    label: "Monitor", role: "Surveillance", sprite: "lizard_m",    homeX: 1, homeY: 0, floorTile: "1", wallDecor: "wall_banner_blue" },
  { id: "scout",      label: "Scout",   role: "Intel",       sprite: "elf_f",       homeX: 2, homeY: 0, floorTile: "2", wallDecor: "wall_banner_green" },
  { id: "forge",      label: "Forge",   role: "Production",  sprite: "dwarf_m",     homeX: 0, homeY: 0, floorTile: "3", prop: "floor_ladder" },
  { id: "deploy",     label: "Deploy",  role: "Shipping",    sprite: "imp",         homeX: 0, homeY: 2, floorTile: "4", prop: "crate" },
  { id: "lister",     label: "Lister",  role: "Sales",       sprite: "elf_m",       homeX: 1, homeY: 2, floorTile: "5", prop: "crate" },
  { id: "packager",   label: "Packager",role: "Assembly",    sprite: "goblin",      homeX: 2, homeY: 2, floorTile: "7", prop: "crate" },
  { id: "orchestrator",label: "Orch",   role: "MANAGER",     sprite: "wizzard_m",   homeX: 1, homeY: 1, floorTile: "8", wallDecor: "wall_banner_red", prop: "column" },
  { id: "curator",    label: "Curator", role: "QA",          sprite: "knight_f",    homeX: 2, homeY: 1, floorTile: "1", prop: "column" },
]

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type AgentStatus = "idle" | "walking" | "working" | "done" | "error"

interface AgentState {
  status: AgentStatus; message: string; gridX: number; gridY: number
  pulse: boolean; frame: number; facing: "right" | "left"
}

interface SimStatus {
  action: string; detail: string
  providers: { openai: string; deepseek: string }
  budget: { used: number; cap: number; remaining: number }
  backlog: { unlistedAssets: number; stuckRuns: number; packsToPublish: number }
  isPaused: boolean
  totalAssets: number; readyPacks: number
}

interface LogEntry {
  id: number; time: string; agent: string; msg: string
  type: "info" | "ok" | "warn" | "err"
}

interface ForgeStep { step: string; status: string; summary: string; time: string }

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
function now(): string { return new Date().toLocaleTimeString("en-US", { hour12: false }) }

const stepAgentMap: Record<string, string> = {
  scout: "scout", curate: "curator", generate: "forge",
  package: "packager", listing: "lister", publish: "deploy",
  orchestrate: "orchestrator", complete: "orchestrator",
  popo: "popo", command: "popo", dispatch: "popo",
}
function stepToAgent(step: string): string | null {
  for (const [k, a] of Object.entries(stepAgentMap))
    if (step.toLowerCase().includes(k)) return a
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// Sprite component
// ═══════════════════════════════════════════════════════════════════════════

function AgentSprite({ agentId, frame, size, facing, className }: {
  agentId: string; frame: number; size: number; facing: "right" | "left"; className?: string
}) {
  const def = AGENTS.find((a) => a.id === agentId)
  if (!def) return null
  const w = size; const h = size * 1.75
  const src = `/sprites/agents/${agentId}/idle_f${frame % 4}.png`
  return (
    <div className={className} style={{ width: w, height: h, transform: facing === "left" ? "scaleX(-1)" : undefined }}>
      <Image src={src} alt={def.label} width={w} height={h} className="pixelated" unoptimized priority />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

const statusVariants: Record<string, { cls: string; icon: typeof CheckCircle2 }> = {
  idle:     { cls: "border-muted-foreground/20 bg-muted/30 text-muted-foreground", icon: Monitor },
  scanning: { cls: "border-blue-500/30 bg-blue-500/10 text-blue-400", icon: Activity },
  forging:  { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", icon: Zap },
  packaging:{ cls: "border-violet-500/30 bg-violet-500/10 text-violet-400", icon: Package },
  publishing:{ cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", icon: TrendingUp },
  blocked:  { cls: "border-red-500/30 bg-red-500/10 text-red-400", icon: AlertTriangle },
  paused:   { cls: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400", icon: Pause },
}

function HUD({ status, uptime, connected, lastPoll, workingAgents, forgeRunning, onForge, onPause }: {
  status: SimStatus; uptime: number; connected: boolean; lastPoll: string
  workingAgents: number; forgeRunning: boolean
  onForge: () => void; onPause: () => void
}) {
  const uptimeStr = `${String(Math.floor(uptime / 3600)).padStart(2, "0")}:${String(Math.floor((uptime % 3600) / 60)).padStart(2, "0")}:${String(uptime % 60).padStart(2, "0")}`
  const sv = statusVariants[status.action] ?? statusVariants.idle
  const Icon = sv.icon

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border bg-card/60 px-4 py-2.5 text-sm" title="System status bar">
      {/* Connection dot */}
      <div className="flex items-center gap-1.5" title={`Last poll: ${lastPoll}`}>
        <div className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 shadow-[0_0_5px_#34d399]" : "bg-red-500 shadow-[0_0_5px_#ef4444]"}`} />
        <span className="text-xs text-muted-foreground font-mono tabular-nums">{connected ? "LIVE" : "STALE"}</span>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Action badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</span>
        <Badge variant="outline" className={`gap-1 font-mono text-xs ${sv.cls}`}>
          <Icon className="h-3 w-3" />
          {status.action.toUpperCase()}
        </Badge>
        <span className="text-xs text-muted-foreground max-w-56 truncate hidden md:inline">{status.detail}</span>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Providers */}
      <div className="flex items-center gap-2" title="AI Provider health">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">API</span>
        <ProviderIndicator label="OpenAI" status={status.providers.openai} />
        <ProviderIndicator label="DeepSeek" status={status.providers.deepseek} />
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Budget */}
      <div className="flex items-center gap-2" title="Monthly budget">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Budget</span>
        <span className="font-mono text-xs tabular-nums">${status.budget.used.toFixed(2)}<span className="text-muted-foreground">/${status.budget.cap}</span></span>
        <BudgetBar used={status.budget.used} cap={status.budget.cap} />
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Stats */}
      <div className="flex items-center gap-3" title="Assets / Packs / Active agents">
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" /><span className="font-mono tabular-nums">{status.totalAssets}</span></span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /><span className="font-mono tabular-nums">{status.readyPacks}</span></span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Cpu className="h-3.5 w-3.5" /><span className="font-mono tabular-nums">{workingAgents}/9</span></span>
      </div>

      <Separator orientation="vertical" className="h-5" />

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Session uptime">
        <Clock className="h-3.5 w-3.5" />
        <span className="font-mono tabular-nums">{uptimeStr}</span>
      </div>

      {/* Controls */}
      <div className="ml-auto flex items-center gap-2">
        {status.isPaused && <Badge variant="destructive" className="animate-pulse text-[10px]">KILLSWITCH</Badge>}
        <Button size="icon-xs" variant="ghost" onClick={onPause} title={status.isPaused ? "Resume forge" : "Pause forge"}>
          {status.isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </Button>
        <Button size="xs" onClick={onForge} disabled={forgeRunning} className="gap-1.5 font-mono text-xs">
          {forgeRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {forgeRunning ? "RUNNING" : "FORGE"}
        </Button>
      </div>
    </div>
  )
}

function ProviderIndicator({ label, status }: { label: string; status: string }) {
  const dot = status === "healthy" ? "bg-emerald-500 shadow-[0_0_5px_#34d399]" :
             status === "degraded" ? "bg-amber-500 shadow-[0_0_5px_#fbbf24]" :
             "bg-red-500 shadow-[0_0_5px_#ef4444]"
  return (
    <div className="flex items-center gap-1" title={`${label}: ${status}`}>
      <div className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function BudgetBar({ used, cap }: { used: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
  return (
    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden" title={`${pct}% used`}>
      <div className={`h-full rounded-full transition-all duration-500 ${
        pct > 90 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500"
      }`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-1 animate-pulse">
      <div className="h-10 rounded-xl bg-muted/50" />
      <div className="h-[420px] rounded-xl bg-muted/30" />
      <div className="h-24 rounded-xl bg-muted/50" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════

export default function WorkstationPage() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [lastPoll, setLastPoll] = useState("")

  const [status, setStatus] = useState<SimStatus>({
    action: "idle", detail: "Initializing...",
    providers: { openai: "unknown", deepseek: "unknown" },
    budget: { used: 0, cap: 10, remaining: 10 },
    backlog: { unlistedAssets: 0, stuckRuns: 0, packsToPublish: 0 },
    isPaused: false, totalAssets: 0, readyPacks: 0,
  })

  const [agents, setAgents] = useState<Record<string, AgentState>>(() => {
    const s: Record<string, AgentState> = {}
    for (const a of AGENTS)
      s[a.id] = { status: "idle", message: "", gridX: a.homeX, gridY: a.homeY, pulse: false, frame: Math.floor(Math.random() * 4), facing: "right" }
    return s
  })

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logFilter, setLogFilter] = useState<string | null>(null)
  const [logPaused, setLogPaused] = useState(false)

  const [forgeRunning, setForgeRunning] = useState(false)
  const [forgeSteps, setForgeSteps] = useState<ForgeStep[]>([])
  const [forgeProgress, setForgeProgress] = useState("")
  const [lastForgeTime, setLastForgeTime] = useState("")
  const [lastForgeStatus, setLastForgeStatus] = useState("")

  const [uptime, setUptime] = useState(0)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  const logsEnd = useRef<HTMLDivElement>(null)
  const logCounter = useRef(0)
  const prevAction = useRef("")
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isVisible = useRef(true)
  const rafRef = useRef<number>(0)
  const lastFrameTime = useRef(0)

  // ── Frame animation (single rAF) ──
  useEffect(() => {
    function tick(ts: number) {
      if (ts - lastFrameTime.current > FRAME_INTERVAL) {
        lastFrameTime.current = ts
        setAgents((prev) => {
          let changed = false
          const next = { ...prev }
          for (const id of Object.keys(next)) {
            next[id] = { ...next[id], frame: (next[id].frame + 1) % 4 }
            changed = true
          }
          return changed ? next : prev
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Logging ──
  const addLog = useCallback((agent: string, msg: string, type: LogEntry["type"] = "info") => {
    if (logPaused) return
    const id = ++logCounter.current
    const time = now().slice(0, 8)
    setLogs((p) => [...p.slice(-80), { id, time, agent, msg, type }])
  }, [logPaused])

  // ── Uptime ──
  useEffect(() => {
    const i = setInterval(() => setUptime((u) => u + 1), 1000)
    return () => clearInterval(i)
  }, [])

  // ── Tab visibility ──
  useEffect(() => {
    function handle() {
      isVisible.current = document.visibilityState === "visible"
      if (isVisible.current) poll()
    }
    document.addEventListener("visibilitychange", handle)
    return () => document.removeEventListener("visibilitychange", handle)
  }, [])

  // ── Poll ──
  const poll = useCallback(async () => {
    try {
      const [tick, dash] = await Promise.all([autonomousTick(), getDashboardData()])
      setConnected(true)
      setLastPoll(now())
      if (loading) setLoading(false)

      setStatus({
        action: tick.action, detail: tick.detail,
        providers: tick.providers, budget: tick.budget, backlog: tick.backlog,
        isPaused: dash.isPaused, totalAssets: dash.totalAssets, readyPacks: dash.readyPacks,
      })

      const action = tick.action
      const detail = tick.detail
      const updates: Record<string, Partial<AgentState>> = {}

      for (const a of AGENTS) {
        let st: AgentStatus = "idle"; let msg = ""

        switch (a.id) {
          case "popo":
            st = action === "idle" ? "idle" : "working"
            msg = action === "idle" ? "Monitoring..." : `Commanding: ${action}`
            break
          case "orchestrator":
            if (action !== "idle") { st = "working"; msg = detail }
            break
          case "scout":
            if (action === "scanning") { st = "working"; msg = "Scanning markets" }
            else if (action === "forging") { st = "done"; msg = "Intel ready" }
            break
          case "forge":
            if (action === "forging") { st = "working"; msg = "Forging" }
            break
          case "curator":
            if (action === "forging") { st = "working"; msg = "Scoring" }
            break
          case "packager":
            if (action === "packaging") { st = "working"; msg = "Bundling" }
            break
          case "lister":
            if (action === "packaging" || action === "publishing") { st = "working"; msg = "Listing" }
            break
          case "deploy":
            if (action === "publishing") { st = "working"; msg = "Uploading" }
            break
          case "monitor":
            st = "working"
            msg = `${tick.backlog.unlistedAssets + tick.backlog.packsToPublish} pending`
            break
        }

        updates[a.id] = {
          status: st, message: msg,
          gridX: a.homeX, gridY: a.homeY,
          pulse: st === "working",
        }
      }

      setAgents((prev) => {
        const next = { ...prev }
        for (const [id, u] of Object.entries(updates)) next[id] = { ...next[id], ...u }
        return next
      })

      if (action !== prevAction.current && action !== "idle")
        addLog("system", detail, action === "blocked" ? "warn" : "info")
      prevAction.current = action
    } catch {
      setConnected(false)
    }

    if (pollTimer.current) clearTimeout(pollTimer.current)
    pollTimer.current = setTimeout(poll, POLL_INTERVAL)
  }, [loading, addLog])

  useEffect(() => { poll(); return () => { if (pollTimer.current) clearTimeout(pollTimer.current) } }, [poll])

  // ── Forge ──
  async function handleForge() {
    setForgeRunning(true); setForgeSteps([]); setForgeProgress("Assembling team...")
    addLog("orchestrator", "Dispatching pipeline...", "info")
    await sleep(300)

    try {
      const result = await runOrchestrator({ theme: "fantasy creatures", maxAssets: 2 })
      const steps = result.steps ?? []
      const completedSteps: ForgeStep[] = []

      if (steps.length > 0) {
        for (const step of steps) {
          const fs: ForgeStep = { step: step.step, status: step.status, summary: step.summary ?? "", time: now() }
          completedSteps.push(fs)
          setForgeSteps([...completedSteps])

          const agentId = stepToAgent(step.step)
          const icon = step.status === "completed" ? "✓" : step.status === "failed" ? "✗" : "..."
          setForgeProgress(`${icon} ${step.step}`)

          if (agentId) {
            setAgents((prev) => ({
              ...prev,
              [agentId]: {
                ...prev[agentId],
                status: step.status === "completed" ? "done" : step.status === "failed" ? "error" : "working",
                message: `${icon} ${step.summary ?? step.step}`,
                pulse: step.status === "running",
                facing: Math.random() > 0.5 ? "left" : "right",
              },
            }))
            addLog(agentId, step.summary ?? step.step, step.status === "failed" ? "err" : "ok")
          }
          await sleep(700)
        }
        setForgeSteps(completedSteps)
      }

      const t = now()
      setLastForgeTime(t)
      if (result.error) {
        setForgeProgress(`Failed: ${result.error}`); setLastForgeStatus("failed")
        addLog("orchestrator", result.error, "err")
      } else if (result.status === "completed") {
        setForgeProgress("Pipeline complete!"); setLastForgeStatus("completed")
        addLog("orchestrator", "All done!", "ok")
      } else if (result.status === "paused_provider") {
        setForgeProgress("Provider limit — top up"); setLastForgeStatus("paused")
        addLog("orchestrator", `Paused: ${result.error ?? "limit"}`, "warn")
      } else {
        setForgeProgress(`Status: ${result.status}`); setLastForgeStatus(result.status)
      }
    } catch (e: unknown) {
      setForgeProgress("Error"); setLastForgeStatus("error"); setLastForgeTime(now())
      addLog("orchestrator", (e as Error).message ?? "Unknown", "err")
    } finally {
      setForgeRunning(false)
      // Reset agent states after delay
      setTimeout(() => {
        setAgents((prev) => {
          const next = { ...prev }
          for (const a of AGENTS) next[a.id] = { ...next[a.id], status: "idle", message: "", pulse: false }
          return next
        })
      }, 1500)
    }
  }

  // ── Killswitch ──
  async function handlePause() {
    if (status.isPaused) { await resume(); addLog("system", "Killswitch released", "ok") }
    else { await pause(); addLog("system", "Forge paused", "warn") }
    const dash = await getDashboardData()
    setStatus((s) => ({ ...s, isPaused: dash.isPaused }))
  }

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key.toLowerCase()) {
        case "f": if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); handleForge(); } break
        case "k": if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); handlePause(); } break
        case "escape": setSelectedAgent(null); break
        default:
          if (e.key >= "1" && e.key <= "9") {
            const idx = parseInt(e.key) - 1
            if (idx < AGENTS.length) setSelectedAgent(AGENTS[idx].id)
          }
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [status.isPaused, forgeRunning])

  // ── Auto-scroll log (unless paused) ──
  useEffect(() => {
    if (!logPaused) logsEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs, logPaused])

  // ── Derived ──
  const workingAgents = Object.values(agents).filter((a) => a.status === "working" || a.status === "walking").length
  const filteredLogs = logFilter ? logs.filter((l) => l.agent === logFilter) : logs
  const selectedAgentDef = selectedAgent ? AGENTS.find((a) => a.id === selectedAgent) : null
  const selectedAgentState = selectedAgent ? agents[selectedAgent] : null

  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-4 p-1" onKeyDown={(e) => { if (e.key === "Escape") setSelectedAgent(null) }}>
      {/* ═══════ PAGE HEADER ═══════ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Sim Workstation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time agent fleet monitor with live dungeon floor view
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-[10px]">F</span> Forge
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-[10px]">K</span> Killswitch
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-[10px]">1-9</span> Focus
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-[10px]">Esc</span> Close
          </span>
        </div>
      </div>

      <Separator />

      {/* ═══════ HUD ═══════ */}
      <HUD
        status={status} uptime={uptime} connected={connected} lastPoll={lastPoll}
        workingAgents={workingAgents} forgeRunning={forgeRunning}
        onForge={handleForge} onPause={handlePause}
      />

      {/* ═══════ DUNGEON FLOOR ═══════ */}
      <div className="relative rounded-xl border bg-card overflow-hidden select-none" style={{ minHeight: 420 }}>
        {/* Torchlit ambient glow */}
        <div className="pointer-events-none absolute inset-0 z-20" style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(255,180,40,0.06) 0%, transparent 60%), radial-gradient(ellipse at 25% 25%, rgba(255,140,40,0.03) 0%, transparent 50%), radial-gradient(ellipse at 75% 75%, rgba(255,140,40,0.03) 0%, transparent 50%)",
        }} />

        {/* Top label */}
        <div className="absolute top-2 left-3 z-20 font-mono text-[10px] text-muted-foreground/50 tracking-widest uppercase">
          Kai Asset Forge · Dungeon Floor
        </div>

        {/* Grid */}
        <div className="grid gap-1 p-2" style={{
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(3, 1fr)",
          minHeight: 380,
        }}>
          {AGENTS.map((agent) => {
            const st = agents[agent.id]
            if (!st) return null
            const isOrch = agent.id === "orchestrator"
            const isPopo = agent.id === "popo"
            const isWorking = st.status === "working" || st.status === "walking"
            const isSelected = selectedAgent === agent.id

            return (
              <div
                key={agent.id}
                className="relative cursor-pointer group"
                style={{ gridColumn: agent.homeX + 1, gridRow: agent.homeY + 1 }}
                onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
                title={`${agent.label} — ${agent.role} (${st.status})`}
              >
                {/* Room container */}
                <div className={`relative w-full h-full flex flex-col items-center justify-center border-2 transition-all duration-300 ${
                  isSelected ? "border-primary/60 ring-2 ring-primary/20" :
                  isPopo ? "border-yellow-500/60 bg-yellow-950/20 ring-1 ring-yellow-500/30" :
                  isOrch ? "border-amber-700/40 bg-amber-950/15" :
                  isWorking ? "border-amber-600/30 bg-stone-900/40" :
                  "border-stone-700/30 bg-stone-900/20 hover:border-stone-600/40"
                }`}>
                  {/* Wall top border (using wall tiles) */}
                  <WallBorderTop />

                  {/* Floor tile background */}
                  <div className="absolute inset-0 opacity-40" style={{
                    backgroundImage: `url(/sprites/tiles/floor_${agent.floorTile}.png)`,
                    backgroundSize: "32px 32px",
                    imageRendering: "pixelated",
                    backgroundRepeat: "repeat",
                  }} />

                  {/* Wall decoration */}
                  {agent.wallDecor && (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 z-5 opacity-50" style={{ width: 16 * SCALE, height: 16 * SCALE }}>
                      <Image src={`/sprites/tiles/${agent.wallDecor}.png`} alt="" width={16 * SCALE} height={16 * SCALE} className="pixelated" unoptimized />
                    </div>
                  )}

                  {/* Room prop */}
                  {agent.prop && (
                    <div className="absolute z-5 opacity-40" style={{
                      [agent.prop === "column" ? "right" : "left"]: 8,
                      bottom: 6,
                      width: 16 * SCALE,
                      height: 16 * SCALE,
                    }}>
                      <Image src={`/sprites/tiles/${agent.prop}.png`} alt="" width={16 * SCALE} height={16 * SCALE} className="pixelated" unoptimized />
                    </div>
                  )}

                  {/* Speech bubble */}
                  {st.message && (isWorking || st.status === "done" || st.status === "error") && (
                    <div className="absolute -top-6 z-30 animate-bounce-in max-w-[85%]">
                      <div className={`relative px-2 py-0.5 rounded border text-center bg-background/95 backdrop-blur ${
                        st.status === "error" ? "border-red-500/30" : "border-primary/20"
                      }`}>
                        <p className={`font-mono text-[10px] leading-tight ${
                          st.status === "error" ? "text-red-400" : "text-foreground"
                        }`}>{st.message}</p>
                        <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-background/95 backdrop-blur border-r border-b ${
                          st.status === "error" ? "border-red-500/30" : "border-primary/20"
                        }`} />
                      </div>
                    </div>
                  )}

                  {/* Agent sprite */}
                  <div className={`relative z-10 transition-transform duration-700 ${
                    isWorking ? "animate-bob" : ""
                  } ${st.status === "error" ? "animate-shake" : ""}`}>
                    <AgentSprite
                      agentId={agent.id}
                      frame={st.frame}
                      size={isPopo ? 56 : isOrch ? 48 : 40}
                      facing={st.facing}
                      className={`transition-all duration-500 ${
                        st.pulse ? "drop-shadow-[0_0_14px_rgba(255,200,50,0.7)]" : isPopo ? "drop-shadow-[0_0_10px_rgba(255,215,0,0.4)]" : "drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                      }`}
                    />
                    {st.pulse && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2/3 h-1.5 rounded-full bg-amber-400/30 blur-sm animate-pulse" />
                    )}
                  </div>

                  {/* Nameplate */}
                  <div className={`absolute bottom-2 px-2 py-0.5 rounded border text-center z-10 transition-colors ${
                    isPopo ? "border-yellow-500/60 bg-black/90" :
                    isOrch ? "border-amber-700/50 bg-black/80" : "border-stone-700/30 bg-black/70"
                  }`}>
                    <p className={`font-mono text-[10px] leading-none ${
                      isPopo ? "text-yellow-400 font-bold tracking-wider" :
                      isOrch ? "text-amber-300 font-bold" : "text-stone-200"
                    }`}>{agent.label}</p>
                    <p className="font-mono text-[9px] leading-none text-muted-foreground/50">{agent.role}</p>
                  </div>

                  {/* Status indicator */}
                  <div className="absolute top-1.5 right-1.5">
                    <div className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      st.status === "working" ? "bg-emerald-500 shadow-[0_0_6px_#34d399]" :
                      st.status === "done" ? "bg-blue-400" :
                      st.status === "error" ? "bg-red-500 shadow-[0_0_6px_#ef4444]" :
                      "bg-muted-foreground/20"
                    } ${st.pulse ? "animate-pulse" : ""}`} />
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-primary border border-primary/50" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Corridor lines */}
        <svg className="absolute inset-0 z-0 w-full h-full pointer-events-none" viewBox="0 0 300 300" preserveAspectRatio="none">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <line x1="0" y1="150" x2="300" y2="150" stroke="rgba(217,168,65,0.3)" strokeWidth="2" strokeDasharray="6,8" filter="url(#glow)" />
          <line x1="150" y1="0" x2="150" y2="300" stroke="rgba(217,168,65,0.3)" strokeWidth="2" strokeDasharray="6,8" filter="url(#glow)" />
          <rect x="105" y="105" width="90" height="90" fill="none" stroke="rgba(255,200,50,0.15)" strokeWidth="1.5" strokeDasharray="4,8" filter="url(#glow)" />
        </svg>

        {/* Map legend */}
        <div className="absolute bottom-2 right-3 z-20 font-mono text-[9px] text-muted-foreground/30">
          ─ path  ━ command center
        </div>
      </div>

      {/* ═══════ FORGE PROGRESS ═══════ */}
      {(forgeRunning || forgeSteps.length > 0 || lastForgeTime) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {forgeRunning ? "FORGE IN PROGRESS" : "LAST FORGE"}
              {lastForgeTime && !forgeRunning && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  {lastForgeTime} —{" "}
                  <span className={lastForgeStatus === "completed" ? "text-emerald-400" : lastForgeStatus === "failed" ? "text-red-400" : "text-amber-400"}>
                    {lastForgeStatus}
                  </span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {forgeRunning && !forgeSteps.length && (
                <span className="font-mono text-sm text-muted-foreground animate-pulse">{forgeProgress}</span>
              )}
              {forgeSteps.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono transition-all ${
                    s.status === "completed" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" :
                    s.status === "failed" ? "border-red-500/30 bg-red-500/5 text-red-400" :
                    "border-muted-foreground/20 text-muted-foreground"
                  }`}
                >
                  {s.status === "completed" ? <CheckCircle2 className="h-3 w-3" /> :
                   s.status === "failed" ? <XCircle className="h-3 w-3" /> :
                   <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{s.step}</span>
                  {s.time && <span className="text-[10px] text-muted-foreground/50 ml-1">{s.time.slice(0, 5)}</span>}
                </div>
              ))}
              {forgeSteps.length > 0 && !forgeRunning && forgeProgress && (
                <Badge variant={forgeProgress.includes("complete") ? "default" : forgeProgress.includes("Failed") ? "destructive" : "secondary"}>
                  {forgeProgress}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════ AGENT DETAIL PANEL ═══════ */}
      {selectedAgent && selectedAgentDef && selectedAgentState && (
        <Card className="border-primary/30 animate-bounce-in">
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div className="flex items-center gap-3">
              <AgentSprite agentId={selectedAgent} frame={selectedAgentState.frame} size={32} facing="right" />
              <div>
                <CardTitle className="text-base">{selectedAgentDef.label}</CardTitle>
                <CardDescription className="text-xs">{selectedAgentDef.role} · Sprite: {selectedAgentDef.sprite}</CardDescription>
              </div>
            </div>
            <Button size="icon-xs" variant="ghost" onClick={() => setSelectedAgent(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pb-3 grid grid-cols-3 gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={selectedAgentState.status === "working" ? "default" : selectedAgentState.status === "error" ? "destructive" : "secondary"}>
                {selectedAgentState.status.toUpperCase()}
              </Badge>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground">Position</span>
              <span className="font-mono">({selectedAgentState.gridX}, {selectedAgentState.gridY})</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground">Facing</span>
              <span className="font-mono">{selectedAgentState.facing}</span>
            </div>
            {selectedAgentState.message && (
              <div className="col-span-3 space-y-0.5">
                <span className="text-muted-foreground">Last message</span>
                <p className="font-mono text-muted-foreground">{selectedAgentState.message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════ COMMS LOG ═══════ */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Activity Log
            {logFilter && (
              <Badge variant="secondary" className="gap-1 font-normal">
                {logFilter}
                <button onClick={() => setLogFilter(null)} className="hover:text-foreground"><X className="h-3 w-3" /></button>
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="icon-xs" variant="ghost" onClick={() => setLogPaused(!logPaused)} title={logPaused ? "Resume scroll" : "Pause scroll"}>
              {logPaused ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={() => { setLogs([]); setLogFilter(null) }} title="Clear log">
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-32">
            <div className="p-3 font-mono text-[11px] leading-relaxed">
              {filteredLogs.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  {logs.length === 0 ? "No events yet. Press FORGE or drop a task file to begin." : "No matching events."}
                </p>
              )}
              {filteredLogs.map((l) => (
                <div key={l.id} className="flex gap-2 py-0.5 hover:bg-muted/30 rounded-sm px-1 -mx-1">
                  <span className="text-muted-foreground/50 shrink-0 text-[10px]">{l.time}</span>
                  <button
                    className="shrink-0 font-semibold hover:underline cursor-pointer text-[11px]"
                    onClick={() => setLogFilter(logFilter === l.agent ? null : l.agent)}
                    style={{ color: logTypeColor(l.type) }}
                  >
                    {l.agent}
                  </button>
                  <span className={
                    l.type === "err" ? "text-red-400" :
                    l.type === "warn" ? "text-amber-400" :
                    l.type === "ok" ? "text-emerald-400" :
                    "text-foreground/80"
                  }>{l.msg}</span>
                </div>
              ))}
              <div ref={logsEnd} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ═══════ ANIMATIONS ═══════ */}
      <style jsx>{`
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
        @keyframes bounce-in { 0% { transform: translateY(6px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .animate-bob { animation: bob 1s ease-in-out infinite; }
        .animate-shake { animation: shake 0.3s ease-in-out infinite; }
        .animate-bounce-in { animation: bounce-in 0.3s ease-out; }
        :global(.pixelated) { image-rendering: pixelated; image-rendering: crisp-edges; }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Wall top border (repeated wall tile)
// ═══════════════════════════════════════════════════════════════════════════

function WallBorderTop() {
  return (
    <div className="absolute top-0 left-0 right-0 z-5 flex" style={{ height: 8 * SCALE }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex-1" style={{
          backgroundImage: "url(/sprites/tiles/wall_top_mid.png)",
          backgroundSize: "cover",
          imageRendering: "pixelated",
        }} />
      ))}
    </div>
  )
}

function logTypeColor(type: string) {
  switch (type) {
    case "ok": return "#34d399"
    case "warn": return "#fbbf24"
    case "err": return "#f87171"
    default: return "#a1a1aa"
  }
}
