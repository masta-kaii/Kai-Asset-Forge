"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { autonomousTick } from "@/app/actions/autonomous-agent"
import { getDashboardData } from "@/app/actions/dashboard"
import { pause, resume } from "@/lib/budget/kill-switch"
import { runOrchestrator } from "@/app/actions/orchestrator"
import {
  Play,
  Pause,
  Zap,
  Loader2,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Pixel sprites — each agent is a simple CSS pixel-art character
// ---------------------------------------------------------------------------

interface AgentDef {
  id: string
  label: string
  emoji: string
  role: string
  color: string // tailwind bg color for the station tile
  x: number     // grid column 0-3
  y: number     // grid row 0-1
}

const AGENTS: AgentDef[] = [
  { id: "orchestrator", label: "Brain", emoji: "🧠", role: "Plans", color: "bg-violet-950/60", x: 1, y: 0 },
  { id: "scout",        label: "Scout", emoji: "🔍", role: "Trends", color: "bg-cyan-950/60", x: 2, y: 0 },
  { id: "forge",        label: "Forge", emoji: "⚡", role: "Generate", color: "bg-amber-950/60", x: 3, y: 0 },
  { id: "curator",      label: "Curator", emoji: "✅", role: "Review", color: "bg-green-950/60", x: 3, y: 1 },
  { id: "packager",     label: "Packager", emoji: "📦", role: "Bundle", color: "bg-orange-950/60", x: 2, y: 1 },
  { id: "lister",       label: "Lister", emoji: "🏪", role: "Sell", color: "bg-pink-950/60", x: 1, y: 1 },
  { id: "deploy",       label: "Deploy", emoji: "🚀", role: "Ship", color: "bg-blue-950/60", x: 0, y: 1 },
  { id: "monitor",      label: "Monitor", emoji: "📡", role: "Watch", color: "bg-slate-950/60", x: 0, y: 0 },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentStatus = "idle" | "working" | "done" | "error" | "talking"

interface AgentState {
  status: AgentStatus
  message: string
  lastMsg: string
  pulse: boolean
  talking: boolean
}

interface SimStatus {
  action: string
  detail: string
  timestamp: string
  providers: { openai: string; deepseek: string }
  budget: { used: number; cap: number; remaining: number }
  backlog: { unlistedAssets: number; stuckRuns: number; packsToPublish: number }
  isPaused: boolean
  totalAssets: number
  readyPacks: number
}

interface LogEntry {
  id: number
  time: string
  agent: string
  msg: string
  type: "info" | "ok" | "warn" | "err"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkstationPage() {
  const [status, setStatus] = useState<SimStatus>({
    action: "idle",
    detail: "Booting...",
    timestamp: "",
    providers: { openai: "unknown", deepseek: "unknown" },
    budget: { used: 0, cap: 10, remaining: 10 },
    backlog: { unlistedAssets: 0, stuckRuns: 0, packsToPublish: 0 },
    isPaused: false,
    totalAssets: 0,
    readyPacks: 0,
  })

  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>(() => {
    const init: Record<string, AgentState> = {}
    for (const a of AGENTS) {
      init[a.id] = { status: "idle", message: "", lastMsg: "", pulse: false, talking: false }
    }
    return init
  })

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [forgeRunning, setForgeRunning] = useState(false)
  const [uptime, setUptime] = useState(0)
  const [forgeSteps, setForgeSteps] = useState<{ step: string; status: string; summary: string }[]>([])
  const logCounter = useRef(0)
  const logsEnd = useRef<HTMLDivElement>(null)
  const prevAction = useRef("")

  function addLog(agent: string, msg: string, type: LogEntry["type"] = "info") {
    const id = ++logCounter.current
    const time = new Date().toLocaleTimeString("en-US", { hour12: false }).slice(0, 8)
    setLogs((prev) => [...prev.slice(-40), { id, time, agent, msg, type }])
  }

  function setAgent(id: string, patch: Partial<AgentState>) {
    setAgentStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }))
  }

  // ---- Uptime ----
  useEffect(() => {
    const i = setInterval(() => setUptime((u) => u + 1), 1000)
    return () => clearInterval(i)
  }, [])

  // ---- Poll loop ----
  useEffect(() => {
    let mounted = true
    async function poll() {
      if (!mounted) return
      try {
        const [tick, dash] = await Promise.all([autonomousTick(), getDashboardData()])
        if (!mounted) return

        setStatus({
          action: tick.action,
          detail: tick.detail,
          timestamp: tick.timestamp,
          providers: tick.providers,
          budget: tick.budget,
          backlog: tick.backlog,
          isPaused: dash.isPaused,
          totalAssets: dash.totalAssets,
          readyPacks: dash.readyPacks,
        })

        const action = tick.action
        const detail = tick.detail

        // Update agent states based on tick action
        const updates: Record<string, Partial<AgentState>> = {}

        for (const a of AGENTS) {
          let st: AgentStatus = "idle"
          let msg = ""

          switch (a.id) {
            case "orchestrator":
              if (action === "forging" || action === "scanning") { st = "working"; msg = "Scanning..." }
              else if (action === "paused" || action === "blocked") { st = "error"; msg = "Paused" }
              else if (action === "packaging" || action === "publishing") { st = "talking"; msg = "Dispatching" }
              break
            case "scout":
              if (action === "scanning") { st = "working"; msg = "Searching" }
              else if (action === "forging") { st = "done"; msg = "Found trends" }
              break
            case "forge":
              if (action === "forging") { st = "working"; msg = "Drawing..." }
              break
            case "curator":
              if (action === "forging" || tick.backlog.unlistedAssets > 0) { st = "working"; msg = "Scoring..." }
              break
            case "packager":
              if (action === "packaging") { st = "working"; msg = "Bundling" }
              else if (tick.backlog.packsToPublish > 0) { st = "talking"; msg = `${tick.backlog.packsToPublish} ready` }
              break
            case "lister":
              if (action === "packaging" || action === "publishing") { st = "working"; msg = "Writing..." }
              break
            case "deploy":
              if (action === "publishing") { st = "working"; msg = "Uploading" }
              break
            case "monitor":
              st = "working"; msg = "👀"
              break
          }

          updates[a.id] = {
            status: st,
            message: msg || "",
            pulse: st === "working",
            talking: st === "talking" || (st === "working" && Math.random() > 0.7),
          }
        }

        setAgentStates((prev) => {
          const next = { ...prev }
          for (const [id, u] of Object.entries(updates)) {
            next[id] = { ...next[id], ...u }
          }
          return next
        })

        // Log action changes
        if (action !== prevAction.current && action !== "idle") {
          addLog("system", detail, action === "blocked" ? "warn" : "info")
        }
        prevAction.current = action
      } catch {
        // ignore
      }
    }
    poll()
    const t = setInterval(poll, 4000)
    return () => { mounted = false; clearInterval(t) }
  }, [])

  // ---- Launch forge ----
  async function handleForge() {
    setForgeRunning(true)
    setForgeSteps([])
    addLog("orchestrator", "Launching full pipeline...", "info")

    try {
      const result = await runOrchestrator({ theme: "fantasy creatures", maxAssets: 2 })

      if (result.steps) {
        setForgeSteps(result.steps.map((s) => ({
          step: s.step, status: s.status, summary: s.summary ?? "",
        })))

        // Simulate agent conversations based on steps
        for (const step of result.steps) {
          const speaker = stepAgent(step.step)
          if (speaker) {
            const emoji = step.status === "completed" ? "✅" : step.status === "failed" ? "❌" : "⏳"
            setAgent(speaker, {
              status: step.status === "completed" ? "done" : step.status === "failed" ? "error" : "working",
              message: `${emoji} ${step.summary ?? step.step}`,
              pulse: step.status === "running",
              talking: true,
            })
            addLog(speaker, step.summary ?? step.step, step.status === "failed" ? "err" : "ok")
          }
          await sleep(600) // stagger for visual effect
        }
      }

      if (result.error) {
        addLog("orchestrator", result.error, "err")
      } else if (result.status === "completed") {
        addLog("orchestrator", "Pipeline complete!", "ok")
      } else if (result.status === "paused_provider") {
        addLog("orchestrator", `Paused: ${result.error ?? "provider limit"}`, "warn")
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
      addLog("system", "Killswitch disengaged", "ok")
    } else {
      await pause()
      addLog("system", "Killswitch engaged", "warn")
    }
    const dash = await getDashboardData()
    setStatus((s) => ({ ...s, isPaused: dash.isPaused }))
  }

  // ---- Render helpers ----
  const budgetPct = status.budget.cap > 0 ? Math.round((status.budget.used / status.budget.cap) * 100) : 0
  const uptimeStr = `${String(Math.floor(uptime / 3600)).padStart(2, "0")}:${String(Math.floor((uptime % 3600) / 60)).padStart(2, "0")}:${String(uptime % 60).padStart(2, "0")}`

  useEffect(() => { logsEnd.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])

  // Find agent for a step
  const stepAgentMap: Record<string, string> = {
    scout: "scout", curate: "curator", generate: "forge",
    package: "packager", listing: "lister", publish: "deploy",
    orchestrate: "orchestrator",
  }

  function stepAgent(stepName: string): string | null {
    for (const [key, agent] of Object.entries(stepAgentMap)) {
      if (stepName.toLowerCase().includes(key)) return agent
    }
    if (stepName.toLowerCase().includes("complete")) return "orchestrator"
    return null
  }

  const providerDot = (s: string) => s === "healthy" ? "🟢" : s === "degraded" ? "🟡" : "🔴"

  return (
    <div className="flex flex-col gap-3 p-1 select-none">
      {/* ═══════ HUD TOP BAR ═══════ */}
      <div className="flex flex-wrap items-center gap-2 rounded border-2 border-emerald-900/60 bg-black/80 px-3 py-1.5 font-mono text-[10px] text-emerald-400 shadow-[inset_0_0_20px_rgba(0,255,100,0.05)]">
        <span className="text-emerald-600">┌─ SYSTEM ─</span>
        <Badge className={`rounded-none border px-1.5 py-0 text-[10px] font-mono ${
          status.action === "idle" ? "border-blue-800 bg-blue-950 text-blue-400" :
          status.action === "blocked" ? "border-red-800 bg-red-950 text-red-400" :
          "border-emerald-800 bg-emerald-950 text-emerald-400"
        }`}>
          {status.action.toUpperCase()}
        </Badge>
        <span className="text-emerald-700 max-w-80 truncate">{status.detail}</span>

        <span className="text-emerald-600 mx-1">│</span>
        <span className="text-emerald-600">API </span>
        <span>{providerDot(status.providers.openai)}</span>
        <span>{providerDot(status.providers.deepseek)}</span>

        <span className="text-emerald-600 mx-1">│</span>
        <span className="text-emerald-600">BUD </span>
        <span>${status.budget.used.toFixed(2)}/${status.budget.cap}</span>

        <span className="text-emerald-600 mx-1">│</span>
        <span className="text-emerald-600">UP </span>
        <span>{uptimeStr}</span>

        <span className="ml-auto flex items-center gap-1">
          {status.isPaused && <span className="animate-pulse text-red-400 mr-1">[KILLSWITCH]</span>}
          <button onClick={handlePause} className="px-1 hover:text-white" title="Toggle killswitch">
            {status.isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </button>
          <button
            onClick={handleForge}
            disabled={forgeRunning}
            className="border border-emerald-700 px-2 py-0.5 hover:bg-emerald-900/40 disabled:opacity-50 flex items-center gap-1"
            title="Launch forge"
          >
            {forgeRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            FORGE
          </button>
        </span>
        <span className="text-emerald-600">─┘</span>
      </div>

      {/* ═══════ FACTORY FLOOR ═══════ */}
      <div
        className="relative rounded border-2 border-zinc-800 bg-zinc-950 overflow-hidden"
        style={{
          backgroundImage: `
            linear-gradient(rgba(39,39,42,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(39,39,42,0.15) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
          minHeight: "320px",
        }}
      >
        {/* Scanlines overlay */}
        <div className="pointer-events-none absolute inset-0 z-30"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
          }}
        />

        {/* Floor label */}
        <div className="absolute top-2 left-3 z-20 font-mono text-[10px] text-zinc-600">
          FACTORY FLOOR — KAI ASSET FORGE
        </div>

        {/* Grid layout — 4 cols, 2 rows of stations */}
        <div className="relative z-10 grid grid-cols-4 grid-rows-2 gap-0 p-4 h-full">
          {AGENTS.map((agent) => {
            const st = agentStates[agent.id] ?? { status: "idle", message: "", pulse: false, talking: false }
            return (
              <div
                key={agent.id}
                className="flex items-center justify-center p-1"
                style={{ gridColumn: agent.x + 1, gridRow: agent.y + 1 }}
              >
                <div className={`
                  relative flex flex-col items-center gap-1 w-full max-w-[160px]
                  border-2 pixel-border transition-all duration-300
                  ${agent.color}
                  ${st.pulse ? "border-emerald-500/60 shadow-[0_0_12px_rgba(0,255,100,0.15)]" : "border-zinc-700/60"}
                `}>
                  {/* Speech bubble */}
                  {st.talking && st.message && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 animate-bounce-in">
                      <div className="relative bg-zinc-900 border border-emerald-700 px-2 py-0.5 max-w-[140px]">
                        <p className="font-mono text-[9px] text-emerald-300 leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis">
                          {st.message}
                        </p>
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-emerald-700 rotate-45" />
                      </div>
                    </div>
                  )}

                  {/* Agent portrait */}
                  <div className={`
                    text-3xl p-2 transition-all
                    ${st.status === "working" ? "animate-bob" : ""}
                    ${st.status === "error" ? "animate-shake" : ""}
                  `}>
                    {agent.emoji}
                  </div>

                  {/* Nameplate */}
                  <div className="w-full bg-black/60 px-1.5 py-0.5 text-center border-t border-zinc-700/40">
                    <p className="font-mono text-[9px] text-zinc-300 leading-none">{agent.label}</p>
                    <p className="font-mono text-[8px] text-zinc-500 leading-none">{agent.role}</p>
                  </div>

                  {/* Status dot */}
                  <div className="absolute top-1 right-1 flex items-center gap-1">
                    <div className={`
                      h-2 w-2 rounded-full
                      ${st.status === "working" ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : ""}
                      ${st.status === "done" ? "bg-blue-400" : ""}
                      ${st.status === "talking" ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]" : ""}
                      ${st.status === "error" ? "bg-red-400 shadow-[0_0_6px_#f87171]" : ""}
                      ${st.status === "idle" ? "bg-zinc-600" : ""}
                      ${st.pulse ? "animate-pulse" : ""}
                    `} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Conveyor arrows between stations (simplified) */}
        <svg className="absolute inset-0 z-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 400 200" preserveAspectRatio="none">
          {/* Brain → Scout */}
          <line x1="160" y1="50" x2="220" y2="50" stroke="#4ade80" strokeWidth="1" strokeDasharray="4,4" />
          {/* Scout → Forge */}
          <line x1="260" y1="50" x2="320" y2="50" stroke="#4ade80" strokeWidth="1" strokeDasharray="4,4" />
          {/* Forge → Curator (down) */}
          <line x1="360" y1="80" x2="360" y2="120" stroke="#fbbf24" strokeWidth="1" strokeDasharray="4,4" />
          {/* Curator → Packager */}
          <line x1="320" y1="150" x2="260" y2="150" stroke="#fbbf24" strokeWidth="1" strokeDasharray="4,4" />
          {/* Packager → Lister */}
          <line x1="220" y1="150" x2="160" y2="150" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,4" />
          {/* Lister → Deploy */}
          <line x1="120" y1="150" x2="80" y2="150" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,4" />
          {/* Monitor → Brain (up) */}
          <line x1="40" y1="120" x2="40" y2="80" stroke="#71717a" strokeWidth="1" strokeDasharray="4,4" />
        </svg>
      </div>

      {/* ═══════ PROGRESS PANEL ═══════ */}
      {forgeSteps.length > 0 && (
        <Card className="border-zinc-800 bg-black/80 font-mono text-[10px]">
          <CardContent className="py-3">
            <p className="text-emerald-500 mb-2">┌─ PIPELINE PROGRESS ────────────────────────────</p>
            <div className="flex flex-wrap gap-1.5">
              {forgeSteps.map((s, i) => (
                <span
                  key={i}
                  className={`border px-1.5 py-0.5 ${
                    s.status === "completed" ? "border-emerald-700 text-emerald-400 bg-emerald-950/40" :
                    s.status === "failed" ? "border-red-700 text-red-400 bg-red-950/40" :
                    s.status === "running" ? "border-amber-700 text-amber-400 bg-amber-950/40 animate-pulse" :
                    "border-zinc-700 text-zinc-500"
                  }`}
                >
                  {s.status === "completed" ? "✓" : s.status === "failed" ? "✗" : "·"} {s.step}
                </span>
              ))}
            </div>
            <p className="text-emerald-600 mt-2">└────────────────────────────────────────────────</p>
          </CardContent>
        </Card>
      )}

      {/* ═══════ EVENT LOG ═══════ */}
      <Card className="border-zinc-800 bg-black/80">
        <CardContent className="p-2">
          <div className="h-32 overflow-y-auto font-mono text-[10px] leading-relaxed">
            <p className="text-emerald-600 mb-1">┌─ COMMS LOG ────────────────────────────────</p>
            {logs.length === 0 && (
              <p className="text-zinc-600 px-2">No events yet. Hit FORGE to start.</p>
            )}
            {logs.map((l) => (
              <div key={l.id} className="flex gap-1.5 px-2">
                <span className="text-zinc-600 shrink-0">[{l.time}]</span>
                <span className="text-zinc-500 shrink-0">&lt;{l.agent}&gt;</span>
                <span className={
                  l.type === "err" ? "text-red-400" :
                  l.type === "warn" ? "text-amber-400" :
                  l.type === "ok" ? "text-emerald-400" :
                  "text-zinc-300"
                }>{l.msg}</span>
              </div>
            ))}
            <div ref={logsEnd} />
            <p className="text-emerald-600 mt-0.5">└──────────────────────────────────────────</p>
          </div>
        </CardContent>
      </Card>

      {/* ═══════ KEYBIND HINT ═══════ */}
      <p className="text-center font-mono text-[9px] text-zinc-700">
        Agents poll every 4s · Hit FORGE to run pipeline · Speech bubbles show live agent status
      </p>

      {/* Animations */}
      <style jsx>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        @keyframes bounce-in {
          0% { transform: translate(-50%, 4px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-bob { animation: bob 1s ease-in-out infinite; }
        .animate-shake { animation: shake 0.3s ease-in-out infinite; }
        .animate-bounce-in { animation: bounce-in 0.3s ease-out; }
        .pixel-border {
          border-image-source: unset;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  )
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
