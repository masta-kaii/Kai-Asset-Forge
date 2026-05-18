"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { autonomousTick } from "@/app/actions/autonomous-agent"
import { getDashboardData } from "@/app/actions/dashboard"
import { pause, resume } from "@/lib/budget/kill-switch"
import { runOrchestrator } from "@/app/actions/orchestrator"
import { Play, Pause, Zap, Loader2 } from "lucide-react"

// ---------------------------------------------------------------------------
// Agent config — positions on a 3x3 grid, each with a character sprite
// ---------------------------------------------------------------------------

interface AgentDef {
  id: string
  label: string
  role: string
  sprite: string   // folder name under /sprites/agents/
  homeX: number     // grid col 0-2
  homeY: number     // grid row 0-2
}

const AGENTS: AgentDef[] = [
  { id: "monitor",      label: "Monitor",  role: "Watch",      sprite: "lizard_m",      homeX: 0, homeY: 0 },
  { id: "scout",        label: "Scout",    role: "Trends",     sprite: "elf_f",         homeX: 1, homeY: 0 },
  { id: "forge",        label: "Forge",    role: "Generate",   sprite: "dwarf_m",       homeX: 2, homeY: 0 },
  { id: "deploy",       label: "Deploy",   role: "Ship",       sprite: "imp",           homeX: 0, homeY: 2 },
  { id: "lister",       label: "Lister",   role: "Sell",       sprite: "elf_m",         homeX: 1, homeY: 2 },
  { id: "packager",     label: "Packager", role: "Bundle",     sprite: "goblin",        homeX: 2, homeY: 2 },
  { id: "orchestrator", label: "Orch",     role: "MANAGER",    sprite: "wizzard_m",     homeX: 1, homeY: 1 },
  { id: "curator",      label: "Curator",  role: "Review",     sprite: "knight_f",      homeX: 2, homeY: 1 },
]

// Move curator to (2,1) — bottom-right area
AGENTS.find((a) => a.id === "curator")!.homeX = 2; AGENTS.find((a) => a.id === "curator")!.homeY = 1

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
  frame: number
  animType: "idle" | "run"
}

interface SimStatus {
  action: string
  detail: string
  providers: { openai: string; deepseek: string }
  budget: { used: number; cap: number; remaining: number }
  backlog: { unlistedAssets: number; stuckRuns: number; packsToPublish: number }
  isPaused: boolean
  totalAssets: number
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
// Step → agent map
// ---------------------------------------------------------------------------

const stepAgentMap: Record<string, string> = {
  scout: "scout", curate: "curator", generate: "forge",
  package: "packager", listing: "lister", publish: "deploy",
  orchestrate: "orchestrator", complete: "orchestrator",
}

function stepToAgent(step: string): string | null {
  for (const [k, a] of Object.entries(stepAgentMap)) {
    if (step.toLowerCase().includes(k)) return a
  }
  return null
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
function providerDot(s: string) { return s === "healthy" ? "🟢" : s === "degraded" ? "🟡" : "🔴" }

// ---------------------------------------------------------------------------
// Animated Sprite Component
// ---------------------------------------------------------------------------

function AnimatedSprite({
  agentId, animType, frame, size, className,
}: {
  agentId: string
  animType: "idle" | "run"
  frame: number
  size: number
  className?: string
}) {
  const def = AGENTS.find((a) => a.id === agentId)
  if (!def) return null
  const src = `/sprites/agents/${def.sprite}/${animType}_f${frame}.png`
  return (
    <div className={`relative ${className ?? ""}`} style={{ width: size, height: size * 1.75 }}>
      <Image
        src={src}
        alt={def.label}
        width={size}
        height={size * 1.75}
        className="pixelated"
        unoptimized
        priority
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WorkstationPage() {
  const [status, setStatus] = useState<SimStatus>({
    action: "idle", detail: "System booting...", providers: { openai: "unknown", deepseek: "unknown" },
    budget: { used: 0, cap: 10, remaining: 10 },
    backlog: { unlistedAssets: 0, stuckRuns: 0, packsToPublish: 0 },
    isPaused: false, totalAssets: 0,
  })

  const [agents, setAgents] = useState<Record<string, AgentState>>(() => {
    const init: Record<string, AgentState> = {}
    for (const a of AGENTS) {
      init[a.id] = { status: "idle", message: "", gridX: a.homeX, gridY: a.homeY, pulse: false, frame: 0, animType: "idle" }
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
  const frameTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  // ---- Frame animation timers for each agent ----
  useEffect(() => {
    for (const a of AGENTS) {
      frameTimers.current[a.id] = setInterval(() => {
        setAgents((prev) => {
          const cur = prev[a.id]
          if (!cur) return prev
          const maxFrames = cur.animType === "run" ? 4 : 4
          return { ...prev, [a.id]: { ...cur, frame: (cur.frame + 1) % maxFrames } }
        })
      }, 180)
    }
    return () => {
      for (const t of Object.values(frameTimers.current)) clearInterval(t)
    }
  }, [])

  // ---- Logging ----
  function addLog(agent: string, msg: string, type: LogEntry["type"] = "info") {
    const id = ++logCounter.current
    const time = new Date().toLocaleTimeString("en-US", { hour12: false }).slice(0, 8)
    setLogs((p) => [...p.slice(-40), { id, time, agent, msg, type }])
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
      if (isVisible.current) poll()
    }
    document.addEventListener("visibilitychange", handle)
    return () => document.removeEventListener("visibilitychange", handle)
  }, [])

  // ---- Poll ----
  const poll = useCallback(async () => {
    try {
      const [tick, dash] = await Promise.all([autonomousTick(), getDashboardData()])
      setStatus({
        action: tick.action, detail: tick.detail,
        providers: tick.providers, budget: tick.budget, backlog: tick.backlog,
        isPaused: dash.isPaused, totalAssets: dash.totalAssets,
      })

      const action = tick.action
      const detail = tick.detail
      const updates: Record<string, Partial<AgentState>> = {}

      for (const a of AGENTS) {
        let st: AgentStatus = "idle"
        let msg = ""
        let anim: "idle" | "run" = "idle"

        switch (a.id) {
          case "orchestrator":
            if (action !== "idle") { st = "working"; msg = detail; anim = "idle"; }
            else { st = "idle"; msg = "Awaiting orders"; }
            break
          case "scout":
            if (action === "scanning") { st = "working"; msg = "Scanning market"; anim = "run"; }
            else if (action === "forging") { st = "done"; msg = "Trends ready"; }
            break
          case "forge":
            if (action === "forging") { st = "working"; msg = "Forging assets"; anim = "run"; }
            break
          case "curator":
            if (action === "forging") { st = "working"; msg = "Scoring"; anim = "run"; }
            break
          case "packager":
            if (action === "packaging") { st = "working"; msg = "Bundling"; anim = "run"; }
            break
          case "lister":
            if (action === "packaging" || action === "publishing") { st = "working"; msg = "Listing"; anim = "run"; }
            break
          case "deploy":
            if (action === "publishing") { st = "working"; msg = "Uploading"; anim = "run"; }
            break
          case "monitor":
            st = "working"; msg = `${tick.backlog.unlistedAssets + tick.backlog.packsToPublish} items`; anim = "idle"
            break
        }

        updates[a.id] = {
          status: st, message: msg, animType: anim,
          gridX: a.homeX, gridY: a.homeY,
          pulse: st === "working",
        }
      }

      setAgents((prev) => {
        const next = { ...prev }
        for (const [id, u] of Object.entries(updates)) {
          next[id] = { ...next[id], ...u }
        }
        return next
      })

      if (action !== prevAction.current && action !== "idle") {
        addLog("system", detail, action === "blocked" ? "warn" : "info")
      }
      prevAction.current = action
    } catch { /* ignore */ }

    if (pollTimer.current) clearTimeout(pollTimer.current)
    pollTimer.current = setTimeout(poll, 5000)
  }, [])

  useEffect(() => { poll(); return () => { if (pollTimer.current) clearTimeout(pollTimer.current) } }, [poll])

  // ---- Launch forge ----
  async function handleForge() {
    setForgeRunning(true); setForgeSteps([]); setForgeProgress("Assembling team...")
    addLog("orchestrator", "Dispatching pipeline...", "info")
    await sleep(300)

    try {
      const result = await runOrchestrator({ theme: "fantasy creatures", maxAssets: 2 })
      const steps = result.steps ?? []

      if (steps.length > 0) {
        setForgeSteps(steps.map((s) => ({ step: s.step, status: s.status, summary: s.summary ?? "" })))

        for (const step of steps) {
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
                animType: step.status === "running" ? "run" : "idle",
                pulse: step.status === "running",
              },
            }))
            addLog(agentId, step.summary ?? step.step, step.status === "failed" ? "err" : "ok")
          }
          await sleep(700)
        }
      }

      if (result.error) {
        setForgeProgress(`Failed: ${result.error}`)
        addLog("orchestrator", result.error, "err")
      } else if (result.status === "completed") {
        setForgeProgress("Pipeline complete!")
        addLog("orchestrator", "All done!", "ok")
      } else if (result.status === "paused_provider") {
        setForgeProgress("Provider limit — top up")
        addLog("orchestrator", `Paused: ${result.error ?? "limit"}`, "warn")
      } else {
        setForgeProgress(`Status: ${result.status}`)
      }

      // Reset agents to idle after forge
      await sleep(1000)
      for (const a of AGENTS) {
        setAgents((prev) => ({
          ...prev,
          [a.id]: { ...prev[a.id], status: "idle", message: "", animType: "idle", pulse: false },
        }))
      }

    } catch (e: unknown) {
      setForgeProgress("Error")
      addLog("orchestrator", (e as Error).message ?? "Unknown", "err")
    } finally {
      setForgeRunning(false)
    }
  }

  async function handlePause() {
    if (status.isPaused) { await resume(); addLog("system", "Killswitch released", "ok") }
    else { await pause(); addLog("system", "Forge paused", "warn") }
    const dash = await getDashboardData()
    setStatus((s) => ({ ...s, isPaused: dash.isPaused }))
  }

  useEffect(() => { logsEnd.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])

  // Derived
  const budgetPct = status.budget.cap > 0 ? Math.round((status.budget.used / status.budget.cap) * 100) : 0
  const uptimeStr = `${String(Math.floor(uptime / 3600)).padStart(2, "0")}:${String(Math.floor((uptime % 3600) / 60)).padStart(2, "0")}:${String(uptime % 60).padStart(2, "0")}`
  const workingAgents = Object.values(agents).filter((a) => a.status === "working" || a.status === "walking").length

  const CELL_W = 128 // room width px (includes walls)
  const CELL_H = 128 // room height px
  const WALL = 8     // wall thickness
  const INNER = CELL_W - WALL * 2
  const INNER_H = CELL_H - WALL * 2
  const TILE = 16    // floor tile size (will be scaled to fit inner room)

  return (
    <div className="flex flex-col gap-2 p-1 select-none">
      {/* ═══════ HUD ═══════ */}
      <div className="flex flex-wrap items-center gap-2 rounded border-2 border-amber-900/40 bg-[#0c0a08] px-3 py-1.5 font-mono text-[10px] text-amber-300 shadow-[inset_0_0_12px_rgba(255,180,0,0.04)]">
        <span className="text-amber-700">⚔ SYS</span>
        <Badge className={`rounded-none border px-1.5 py-0 text-[10px] font-mono ${
          status.action === "idle" ? "border-stone-700 bg-stone-900 text-stone-400" :
          status.action === "blocked" ? "border-red-800 bg-red-950 text-red-400" :
          "border-amber-700 bg-amber-950 text-amber-300"
        }`}>{status.action.toUpperCase()}</Badge>
        <span className="text-amber-600 max-w-52 truncate hidden sm:inline">{status.detail}</span>
        <span className="text-amber-800 mx-1">│</span>
        <span>{providerDot(status.providers.openai)}</span>
        <span>{providerDot(status.providers.deepseek)}</span>
        <span className="text-amber-800 mx-1">│</span>
        <span>${status.budget.used.toFixed(2)}/${status.budget.cap}</span>
        <span className="text-amber-800 mx-1">│</span>
        <span className="text-amber-700">AG</span><span>{workingAgents}/8</span>
        <span className="text-amber-800 mx-1">│</span>
        <span>{uptimeStr}</span>
        <span className="ml-auto flex items-center gap-2">
          {status.isPaused && <span className="animate-pulse text-red-400 text-[9px]">KILLSWITCH</span>}
          <button onClick={handlePause} className="hover:text-white" title="Toggle killswitch">
            {status.isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </button>
          <button onClick={handleForge} disabled={forgeRunning}
            className="border border-amber-700 px-2 py-0.5 hover:bg-amber-900/30 disabled:opacity-40 flex items-center gap-1 text-amber-200"
          >
            {forgeRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            {forgeRunning ? "FORGING" : "FORGE"}
          </button>
        </span>
      </div>

      {/* ═══════ DUNGEON FLOOR ═══════ */}
      <div className="relative rounded border-2 border-stone-800 overflow-hidden" style={{ backgroundColor: "#161210" }}>
        {/* Ambient overlay */}
        <div className="pointer-events-none absolute inset-0 z-20" style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(255,180,40,0.04) 0%, transparent 70%)",
        }} />

        {/* 3x3 room grid */}
        <div className="grid" style={{
          gridTemplateColumns: `repeat(3, ${CELL_W}px)`,
          gridTemplateRows: `repeat(3, ${CELL_H}px)`,
          padding: 2, gap: 0,
        }}>
          {AGENTS.map((agent) => {
            const st = agents[agent.id]
            if (!st) return null
            const isOrch = agent.id === "orchestrator"
            const isWorking = st.status === "working" || st.status === "walking"

            // Grid placement
            const col = agent.homeX + 1
            const row = agent.homeY + 1

            return (
              <div
                key={agent.id}
                className="relative"
                style={{ gridColumn: col, gridRow: row }}
              >
                {/* Room card */}
                <div className={`
                  relative w-full h-full border-2 flex flex-col items-center justify-center
                  ${isOrch ? "border-amber-700/60 bg-amber-950/20 shadow-[inset_0_0_20px_rgba(255,180,0,0.05)]" : ""}
                  ${!isOrch ? "border-stone-700/40 bg-stone-900/30" : ""}
                  ${isWorking ? "border-amber-600/50" : ""}
                `}>
                  {/* Floor tile pattern (repeating) */}
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: `url(/sprites/tiles/floor.png)`,
                    backgroundSize: `${TILE * 2}px ${TILE * 2}px`,
                    backgroundPosition: `${(agent.homeX * TILE) % 64}px ${(agent.homeY * TILE) % 64}px`,
                    imageRendering: "pixelated",
                  }} />

                  {/* Speech bubble */}
                  {st.message && (st.status === "working" || st.status === "done" || st.status === "error") && (
                    <div className="absolute -top-7 z-30 animate-bounce-in">
                      <div className={`relative px-2 py-0.5 max-w-[120px] border text-center bg-[#0a0808] ${
                        st.status === "error" ? "border-red-700/50" : "border-amber-700/50"
                      }`}>
                        <p className={`font-mono text-[8px] leading-tight ${
                          st.status === "error" ? "text-red-300" : "text-amber-200"
                        }`}>{st.message}</p>
                        <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 bg-[#0a0808] border-r border-b ${
                          st.status === "error" ? "border-red-700/50" : "border-amber-700/50"
                        }`} />
                      </div>
                    </div>
                  )}

                  {/* Agent sprite */}
                  <div className={`relative z-10 transition-all duration-700 ${
                    st.status === "working" ? "animate-bob" : ""
                  } ${st.status === "error" ? "animate-shake" : ""}`}>
                    <AnimatedSprite
                      agentId={agent.id}
                      animType={st.animType}
                      frame={st.frame}
                      size={isOrch ? 48 : 40}
                      className={st.pulse ? "drop-shadow-[0_0_8px_rgba(255,200,50,0.4)]" : ""}
                    />

                    {/* Glow under working agents */}
                    {st.pulse && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-2 rounded-full bg-amber-400/20 blur-sm" />
                    )}
                  </div>

                  {/* Nameplate */}
                  <div className={`absolute bottom-1 px-2 py-0.5 border text-center z-10 ${
                    isOrch ? "border-amber-700/40 bg-black/70" : "border-stone-700/30 bg-black/60"
                  }`}>
                    <p className={`font-mono text-[9px] leading-none ${
                      isOrch ? "text-amber-300 font-bold" : "text-stone-300"
                    }`}>{agent.label}</p>
                    <p className="font-mono text-[7px] leading-none text-stone-600">{agent.role}</p>
                  </div>

                  {/* Status dot */}
                  <div className="absolute top-1 right-1">
                    <div className={`h-2 w-2 rounded-full ${
                      st.status === "working" ? "bg-amber-400 shadow-[0_0_5px_#fbbf24]" :
                      st.status === "done" ? "bg-blue-400" :
                      st.status === "error" ? "bg-red-400 shadow-[0_0_5px_#f87171]" :
                      "bg-stone-600"
                    } ${st.pulse ? "animate-pulse" : ""}`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Path lines connecting rooms to center */}
        <svg className="absolute inset-0 z-0 w-full h-full pointer-events-none" viewBox={`0 0 ${CELL_W * 3} ${CELL_H * 3}`}>
          {/* Horizontal center corridor */}
          <line x1={0} y1={CELL_H * 1.5} x2={CELL_W * 3} y2={CELL_H * 1.5}
            stroke="rgba(180,140,80,0.15)" strokeWidth="2" strokeDasharray="6,8" />
          {/* Vertical center corridor */}
          <line x1={CELL_W * 1.5} y1={0} x2={CELL_W * 1.5} y2={CELL_H * 3}
            stroke="rgba(180,140,80,0.15)" strokeWidth="2" strokeDasharray="6,8" />
          {/* ORCH room highlight */}
          <rect x={CELL_W + 2} y={CELL_H + 2} width={CELL_W - 4} height={CELL_H - 4}
            fill="none" stroke="rgba(255,180,40,0.1)" strokeWidth="1" strokeDasharray="4,8" />
        </svg>

        {/* Top label */}
        <div className="absolute top-1 left-2 z-20 font-mono text-[8px] text-stone-700">KAI ASSET FORGE · DUNGEON FLOOR</div>
      </div>

      {/* ═══════ FORGE PROGRESS ═══════ */}
      {(forgeRunning || forgeSteps.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 rounded border border-stone-800 bg-[#0a0808] px-3 py-2 font-mono text-[10px]">
          <span className="text-amber-600 mr-1">PROGRESS</span>
          {forgeRunning && !forgeSteps.length && <span className="text-amber-300 animate-pulse">{forgeProgress}</span>}
          {forgeSteps.map((s, i) => (
            <span key={i} className={`px-1.5 py-0.5 rounded-sm border ${
              s.status === "completed" ? "border-amber-700 text-amber-400 bg-amber-950/20" :
              s.status === "failed" ? "border-red-700 text-red-400 bg-red-950/20" :
              s.status === "running" ? "border-amber-600 text-amber-300 bg-amber-950/30 animate-pulse" :
              "border-stone-700 text-stone-500"
            }`}>{s.status === "completed" ? "✓" : s.status === "failed" ? "✗" : "·"} {s.step}</span>
          ))}
          {!forgeRunning && forgeSteps.length > 0 && forgeProgress && (
            <span className={forgeProgress.includes("complete") ? "text-amber-300" : forgeProgress.includes("Failed") ? "text-red-400" : "text-stone-400"}>
              {forgeProgress}
            </span>
          )}
        </div>
      )}

      {/* ═══════ COMMS LOG ═══════ */}
      <Card className="border-stone-800 bg-[#0a0808]">
        <CardContent className="p-2">
          <div className="h-28 overflow-y-auto font-mono text-[10px] leading-relaxed">
            <p className="text-amber-700 mb-0.5">┌─ COMMS LOG</p>
            {logs.length === 0 && <p className="text-stone-600 px-2">No events. Press FORGE to begin.</p>}
            {logs.map((l) => (
              <div key={l.id} className="flex gap-1 px-2">
                <span className="text-stone-700 shrink-0">[{l.time}]</span>
                <span className="text-stone-600 shrink-0">&lt;{l.agent}&gt;</span>
                <span className={
                  l.type === "err" ? "text-red-400" : l.type === "warn" ? "text-amber-400" : l.type === "ok" ? "text-amber-300" : "text-stone-300"
                }>{l.msg}</span>
              </div>
            ))}
            <div ref={logsEnd} />
            <p className="text-amber-700 mt-0.5">└──────────</p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center font-mono text-[9px] text-stone-800">Orch (Wizard) dispatches from center · Agents poll every 5s · Tab-safe</p>

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
          0% { transform: translateY(4px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-bob { animation: bob 0.8s ease-in-out infinite; }
        .animate-shake { animation: shake 0.3s ease-in-out infinite; }
        .animate-bounce-in { animation: bounce-in 0.25s ease-out; }
        :global(.pixelated) { image-rendering: pixelated; image-rendering: crisp-edges; }
      `}</style>
    </div>
  )
}
