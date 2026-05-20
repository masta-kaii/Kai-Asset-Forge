"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { autonomousTick, type AutonomousStatus } from "@/app/actions/autonomous-agent"
import { getDashboardData } from "@/app/actions/dashboard"
import { pause, resume } from "@/lib/budget/kill-switch"
import { runOrchestrator } from "@/app/actions/orchestrator"
import {
  Play, Pause, Zap, Loader2, Wifi, WifiOff, Clock,
  Cpu, Brain, Activity, TrendingUp, CheckCircle2, XCircle,
  AlertTriangle, Package, Sparkles, ScrollText,
  X, Monitor, MessageSquare, ChevronRight,
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
  floorTile: string
  wallDecor?: string
  prop?: string
  propX?: number; propY?: number
}

const AGENTS: AgentDef[] = [
  { id: "popo",       label: "Popo",    role: "CEO ✦ CMD", sprite: "wizzard_m", homeX: 0, homeY: 1, floorTile: "8", wallDecor: "wall_banner_red", prop: "column" },
  { id: "monitor",    label: "Monitor", role: "Surveil",    sprite: "lizard_m",  homeX: 1, homeY: 0, floorTile: "1", wallDecor: "wall_banner_blue" },
  { id: "scout",      label: "Scout",   role: "Intel",      sprite: "elf_f",     homeX: 2, homeY: 0, floorTile: "2", wallDecor: "wall_banner_green" },
  { id: "forge",      label: "Forge",   role: "Prod",       sprite: "dwarf_m",   homeX: 0, homeY: 0, floorTile: "3", prop: "floor_ladder" },
  { id: "deploy",     label: "Deploy",  role: "Ship",       sprite: "imp",       homeX: 0, homeY: 2, floorTile: "4", prop: "crate" },
  { id: "lister",     label: "Lister",  role: "Sales",      sprite: "elf_m",     homeX: 1, homeY: 2, floorTile: "5", prop: "crate" },
  { id: "packager",   label: "Packager",role: "Assembly",   sprite: "goblin",    homeX: 2, homeY: 2, floorTile: "7", prop: "crate" },
  { id: "orchestrator",label:"Orch",    role: "MGR",        sprite: "wizzard_m", homeX: 1, homeY: 1, floorTile: "8", wallDecor: "wall_banner_red", prop: "column" },
  { id: "curator",    label: "Curator", role: "QA",         sprite: "knight_f",  homeX: 2, homeY: 1, floorTile: "1", prop: "column" },
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
// Popup Window Component (Sim-style game window)
// ═══════════════════════════════════════════════════════════════════════════

function GameWindow({ title, icon, onClose, children, className }: {
  title: string; icon?: React.ReactNode; onClose: () => void
  children: React.ReactNode; className?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
         onClick={onClose}>
      <div className={`animate-bounce-in rounded-lg border-2 border-yellow-600/60 bg-stone-900/95 shadow-[0_0_30px_rgba(255,200,50,0.15)] max-w-lg w-[90vw] max-h-[80vh] flex flex-col ${className ?? ""}`}
           onClick={(e) => e.stopPropagation()}>
        {/* Window title bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-600/30 bg-stone-800/80 rounded-t-lg">
          <div className="flex items-center gap-2 text-sm font-mono text-yellow-300">
            {icon}
            <span>{title}</span>
          </div>
          <button onClick={onClose}
            className="p-1 rounded hover:bg-red-900/50 text-stone-400 hover:text-red-400 transition-colors">
            <X className="size-4" />
          </button>
        </div>
        {/* Window body */}
        <div className="p-3 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Status helpers
// ═══════════════════════════════════════════════════════════════════════════

const statusVariants: Record<string, { cls: string; icon: typeof CheckCircle2 }> = {
  idle:     { cls: "border-stone-600/30 bg-stone-800/30 text-stone-400", icon: Monitor },
  scanning: { cls: "border-blue-500/30 bg-blue-950/30 text-blue-400", icon: Activity },
  forging:  { cls: "border-amber-500/30 bg-amber-950/30 text-amber-400", icon: Zap },
  packaging:{ cls: "border-violet-500/30 bg-violet-950/30 text-violet-400", icon: Package },
  publishing:{cls: "border-emerald-500/30 bg-emerald-950/30 text-emerald-400", icon: TrendingUp },
  blocked:  { cls: "border-red-500/30 bg-red-950/30 text-red-400", icon: AlertTriangle },
  paused:   { cls: "border-yellow-500/30 bg-yellow-950/30 text-yellow-400", icon: Pause },
}

function logTypeColor(type: string) {
  switch (type) {
    case "ok": return "#34d399"
    case "warn": return "#fbbf24"
    case "err": return "#f87171"
    default: return "#a1a1aa"
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Wall top border
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

// ═══════════════════════════════════════════════════════════════════════════
// Main Page — SIM STYLE
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
  const [forgeRunning, setForgeRunning] = useState(false)
  const [forgeSteps, setForgeSteps] = useState<ForgeStep[]>([])
  const [forgeProgress, setForgeProgress] = useState("")
  const [lastForgeTime, setLastForgeTime] = useState("")
  const [lastForgeStatus, setLastForgeStatus] = useState("")
  const [uptime, setUptime] = useState(0)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [showForgeModal, setShowForgeModal] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)

  const logsEnd = useRef<HTMLDivElement>(null)
  const logCounter = useRef(0)
  const prevAction = useRef("")
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    const id = ++logCounter.current
    const time = now().slice(0, 8)
    setLogs((p) => [...p.slice(-80), { id, time, agent, msg, type }])
  }, [])

  // ── Uptime ──
  useEffect(() => {
    const i = setInterval(() => setUptime((u) => u + 1), 1000)
    return () => clearInterval(i)
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
    setShowForgeModal(true)
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
        case "escape": setSelectedAgent(null); setShowForgeModal(false); setShowLogModal(false); break
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

  // ── Derived ──
  const workingAgents = Object.values(agents).filter((a) => a.status === "working" || a.status === "walking").length
  const selectedAgentDef = selectedAgent ? AGENTS.find((a) => a.id === selectedAgent) : null
  const selectedAgentState = selectedAgent ? agents[selectedAgent] : null

  const uptimeStr = `${String(Math.floor(uptime / 3600)).padStart(2, "0")}:${String(Math.floor((uptime % 3600) / 60)).padStart(2, "0")}:${String(uptime % 60).padStart(2, "0")}`

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-stone-950">
        <div className="space-y-4 text-center">
          <div className="text-4xl animate-pulse">🏭</div>
          <p className="font-mono text-sm text-yellow-600/60">STARTING FACTORY...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-stone-950 flex flex-col">
      {/* ═══════ SIM-STYLE HUD BAR ═══════ */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-1.5 bg-stone-900/95 border-b border-yellow-900/30 font-mono text-[11px] z-30 relative">
        {/* Connection */}
        <div className="flex items-center gap-1.5" title={`Last poll: ${lastPoll}`}>
          <div className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 shadow-[0_0_6px_#34d399] animate-pulse" : "bg-red-500 shadow-[0_0_6px_#ef4444]"}`} />
          <span className={`${connected ? "text-emerald-400" : "text-red-400"}`}>{connected ? "LIVE" : "STALE"}</span>
        </div>

        <div className="w-px h-4 bg-yellow-900/40" />

        {/* Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-stone-500 uppercase tracking-wider text-[9px]">Status</span>
          <Badge variant="outline" className={`gap-1 font-mono text-[10px] h-5 ${statusVariants[status.action]?.cls ?? statusVariants.idle.cls}`}>
            {(() => {
              const Icon = statusVariants[status.action]?.icon ?? Monitor
              return <Icon className="h-2.5 w-2.5" />
            })()}
            {status.action.toUpperCase()}
          </Badge>
        </div>

        <div className="w-px h-4 bg-yellow-900/40" />

        {/* Providers */}
        <div className="flex items-center gap-2">
          <span className="text-stone-500 uppercase tracking-wider text-[9px]">API</span>
          <div className="flex items-center gap-1">
            <div className={`h-1.5 w-1.5 rounded-full ${status.providers.openai === "healthy" ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="text-stone-400 text-[10px]">OAI</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`h-1.5 w-1.5 rounded-full ${status.providers.deepseek === "healthy" ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="text-stone-400 text-[10px]">DS</span>
          </div>
        </div>

        <div className="w-px h-4 bg-yellow-900/40" />

        {/* Budget */}
        <div className="flex items-center gap-1.5">
          <span className="text-stone-500 uppercase tracking-wider text-[9px]">$</span>
          <span className="font-mono text-stone-300 text-[10px]">${status.budget.used.toFixed(2)}<span className="text-stone-600">/${status.budget.cap}</span></span>
          <div className="w-12 h-1.5 rounded-full bg-stone-800 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${
              (status.budget.used / status.budget.cap) > 0.9 ? "bg-red-500" :
              (status.budget.used / status.budget.cap) > 0.6 ? "bg-amber-500" : "bg-emerald-500"
            }`} style={{ width: `${Math.min(100, (status.budget.used / status.budget.cap) * 100)}%` }} />
          </div>
        </div>

        <div className="w-px h-4 bg-yellow-900/40" />

        {/* Stats */}
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-stone-400 text-[10px]">
            <Package className="h-3 w-3 text-stone-500" />
            <span className="font-mono tabular-nums">{status.totalAssets}</span>
          </span>
          <span className="flex items-center gap-1 text-stone-400 text-[10px]">
            <Sparkles className="h-3 w-3 text-stone-500" />
            <span className="font-mono tabular-nums">{status.readyPacks}</span>
          </span>
          <span className="flex items-center gap-1 text-stone-400 text-[10px]">
            <Cpu className="h-3 w-3 text-stone-500" />
            <span className="font-mono tabular-nums">{workingAgents}/9</span>
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Uptime */}
        <div className="flex items-center gap-1 text-stone-500 text-[10px]">
          <Clock className="h-3 w-3" />
          <span className="font-mono tabular-nums">{uptimeStr}</span>
        </div>

        {/* Log button */}
        <button onClick={() => setShowLogModal(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded border border-stone-700/50 hover:border-yellow-700/30 text-stone-400 hover:text-yellow-400 transition-colors text-[10px]">
          <ScrollText className="h-3 w-3" />
          LOG
        </button>

        {/* Killswitch */}
        <button onClick={handlePause}
          className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors text-[10px] ${
            status.isPaused
              ? "border-red-700/50 bg-red-950/30 text-red-400 hover:bg-red-950/50"
              : "border-stone-700/50 text-stone-400 hover:border-yellow-700/30 hover:text-yellow-400"
          }`}>
          {status.isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {status.isPaused ? "RESUME" : "PAUSE"}
        </button>
      </div>

      {/* ═══════ DUNGEON FLOOR — FULL SCREEN ═══════ */}
      <div className="flex-1 relative overflow-hidden">
        {/* Torchlit ambient glow */}
        <div className="pointer-events-none absolute inset-0 z-10" style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(255,180,40,0.06) 0%, transparent 60%), radial-gradient(ellipse at 25% 25%, rgba(255,140,40,0.03) 0%, transparent 50%), radial-gradient(ellipse at 75% 75%, rgba(255,140,40,0.03) 0%, transparent 50%)",
        }} />

        {/* Factory name watermark */}
        <div className="absolute top-3 left-4 z-20 font-mono text-[10px] text-yellow-700/30 tracking-[0.2em] uppercase pointer-events-none">
          Kai Asset Forge · Factory Floor
        </div>

        {/* Grid — fills the entire space */}
        <div className="absolute inset-0 p-2 sm:p-4">
          <div className="grid gap-1 sm:gap-2 w-full h-full" style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(3, 1fr)",
          }}>
            {AGENTS.map((agent) => {
              const st = agents[agent.id]
              if (!st) return null
              const isPopo = agent.id === "popo"
              const isOrch = agent.id === "orchestrator"
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
                    {/* Wall top border */}
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
                        <div className={`relative px-2 py-0.5 rounded border text-center bg-stone-900/95 backdrop-blur ${
                          st.status === "error" ? "border-red-500/30" : "border-yellow-700/30"
                        }`}>
                          <p className={`font-mono text-[10px] leading-tight ${
                            st.status === "error" ? "text-red-400" : "text-stone-200"
                          }`}>{st.message}</p>
                          <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-stone-900/95 backdrop-blur border-r border-b ${
                            st.status === "error" ? "border-red-500/30" : "border-yellow-700/30"
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
                      <p className="font-mono text-[9px] leading-none text-stone-600">{agent.role}</p>
                    </div>

                    {/* Status indicator */}
                    <div className="absolute top-1.5 right-1.5">
                      <div className={`h-2.5 w-2.5 rounded-full transition-colors ${
                        st.status === "working" ? "bg-emerald-500 shadow-[0_0_6px_#34d399]" :
                        st.status === "done" ? "bg-blue-400" :
                        st.status === "error" ? "bg-red-500 shadow-[0_0_6px_#ef4444]" :
                        "bg-stone-700"
                      } ${st.pulse ? "animate-pulse" : ""}`} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Corridor SVG overlay */}
        <svg className="absolute inset-0 z-5 w-full h-full pointer-events-none" viewBox="0 0 300 300" preserveAspectRatio="none">
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

        {/* ═══════ FLOATING FORGE BUTTON ═══════ */}
        <button
          onClick={handleForge}
          disabled={forgeRunning}
          className={`absolute bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3 rounded-xl font-mono text-sm font-bold transition-all duration-300 shadow-[0_0_20px_rgba(255,200,50,0.2)] hover:shadow-[0_0_30px_rgba(255,200,50,0.4)] ${
            forgeRunning
              ? "bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700"
              : "bg-gradient-to-b from-amber-600 to-amber-800 text-yellow-200 border border-yellow-500/40 hover:from-amber-500 hover:to-amber-700 active:scale-95"
          }`}
          title="FORGE (F)"
        >
          {forgeRunning ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Zap className="h-5 w-5" />
          )}
          {forgeRunning ? "FORGING..." : "FORGE!"}
        </button>

        {/* ═══════ KEYBOARD HINT ═══════ */}
        <div className="absolute bottom-6 left-6 z-20 flex gap-3 text-[9px] font-mono text-stone-600">
          <span><span className="text-stone-500">F</span> Forge</span>
          <span><span className="text-stone-500">K</span> Kill</span>
          <span><span className="text-stone-500">1-9</span> Focus</span>
          <span><span className="text-stone-500">Esc</span> Close</span>
        </div>
      </div>

      {/* ═══════ POPUP: AGENT DETAIL ═══════ */}
      {selectedAgent && selectedAgentDef && selectedAgentState && (
        <GameWindow
          title={`${selectedAgentDef.label} · ${selectedAgentDef.role}`}
          icon={<Activity className="h-4 w-4" />}
          onClose={() => setSelectedAgent(null)}
        >
          <div className="space-y-4">
            {/* Agent sprite preview */}
            <div className="flex justify-center py-2">
              <div className="bg-stone-800/80 rounded-lg border border-stone-700/50 p-4">
                <AgentSprite
                  agentId={selectedAgent}
                  frame={selectedAgentState.frame}
                  size={80}
                  facing={selectedAgentState.facing}
                  className={selectedAgentState.pulse ? "drop-shadow-[0_0_14px_rgba(255,200,50,0.5)]" : ""}
                />
              </div>
            </div>

            {/* Status grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-stone-800/60 rounded-lg p-3 border border-stone-700/30">
                <p className="text-stone-500 text-[10px] uppercase tracking-wider mb-1">Status</p>
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] ${
                  selectedAgentState.status === "working" ? "border-emerald-500/30 text-emerald-400" :
                  selectedAgentState.status === "error" ? "border-red-500/30 text-red-400" :
                  selectedAgentState.status === "done" ? "border-blue-500/30 text-blue-400" :
                  "border-stone-600/30 text-stone-400"
                }`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${
                    selectedAgentState.status === "working" ? "bg-emerald-500" :
                    selectedAgentState.status === "error" ? "bg-red-500" :
                    selectedAgentState.status === "done" ? "bg-blue-400" : "bg-stone-600"
                  } ${selectedAgentState.pulse ? "animate-pulse" : ""}`} />
                  {selectedAgentState.status.toUpperCase()}
                </div>
              </div>

              <div className="bg-stone-800/60 rounded-lg p-3 border border-stone-700/30">
                <p className="text-stone-500 text-[10px] uppercase tracking-wider mb-1">Position</p>
                <p className="text-stone-300 font-mono text-[11px]">
                  ({selectedAgentState.gridX}, {selectedAgentState.gridY})
                </p>
              </div>
            </div>

            {selectedAgentState.message && (
              <div className="bg-stone-800/60 rounded-lg p-3 border border-stone-700/30">
                <p className="text-stone-500 text-[10px] uppercase tracking-wider mb-1">Last Report</p>
                <p className="text-stone-300 text-xs leading-relaxed">{selectedAgentState.message}</p>
              </div>
            )}
          </div>
        </GameWindow>
      )}

      {/* ═══════ POPUP: FORGE PROGRESS ═══════ */}
      {(showForgeModal || forgeRunning) && (
        <GameWindow
          title={forgeRunning ? "🔥 FORGE IN PROGRESS" : "⚡ FORGE RESULTS"}
          icon={<Zap className="h-4 w-4" />}
          onClose={() => { if (!forgeRunning) setShowForgeModal(false) }}
        >
          <div className="space-y-3">
            {forgeRunning && !forgeSteps.length && (
              <div className="flex items-center gap-2 text-amber-400 font-mono text-sm animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin" />
                {forgeProgress}
              </div>
            )}

            {forgeSteps.length > 0 && (
              <div className="space-y-1.5">
                {forgeSteps.map((s, i) => (
                  <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-mono transition-all ${
                    s.status === "completed" ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-400" :
                    s.status === "failed" ? "border-red-500/30 bg-red-950/20 text-red-400" :
                    "border-stone-700/30 bg-stone-800/30 text-stone-400"
                  }`}>
                    {s.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> :
                     s.status === "failed" ? <XCircle className="h-3.5 w-3.5 shrink-0" /> :
                     <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
                    <span className="flex-1">{s.step}</span>
                    {s.time && <span className="text-[10px] text-stone-600">{s.time.slice(0, 5)}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Final status */}
            {!forgeRunning && forgeProgress && (
              <div className={`mt-2 px-3 py-2 rounded-lg border font-mono text-xs ${
                forgeProgress.includes("complete") ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-400" :
                forgeProgress.includes("Failed") ? "border-red-500/30 bg-red-950/20 text-red-400" :
                "border-amber-500/30 bg-amber-950/20 text-amber-400"
              }`}>
                {forgeProgress}
              </div>
            )}
          </div>
        </GameWindow>
      )}

      {/* ═══════ POPUP: ACTIVITY LOG ═══════ */}
      {showLogModal && (
        <GameWindow
          title="📡 ACTIVITY LOG"
          icon={<ScrollText className="h-4 w-4" />}
          onClose={() => setShowLogModal(false)}
        >
          <div className="font-mono text-[11px] leading-relaxed max-h-96 overflow-y-auto space-y-0.5">
            {logs.length === 0 && (
              <p className="text-stone-500 text-center py-8 text-xs">
                No events yet. Press FORGE to start the factory.
              </p>
            )}
            {logs.map((l) => (
              <div key={l.id} className="flex gap-2 py-0.5 hover:bg-stone-800/50 rounded-sm px-1 -mx-1">
                <span className="text-stone-600 shrink-0 text-[10px]">{l.time}</span>
                <span
                  className="shrink-0 font-semibold text-[11px]"
                  style={{ color: logTypeColor(l.type) }}
                >
                  {l.agent}
                </span>
                <span className={
                  l.type === "err" ? "text-red-400" :
                  l.type === "warn" ? "text-amber-400" :
                  l.type === "ok" ? "text-emerald-400" :
                  "text-stone-400"
                }>{l.msg}</span>
              </div>
            ))}
            <div ref={logsEnd} />
          </div>
        </GameWindow>
      )}

      {/* ═══════ ANIMATIONS ═══════ */}
      <style jsx>{`
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
        @keyframes bounce-in { 0% { transform: translateY(6px) scale(0.98); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-bob { animation: bob 1s ease-in-out infinite; }
        .animate-shake { animation: shake 0.3s ease-in-out infinite; }
        .animate-bounce-in { animation: bounce-in 0.2s ease-out; }
        :global(.pixelated) { image-rendering: pixelated; image-rendering: crisp-edges; }
      `}</style>
    </div>
  )
}
