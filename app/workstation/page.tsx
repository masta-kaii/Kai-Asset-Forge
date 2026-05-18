"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { autonomousTick } from "@/app/actions/autonomous-agent"
import { getDashboardData } from "@/app/actions/dashboard"
import { pause, resume } from "@/lib/budget/kill-switch"
import { runOrchestrator } from "@/app/actions/orchestrator"
import { Play, Pause, Zap, Loader2 } from "lucide-react"

// ---------------------------------------------------------------------------
// Agent map — 3x3 grid, Orchestrator in center
// gridX, gridY are tile positions (0-2)
// ---------------------------------------------------------------------------

interface AgentDef {
  id: string
  label: string
  emoji: string
  role: string
  homeX: number
  homeY: number
  color: string
}

const AGENTS: AgentDef[] = [
  { id: "monitor",      label: "Monitor",  emoji: "📡", role: "Watch", homeX: 0, homeY: 0, color: "#334" },
  { id: "scout",        label: "Scout",    emoji: "🔍", role: "Trends", homeX: 1, homeY: 0, color: "#244" },
  { id: "forge",        label: "Forge",    emoji: "⚡", role: "Generate", homeX: 2, homeY: 0, color: "#430" },
  { id: "deploy",       label: "Deploy",   emoji: "🚀", role: "Ship", homeX: 0, homeY: 2, color: "#224" },
  { id: "lister",       label: "Lister",   emoji: "🏪", role: "Sell", homeX: 1, homeY: 2, color: "#412" },
  { id: "packager",     label: "Packager", emoji: "📦", role: "Bundle", homeX: 2, homeY: 2, color: "#420" },
  { id: "orchestrator", label: "Orch",     emoji: "🧠", role: "MANAGER", homeX: 1, homeY: 1, color: "#232" },
  { id: "curator",      label: "Curator",  emoji: "✅", role: "Review", homeX: 2, homeY: 1, color: "#142" },
]

// Center is orchestrator; rearrange curator to (2,1)
AGENTS.find((a) => a.id === "curator")!.homeX = 2
AGENTS.find((a) => a.id === "curator")!.homeY = 1

// Deploy stays left-bottom
// Lister stays middle-bottom
// Packager stays right-bottom

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentStatus = "idle" | "walking" | "working" | "done" | "error"

interface AgentState {
  status: AgentStatus
  message: string
  gridX: number
  gridY: number
  pulse: boolean
}

interface SimStatus {
  action: string
  detail: string
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

interface ForgeStep {
  step: string
  status: string
  summary: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function tileColor(x: number, y: number, isPath: boolean): string {
  // Checkerboard floor
  const dark = (x + y) % 2 === 0
  if (isPath) return dark ? "#1a2a1a" : "#1e2e1e"
  return dark ? "#1a1a1f" : "#1e1e24"
}

function providerDot(s: string) {
  if (s === "healthy") return "🟢"
  if (s === "degraded") return "🟡"
  return "🔴"
}

// Map step name to agent id
const stepAgentMap: Record<string, string> = {
  scout: "scout", curate: "curator", generate: "forge",
  package: "packager", listing: "lister", publish: "deploy",
  orchestrate: "orchestrator", complete: "orchestrator",
}

function stepToAgent(stepName: string): string | null {
  for (const [key, agent] of Object.entries(stepAgentMap)) {
    if (stepName.toLowerCase().includes(key)) return agent
  }
  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkstationPage() {
  const [status, setStatus] = useState<SimStatus>({
    action: "idle", detail: "System booting...", providers: { openai: "unknown", deepseek: "unknown" },
    budget: { used: 0, cap: 10, remaining: 10 },
    backlog: { unlistedAssets: 0, stuckRuns: 0, packsToPublish: 0 },
    isPaused: false, totalAssets: 0, readyPacks: 0,
  })

  const [agents, setAgents] = useState<Record<string, AgentState>>(() => {
    const init: Record<string, AgentState> = {}
    for (const a of AGENTS) {
      init[a.id] = { status: "idle", message: "", gridX: a.homeX, gridY: a.homeY, pulse: false }
    }
    return init
  })

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [forgeRunning, setForgeRunning] = useState(false)
  const [forgeSteps, setForgeSteps] = useState<ForgeStep[]>([])
  const [uptime, setUptime] = useState(0)
  const [forgeProgress, setForgeProgress] = useState("")

  const logsEnd = useRef<HTMLDivElement>(null)
  const logCounter = useRef(0)
  const prevAction = useRef("")
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isVisible = useRef(true)

  // ---- Logging ----
  function addLog(agent: string, msg: string, type: LogEntry["type"] = "info") {
    const id = ++logCounter.current
    const time = new Date().toLocaleTimeString("en-US", { hour12: false }).slice(0, 8)
    setLogs((p) => [...p.slice(-50), { id, time, agent, msg, type }])
  }

  // ---- Uptime ----
  useEffect(() => {
    const i = setInterval(() => setUptime((u) => u + 1), 1000)
    return () => clearInterval(i)
  }, [])

  // ---- Tab visibility ----
  useEffect(() => {
    function handle() {
      isVisible.current = document.visibilityState === "visible"
      if (isVisible.current) poll() // re-poll immediately on focus
    }
    document.addEventListener("visibilitychange", handle)
    return () => document.removeEventListener("visibilitychange", handle)
  }, [])

  // ---- Agent movement ----
  function moveAgent(id: string, tx: number, ty: number) {
    setAgents((prev) => {
      if (!prev[id]) return prev
      const current = prev[id]
      if (current.gridX === tx && current.gridY === ty) return prev
      return { ...prev, [id]: { ...current, gridX: tx, gridY: ty, status: "walking" } }
    })
  }

  function sendHome(id: string) {
    const def = AGENTS.find((a) => a.id === id)
    if (!def) return
    moveAgent(id, def.homeX, def.homeY)
  }

  // ---- Poll ----
  const poll = useCallback(async () => {
    try {
      const [tick, dash] = await Promise.all([autonomousTick(), getDashboardData()])
      setStatus({
        action: tick.action, detail: tick.detail,
        providers: tick.providers, budget: tick.budget, backlog: tick.backlog,
        isPaused: dash.isPaused, totalAssets: dash.totalAssets, readyPacks: dash.readyPacks,
      })

      const action = tick.action
      const detail = tick.detail

      // Build honest agent states — only "working" when system actually active
      const updates: Record<string, Partial<AgentState>> = {}

      for (const a of AGENTS) {
        let st: AgentStatus = "idle"
        let msg = ""
        const isActive = action !== "idle"

        switch (a.id) {
          case "orchestrator":
            if (isActive) { st = "working"; msg = detail; }
            else { st = "idle"; msg = "Awaiting orders"; }
            break
          case "scout":
            if (action === "scanning") { st = "working"; msg = "Scanning market"; }
            else if (action === "forging") { st = "done"; msg = "Trends found"; }
            break
          case "forge":
            if (action === "forging") { st = "working"; msg = "Drawing pixels"; }
            break
          case "curator":
            if (action === "forging") { st = "working"; msg = "Scoring quality"; }
            break
          case "packager":
            if (action === "packaging") { st = "working"; msg = "Bundling assets"; }
            break
          case "lister":
            if (action === "packaging" || action === "publishing") { st = "working"; msg = "Writing listing"; }
            break
          case "deploy":
            if (action === "publishing") { st = "working"; msg = "Uploading store"; }
            break
          case "monitor":
            st = "working"
            msg = `Watching ${tick.backlog.unlistedAssets + tick.backlog.packsToPublish} items`
            break
        }

        // Move agent to center when working, home when idle
        const tx = st === "working" ? a.homeX : a.homeX
        const ty = st === "working" ? a.homeY : a.homeY

        // For working agents (not orchestrator), walk toward center
        if (st === "working" && a.id !== "orchestrator" && a.id !== "monitor") {
          // Move one step toward center (1,1)
          const towardX = a.homeX < 1 ? a.homeX + 1 : a.homeX > 1 ? a.homeX - 1 : a.homeX
          const towardY = a.homeY < 1 ? a.homeY + 1 : a.homeY > 1 ? a.homeY - 1 : a.homeY
          updates[a.id] = {
            status: st, message: msg,
            gridX: towardX, gridY: towardY, pulse: true,
          }
        } else {
          updates[a.id] = {
            status: st, message: msg,
            gridX: tx, gridY: ty, pulse: st === "working",
          }
        }
      }

      // Also animate orchestrator pulsing more when dispatching
      if (updates.orchestrator?.status === "working") {
        updates.orchestrator.pulse = true
      }

      setAgents((prev) => {
        const next = { ...prev }
        for (const [id, u] of Object.entries(updates)) {
          next[id] = { ...next[id], ...u }
        }
        return next
      })

      // Log state changes
      if (action !== prevAction.current && action !== "idle") {
        addLog("system", detail, action === "blocked" ? "warn" : "info")
      }
      prevAction.current = action
    } catch {
      // ignore
    }

    if (pollTimer.current) clearTimeout(pollTimer.current)
    pollTimer.current = setTimeout(poll, 5000)
  }, [])

  // Start polling
  useEffect(() => {
    poll()
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current) }
  }, [poll])

  // ---- Launch forge ----
  async function handleForge() {
    setForgeRunning(true)
    setForgeSteps([])
    setForgeProgress("Starting...")

    // Animate agents gathering around orchestrator
    for (const a of AGENTS) {
      if (a.id !== "orchestrator") moveAgent(a.id, a.homeX, a.homeY)
    }
    addLog("orchestrator", "📋 Dispatching pipeline...", "info")
    await sleep(400)

    try {
      const result = await runOrchestrator({ theme: "fantasy creatures", maxAssets: 2 })
      const steps = result.steps ?? []

      if (steps.length > 0) {
        setForgeSteps(steps.map((s) => ({
          step: s.step, status: s.status, summary: s.summary ?? "",
        })))

        // Animate each step — move the relevant agent and show speech
        for (const step of steps) {
          const agentId = stepToAgent(step.step)
          const statusIcon = step.status === "completed" ? "✓" : step.status === "failed" ? "✗" : "..."
          setForgeProgress(`${statusIcon} ${step.step}`)

          if (agentId && agents[agentId]) {
            setAgents((prev) => ({
              ...prev,
              [agentId]: {
                ...prev[agentId],
                status: step.status === "completed" ? "done" : step.status === "failed" ? "error" : "working",
                message: `${statusIcon} ${step.summary ?? step.step}`,
                pulse: step.status === "running",
                gridX: agentId === "orchestrator" ? 1 : AGENTS.find((a) => a.id === agentId)?.homeX ?? 0,
                gridY: agentId === "orchestrator" ? 1 : AGENTS.find((a) => a.id === agentId)?.homeY ?? 0,
              },
            }))
            addLog(agentId, step.summary ?? step.step, step.status === "failed" ? "err" : "ok")
          }

          if (agentId) { await sleep(700) } // stagger for animation
        }
      }

      if (result.error) {
        setForgeProgress(`Failed: ${result.error}`)
        addLog("orchestrator", result.error, "err")
      } else if (result.status === "completed") {
        setForgeProgress("✓ Pipeline complete!")
        addLog("orchestrator", "Pipeline complete!", "ok")
      } else if (result.status === "paused_provider") {
        setForgeProgress("⏸ Provider at limit")
        addLog("orchestrator", `Paused: ${result.error ?? "provider limit"}`, "warn")
      } else {
        setForgeProgress(`Status: ${result.status}`)
      }

      // Send agents home
      await sleep(800)
      for (const a of AGENTS) sendHome(a.id)

    } catch (e: unknown) {
      setForgeProgress("Error during forge")
      addLog("orchestrator", (e as Error).message ?? "Unknown", "err")
    } finally {
      setForgeRunning(false)
    }
  }

  // ---- Killswitch ----
  async function handlePause() {
    if (status.isPaused) {
      await resume()
      addLog("system", "Killswitch released", "ok")
    } else {
      await pause()
      addLog("system", "Killswitch engaged — forge paused", "warn")
    }
    const dash = await getDashboardData()
    setStatus((s) => ({ ...s, isPaused: dash.isPaused }))
  }

  // ---- Auto-scroll logs ----
  useEffect(() => { logsEnd.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])

  // ---- Derived ----
  const budgetPct = status.budget.cap > 0 ? Math.round((status.budget.used / status.budget.cap) * 100) : 0
  const uptimeStr = `${String(Math.floor(uptime / 3600)).padStart(2, "0")}:${String(Math.floor((uptime % 3600) / 60)).padStart(2, "0")}:${String(uptime % 60).padStart(2, "0")}`
  const workingAgents = Object.values(agents).filter((a) => a.status === "working" || a.status === "walking").length

  // Grid cell pixel size
  const CELL = 100 // px

  return (
    <div className="flex flex-col gap-2 p-1 select-none">
      {/* ═══════ HUD ═══════ */}
      <div className="flex flex-wrap items-center gap-2 rounded border-2 border-emerald-900/60 bg-[#0a0a0a] px-3 py-1.5 font-mono text-[10px] text-emerald-400 shadow-[inset_0_0_20px_rgba(0,255,100,0.04)]">
        <span className="text-emerald-700">SYS</span>
        <Badge className={`rounded-none border px-1.5 py-0 text-[10px] font-mono ${
          status.action === "idle" ? "border-blue-800 bg-blue-950 text-blue-400" :
          status.action === "blocked" ? "border-red-800 bg-red-950 text-red-400" :
          "border-emerald-800 bg-emerald-950 text-emerald-400"
        }`}>{status.action.toUpperCase()}</Badge>
        <span className="text-emerald-700 max-w-48 truncate hidden sm:inline">{status.detail}</span>

        <span className="text-emerald-800 mx-1">│</span>
        <span>{providerDot(status.providers.openai)}</span>
        <span>{providerDot(status.providers.deepseek)}</span>

        <span className="text-emerald-800 mx-1">│</span>
        <span>${status.budget.used.toFixed(2)}/${status.budget.cap}</span>

        <span className="text-emerald-800 mx-1">│</span>
        <span className="text-emerald-600">AG</span>
        <span>{workingAgents}/8</span>

        <span className="text-emerald-800 mx-1">│</span>
        <span>{uptimeStr}</span>

        <span className="ml-auto flex items-center gap-2">
          {status.isPaused && <span className="animate-pulse text-red-400 text-[9px]">KS</span>}
          <button onClick={handlePause} className="hover:text-white" title="Killswitch">
            {status.isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </button>
          <button
            onClick={handleForge}
            disabled={forgeRunning}
            className="border border-emerald-700 px-2 py-0.5 hover:bg-emerald-900/30 disabled:opacity-40 flex items-center gap-1"
          >
            {forgeRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            {forgeRunning ? "RUNNING" : "FORGE"}
          </button>
        </span>
      </div>

      {/* ═══════ FACTORY FLOOR — 3×3 tile map ═══════ */}
      <div
        className="relative rounded border-2 border-zinc-800 overflow-hidden"
        style={{ backgroundColor: "#111118", height: `${CELL * 3 + 8}px`, minHeight: 340 }}
      >
        {/* Scanlines */}
        <div className="pointer-events-none absolute inset-0 z-30"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)" }}
        />

        {/* Floor label */}
        <div className="absolute top-1.5 left-2 z-20 font-mono text-[9px] text-zinc-600">KAI ASSET FORGE · FACTORY FLOOR</div>

        {/* Tiles background */}
        <div className="absolute inset-0 z-0 grid grid-cols-3 grid-rows-3" style={{ padding: 4, gap: 2 }}>
          {Array.from({ length: 9 }).map((_, i) => {
            const x = i % 3
            const y = Math.floor(i / 3)
            const isCenter = x === 1 && y === 1
            const isPath = (x === 1 || y === 1) && !isCenter // cross-shaped paths to center
            return (
              <div
                key={i}
                className="relative rounded-sm border"
                style={{
                  backgroundColor: isCenter ? "#0f1f0f" : tileColor(x, y, isPath),
                  borderColor: isCenter ? "rgba(74,222,128,0.15)" : "rgba(63,63,70,0.2)",
                }}
              >
                {/* Tile decoration */}
                {isCenter && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-10">
                    <div className="text-4xl">⬡</div>
                  </div>
                )}
                {!isCenter && (
                  <div className="absolute top-0.5 left-0.5 font-mono text-[7px] text-zinc-800">
                    {x},{y}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Dotted path lines (cross shape to center) */}
        <svg className="absolute inset-0 z-5 w-full h-full pointer-events-none opacity-20" viewBox="0 0 300 300" preserveAspectRatio="none">
          {/* Horizontal center line */}
          <line x1="0" y1="150" x2="300" y2="150" stroke="#4ade80" strokeWidth="1" strokeDasharray="4,8" />
          {/* Vertical center line */}
          <line x1="150" y1="0" x2="150" y2="300" stroke="#4ade80" strokeWidth="1" strokeDasharray="4,8" />
          {/* Center highlight */}
          <rect x="105" y="105" width="90" height="90" fill="none" stroke="#4ade80" strokeWidth="0.5" strokeDasharray="3,6" opacity="0.3" />
        </svg>

        {/* Agents on the floor */}
        {AGENTS.map((agent) => {
          const st = agents[agent.id]
          if (!st) return null
          const px = st.gridX * CELL + CELL / 2
          const py = st.gridY * CELL + CELL / 2
          const isOrch = agent.id === "orchestrator"

          return (
            <div
              key={agent.id}
              className="absolute z-10 flex flex-col items-center pointer-events-auto"
              style={{
                left: px,
                top: py,
                transform: "translate(-50%, -50%)",
                transition: "left 0.8s ease-in-out, top 0.8s ease-in-out",
              }}
            >
              {/* Speech bubble */}
              {st.message && (st.status === "working" || st.status === "done" || st.status === "error") && (
                <div
                  className="mb-1 px-2 py-0.5 max-w-[120px] border text-center animate-bounce-in"
                  style={{
                    backgroundColor: "#0a0a0a",
                    borderColor: st.status === "error" ? "rgba(248,113,113,0.5)" : "rgba(74,222,128,0.5)",
                  }}
                >
                  <p className={`font-mono text-[8px] leading-tight ${
                    st.status === "error" ? "text-red-300" : "text-emerald-300"
                  }`}>
                    {st.message}
                  </p>
                  <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45"
                    style={{
                      backgroundColor: "#0a0a0a",
                      borderRight: `1px solid ${st.status === "error" ? "rgba(248,113,113,0.5)" : "rgba(74,222,128,0.5)"}`,
                      borderBottom: `1px solid ${st.status === "error" ? "rgba(248,113,113,0.5)" : "rgba(74,222,128,0.5)"}`,
                    }}
                  />
                </div>
              )}

              {/* Agent sprite */}
              <div
                className={`
                  flex items-center justify-center rounded-sm border-2
                  ${isOrch ? "w-14 h-14 text-3xl" : "w-11 h-11 text-2xl"}
                  ${st.pulse ? "shadow-[0_0_12px_rgba(74,222,128,0.3)]" : ""}
                  ${st.status === "walking" ? "animate-bob" : ""}
                  ${st.status === "working" ? "animate-bob" : ""}
                  ${st.status === "error" ? "animate-shake" : ""}
                `}
                style={{
                  backgroundColor: agent.color,
                  borderColor: isOrch ? "rgba(74,222,128,0.5)" :
                    st.status === "working" ? "rgba(74,222,128,0.3)" :
                    st.status === "error" ? "rgba(248,113,113,0.3)" :
                    "rgba(63,63,70,0.4)",
                  imageRendering: "pixelated",
                }}
              >
                <span className={st.pulse ? "animate-pulse" : ""}>{agent.emoji}</span>
              </div>

              {/* Name tag */}
              <div className="mt-0.5 px-1.5 py-0.5 rounded-sm border border-zinc-800 bg-black/80">
                <p className={`font-mono text-[8px] leading-none ${
                  isOrch ? "text-emerald-400 font-bold" : "text-zinc-400"
                }`}>
                  {agent.label}
                </p>
                <p className="font-mono text-[7px] text-zinc-600 leading-none">{agent.role}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ═══════ FORGE PROGRESS ═══════ */}
      {(forgeRunning || forgeSteps.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 rounded border border-zinc-800 bg-black/80 px-3 py-2 font-mono text-[10px]">
          <span className="text-emerald-600 mr-1">PROGRESS</span>
          {forgeRunning && !forgeSteps.length && (
            <span className="text-emerald-400 animate-pulse">{forgeProgress}</span>
          )}
          {forgeSteps.map((s, i) => (
            <span
              key={i}
              className={`px-1.5 py-0.5 rounded-sm border ${
                s.status === "completed" ? "border-emerald-700 text-emerald-400 bg-emerald-950/30" :
                s.status === "failed" ? "border-red-700 text-red-400 bg-red-950/30" :
                s.status === "running" ? "border-amber-700 text-amber-400 bg-amber-950/30 animate-pulse" :
                "border-zinc-700 text-zinc-500"
              }`}
            >
              {s.status === "completed" ? "✓" : s.status === "failed" ? "✗" : "·"} {s.step}
            </span>
          ))}
          {!forgeRunning && forgeSteps.length > 0 && forgeProgress && (
            <span className={`${
              forgeProgress.includes("complete") ? "text-emerald-400" :
              forgeProgress.includes("Failed") || forgeProgress.includes("Error") ? "text-red-400" :
              "text-amber-400"
            }`}>{forgeProgress}</span>
          )}
        </div>
      )}

      {/* ═══════ COMMS LOG ═══════ */}
      <Card className="border-zinc-800 bg-black/80">
        <CardContent className="p-2">
          <div className="h-28 overflow-y-auto font-mono text-[10px] leading-relaxed">
            <p className="text-emerald-700 mb-0.5">┌─ COMMS LOG</p>
            {logs.length === 0 && (
              <p className="text-zinc-700 px-2">No events. Hit FORGE to begin.</p>
            )}
            {logs.map((l) => (
              <div key={l.id} className="flex gap-1 px-2">
                <span className="text-zinc-700 shrink-0">[{l.time}]</span>
                <span className="text-zinc-600 shrink-0">&lt;{l.agent}&gt;</span>
                <span className={
                  l.type === "err" ? "text-red-400" :
                  l.type === "warn" ? "text-amber-400" :
                  l.type === "ok" ? "text-emerald-400" :
                  "text-zinc-300"
                }>{l.msg}</span>
              </div>
            ))}
            <div ref={logsEnd} />
            <p className="text-emerald-700 mt-0.5">└──────────</p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center font-mono text-[9px] text-zinc-800">
        Manager (🧠 Orch) dispatches tasks · Agents walk the floor · Polls every 5s · Tab-safe
      </p>

      {/* ═══════ ANIMATIONS ═══════ */}
      <style jsx>{`
        @keyframes bob {
          0%, 100% { transform: translate(-50%, -50%); }
          50% { transform: translate(-50%, calc(-50% - 5px)); }
        }
        @keyframes shake {
          0%, 100% { transform: translate(-50%, -50%); }
          25% { transform: translate(calc(-50% - 3px), -50%); }
          75% { transform: translate(calc(-50% + 3px), -50%); }
        }
        @keyframes bounce-in {
          0% { transform: translateY(4px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-bob { animation: bob 0.8s ease-in-out infinite; }
        .animate-shake { animation: shake 0.3s ease-in-out infinite; }
        .animate-bounce-in { animation: bounce-in 0.25s ease-out; }
      `}</style>
    </div>
  )
}
