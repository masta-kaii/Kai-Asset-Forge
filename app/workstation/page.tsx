"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Image from "next/image"
import {
  Zap, X, Activity, ScrollText, Cpu, Flame,
  Hammer, Eye, Package, Archive, Target, BarChart3,
  Settings, Wrench, Gem, Coins,
} from "lucide-react"
import "./dungeon-command.css"

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface KanbanAgent {
  profile: string
  label: string
  activeCount: number
  readyCount: number
  doneCount: number
  blockedCount: number
  currentTask?: { id: string; title: string }
}

interface KanbanData {
  agents: Record<string, KanbanAgent>
  pipeline: { currentStep: number; currentAgent: string | null; allDone: boolean }
  board: { totalTasks: number; doneTotal: number; blockedTotal: number }
}

interface StatsData {
  totalAssets: number
  packsCount: number
  cycleCount: number
  revenue: number
}

const AGENTS = [
  { id: "scout",    label: "SCOUT",    role: "Discovery", icon: "🔍", color: "#00ccff", gridX: 0, gridY: 0 },
  { id: "forge",    label: "FORGE",    role: "Production", icon: "⚒️", color: "#ff6600", gridX: 1, gridY: 0 },
  { id: "curator",  label: "CURATOR",  role: "Quality",    icon: "🔬", color: "#aa55ff", gridX: 2, gridY: 0 },
  { id: "popo",     label: "POPO",     role: "Commander",  icon: "👑", color: "#ffd700", gridX: 0, gridY: 1 },
  { id: "packager", label: "PACKAGER", role: "Assembly",   icon: "📦", color: "#ffaa00", gridX: 1, gridY: 1 },
  { id: "lister",   label: "LISTER",   role: "Commerce",   icon: "📋", color: "#00ff88", gridX: 2, gridY: 1 },
]

const TABS = [
  { id: "station",  label: "STATION",  icon: Wrench },
  { id: "agents",   label: "AGENTS",   icon: Cpu },
  { id: "tasks",    label: "TASKS",    icon: ScrollText },
  { id: "assets",   label: "ASSETS",   icon: Package },
  { id: "stats",    label: "STATS",    icon: BarChart3 },
  { id: "archive",  label: "ARCHIVE",  icon: Archive },
  { id: "goals",    label: "GOALS",    icon: Target },
  { id: "system",   label: "SYSTEM",   icon: Settings },
]

// ═══════════════════════════════════════════════════════════
// Neon Pathway SVG
// ═══════════════════════════════════════════════════════════

function NeonPathways({ activeStep }: { activeStep: number }) {
  // Pathway definitions for 3×2 grid at 33%/50% cell centers
  const paths = [
    // Horizontal: Scout → Forge → Curator
    { d: "M 16.5% 25% L 50% 25%", id: "p1" },
    { d: "M 50% 25% L 83.5% 25%", id: "p2" },
    // Vertical down: Forge → Packager
    { d: "M 50% 25% L 50% 75%", id: "p3" },
    // Horizontal: Popo → Packager → Lister
    { d: "M 16.5% 75% L 50% 75%", id: "p4" },
    { d: "M 50% 75% L 83.5% 75%", id: "p5" },
    // Vertical up: Packager → Forge (feedback)
    { d: "M 50% 75% L 50% 25%", id: "p6", dashed: true },
    // Popo → Scout (command)
    { d: "M 16.5% 75% L 16.5% 25%", id: "p7", dashed: true },
    // Curator → Lister (cross)
    { d: "M 83.5% 25% L 83.5% 75%", id: "p8", dashed: true },
  ]

  // Active paths: main pipeline flow
  const activeStepSet = new Set<number>()
  if (activeStep >= 0) {
    // Scout → Forge
    if (activeStep >= 1) activeStepSet.add(0)
    // Forge → Curator
    if (activeStep >= 2) activeStepSet.add(1)
    // Forge → Packager
    if (activeStep >= 3) activeStepSet.add(2)
    // Popo → Packager
    if (activeStep >= 3) activeStepSet.add(3)
    // Packager → Lister
    if (activeStep >= 4) activeStepSet.add(4)
  }

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
      <defs>
        <filter id="neon-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="neon-glow-strong">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {paths.map((p, i) => {
        const isActive = activeStepSet.has(i)
        const isDashed = p.dashed
        return (
          <g key={p.id}>
            <path
              d={p.d}
              fill="none"
              stroke={isActive ? "#00ff88" : "rgba(0,255,136,0.15)"}
              strokeWidth={isActive ? 2 : 1.5}
              strokeDasharray={isDashed ? "4 6" : isActive ? "none" : "4 8"}
              filter={isActive ? "url(#neon-glow-strong)" : "url(#neon-glow)"}
              className={isActive ? "animate-pulse" : ""}
            />
            {isActive && (
              <circle r="3" fill="#00ff88" filter="url(#neon-glow-strong)"
                className="animate-ping">
                <animateMotion dur="2s" repeatCount="indefinite" path={p.d} />
              </circle>
            )}
          </g>
        )
      })}
      {/* Command center ring around Popo */}
      <rect x="8%" y="63%" width="17%" height="24%" rx="4"
        fill="none" stroke="rgba(255,215,0,0.2)" strokeWidth="1.5"
        strokeDasharray="3 6" filter="url(#neon-glow)" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════
// Room Node
// ═══════════════════════════════════════════════════════════

function RoomNode({
  agent, status, isSelected, onClick, stats,
}: {
  agent: typeof AGENTS[0]
  status: KanbanAgent | undefined
  isSelected: boolean
  onClick: () => void
  stats: StatsData
}) {
  const isWorking = (status?.activeCount ?? 0) > 0
  const isReady = (status?.readyCount ?? 0) > 0 && !isWorking
  const isBlocked = (status?.blockedCount ?? 0) > 0
  const doneCount = status?.doneCount ?? 0

  // Dynamic glow based on status
  const glowColor = isBlocked ? "rgba(255,51,68,0.4)"
    : isWorking ? `${agent.color}66`
    : isReady ? "rgba(0,255,136,0.2)"
    : "rgba(212,160,60,0.1)"

  const borderColor = isBlocked ? "#ff3344"
    : isWorking ? agent.color
    : isSelected ? "#ffd700"
    : "#d4a03c"

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center rounded-lg transition-all duration-500 group"
      style={{
        gridColumn: agent.gridX + 1,
        gridRow: agent.gridY + 1,
        background: `linear-gradient(135deg, rgba(18,18,26,0.95), rgba(10,10,18,0.95))`,
        border: `2px solid ${borderColor}`,
        boxShadow: isWorking || isSelected
          ? `0 0 20px ${glowColor}, inset 0 0 15px ${glowColor}`
          : `0 0 8px ${glowColor}`,
      }}
    >
      {/* Room grid lines */}
      <div className="absolute inset-0 rounded-lg opacity-5"
        style={{
          backgroundImage: "linear-gradient(rgba(212,160,60,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,160,60,0.3) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }} />

      {/* Agent mini sprite */}
      <div className="relative z-10 mb-1">
        <div className="relative">
          <Image
            src={`/sprites/agents/${agent.id}/idle_f0.png`}
            alt={agent.label}
            width={32} height={56}
            className="pixelated"
            unoptimized
          />
          {/* Status indicator dot */}
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-black/50"
            style={{
              backgroundColor: isBlocked ? "#ff3344" : isWorking ? "#00ff88" : isReady ? "#ffaa00" : "#555",
              boxShadow: isWorking ? "0 0 6px #00ff88" : isBlocked ? "0 0 6px #ff3344" : "none",
            }}
          />
        </div>
      </div>

      {/* Label */}
      <span className="font-mono text-[9px] tracking-widest z-10"
        style={{ color: agent.color, textShadow: `0 0 6px ${agent.color}66` }}>
        {agent.label}
      </span>

      {/* Role subtitle */}
      <span className="font-mono text-[7px] text-stone-500 z-10">{agent.role}</span>

      {/* Task counter badge */}
      {doneCount > 0 && (
        <div className="absolute top-1.5 right-1.5 z-10 bg-stone-900/90 border border-stone-700/50 rounded px-1.5 py-0.5">
          <span className="font-mono text-[8px] text-emerald-400">{doneCount}✓</span>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: `radial-gradient(circle at center, ${agent.color}15, transparent 70%)` }} />
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// Popup Window
// ═══════════════════════════════════════════════════════════

function GameWindow({ title, icon, onClose, children }: {
  title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="animate-bounce-in rounded-lg border-2 border-yellow-600/60 bg-stone-900/95 shadow-[0_0_30px_rgba(255,200,50,0.15)] max-w-lg w-[90vw] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-600/30 bg-stone-800/80 rounded-t-lg">
          <div className="flex items-center gap-2 text-sm font-mono text-yellow-300">
            {icon}<span>{title}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-red-900/50 text-stone-400 hover:text-red-400">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-3 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function WorkstationPage() {
  const [kanban, setKanban] = useState<KanbanData | null>(null)
  const [stats, setStats] = useState<StatsData>({ totalAssets: 0, packsCount: 0, cycleCount: 0, revenue: 0 })
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("station")
  const [kanbanLive, setKanbanLive] = useState(false)
  const [cycleCount, setCycleCount] = useState(1)

  // Poll Kanban
  const pollKanban = useCallback(async () => {
    try {
      const res = await fetch("/api/kanban/status")
      if (!res.ok) return
      const data: KanbanData = await res.json()
      if (data.board.totalTasks > 0 || data.pipeline.currentStep >= 0) {
        setKanban(data)
        setKanbanLive(true)
        if (data.pipeline.allDone) setCycleCount(c => c + 1)
      }
    } catch {}
  }, [])

  // Poll Stats
  const pollStats = useCallback(async () => {
    try {
      const res = await fetch("/api/forge/stats")
      if (res.ok) {
        const data = await res.json()
        setStats({
          totalAssets: data.totalAssets ?? 122,
          packsCount: data.packsCount ?? 5,
          cycleCount: data.cycleCount ?? cycleCount,
          revenue: data.revenue ?? 29.99,
        })
      }
    } catch {}
  }, [cycleCount])

  useEffect(() => {
    pollKanban()
    pollStats()
    const interval = setInterval(() => {
      pollKanban()
      pollStats()
    }, 8000)
    return () => clearInterval(interval)
  }, [pollKanban, pollStats])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedAgent(null)
      }
      // Number keys for agents
      const agentIdx = parseInt(e.key) - 1
      if (agentIdx >= 0 && agentIdx < AGENTS.length && !e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
        setSelectedAgent(AGENTS[agentIdx].id)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  const selectedDef = AGENTS.find(a => a.id === selectedAgent)
  const selectedData = selectedAgent ? kanban?.agents[selectedAgent] : undefined

  return (
    <div className="h-screen w-screen bg-[#08080f] text-stone-300 overflow-hidden flex flex-col font-mono">
      {/* ═══════════════ TOP STATS BAR ═══════════════ */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#0a0a16] border-b border-yellow-900/20 text-[11px]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${kanbanLive ? "bg-emerald-500 shadow-[0_0_6px_#00ff88]" : "bg-stone-600"}`} />
            <span className="text-stone-400 tracking-wider text-[10px]">
              {kanbanLive ? "DUNGEON LIVE" : "LOCAL MODE"}
            </span>
          </div>
          <span className="text-stone-700">│</span>
          <div className="flex items-center gap-1.5">
            <Flame className="h-3 w-3 text-orange-500" />
            <span className="text-stone-400">CYCLE</span>
            <span className="text-amber-400 font-bold" style={{ textShadow: "0 0 8px rgba(255,170,0,0.5)" }}>{cycleCount}</span>
          </div>
          <span className="text-stone-700">│</span>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-cyan-400" />
            <span className="text-stone-400">AGENTS</span>
            <span className="text-cyan-400 font-bold" style={{ textShadow: "0 0 6px rgba(0,204,255,0.4)" }}>
              {kanbanLive ? `${Object.values(kanban?.agents ?? {}).filter(a => a.activeCount > 0).length}/5` : "0/5"}
            </span>
          </div>
          <span className="text-stone-700">│</span>
          <div className="flex items-center gap-1.5">
            <Package className="h-3 w-3 text-purple-400" />
            <span className="text-stone-400">PACKS</span>
            <span className="text-purple-400 font-bold">{stats.packsCount}</span>
          </div>
          <span className="text-stone-700">│</span>
          <div className="flex items-center gap-1.5">
            <Coins className="h-3 w-3 text-yellow-500" />
            <span className="text-stone-400">REVENUE</span>
            <span className="text-yellow-400 font-bold">${stats.revenue.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-stone-600">PIPELINE:</span>
          {["SCOUT", "FORGE", "QC", "BUNDLE", "LIST"].map((step, i) => {
            const isActive = kanban?.pipeline.currentStep === i
            const isDone = kanban?.pipeline.currentStep !== undefined && i < (kanban?.pipeline.currentStep ?? -1)
            return (
              <span key={step} className={`transition-colors ${
                isActive ? "text-amber-400 font-bold" : isDone ? "text-emerald-500" : "text-stone-700"
              }`}>
                {step}
              </span>
            )
          })}
        </div>
      </div>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL — Quest Log */}
        <div className="w-56 shrink-0 border-r border-yellow-900/15 bg-[#0a0a14] flex flex-col">
          <div className="px-3 py-2 border-b border-yellow-900/10 flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[10px] font-bold text-stone-400 tracking-widest">QUEST LOG</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {kanbanLive && kanban ? (
              Object.entries(kanban.agents).map(([id, a]) => {
                if (a.activeCount === 0 && a.readyCount === 0 && a.blockedCount === 0) return null
                const agent = AGENTS.find(ag => ag.id === id)
                return (
                  <div key={id}
                    className="rounded p-2 text-[9px] cursor-pointer hover:bg-stone-800/40 transition-colors border border-stone-800/30"
                    style={{ borderLeftColor: agent?.color ?? "#555", borderLeftWidth: 2 }}
                    onClick={() => setSelectedAgent(id)}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold" style={{ color: agent?.color }}>{agent?.label ?? id}</span>
                      <span className={`text-[8px] px-1 rounded ${
                        a.blockedCount > 0 ? "bg-red-950/30 text-red-400"
                        : a.activeCount > 0 ? "bg-emerald-950/30 text-emerald-400"
                        : "bg-amber-950/30 text-amber-400"
                      }`}>
                        {a.blockedCount > 0 ? "⚠" : a.activeCount > 0 ? "▶" : "⏳"}
                      </span>
                    </div>
                    <p className="text-stone-500 truncate">{a.currentTask?.title ?? "Idle"}</p>
                    <div className="flex gap-2 mt-1 text-stone-600">
                      <span>✓{a.doneCount}</span>
                      <span>⏳{a.readyCount}</span>
                      {a.blockedCount > 0 && <span className="text-red-500">⚠{a.blockedCount}</span>}
                    </div>
                  </div>
                )
              }).filter(Boolean)
            ) : (
              <div className="text-center text-stone-600 text-[10px] py-8">
                <Activity className="h-5 w-5 mx-auto mb-2 opacity-30" />
                Awaiting Kanban signal...
              </div>
            )}
            {(!kanbanLive || (kanban && Object.values(kanban.agents).every(a => a.activeCount === 0 && a.readyCount === 0 && a.blockedCount === 0))) && (
              <div className="text-center text-stone-700 text-[9px] py-4">
                All agents idle — dispatch tasks to begin
              </div>
            )}
          </div>
        </div>

        {/* CENTRAL — Factory Floor Grid */}
        <div className="flex-1 relative p-4">
          {/* Neon pathways SVG */}
          <NeonPathways activeStep={kanban?.pipeline.currentStep ?? -1} />

          {/* Agent room grid */}
          <div className="relative z-10 w-full h-full grid gap-3"
            style={{
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(2, 1fr)",
            }}>
            {AGENTS.map(agent => (
              <RoomNode
                key={agent.id}
                agent={agent}
                status={kanban?.agents[agent.id]}
                isSelected={selectedAgent === agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                stats={stats}
              />
            ))}
          </div>

          {/* Floor label */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-stone-800 text-[9px] tracking-[0.3em] font-bold pointer-events-none"
            style={{ textShadow: "0 0 10px rgba(212,160,60,0.1)" }}>
            KAI ASSET FORGE — DUNGEON COMMAND
          </div>
        </div>

        {/* RIGHT PANEL — Detail */}
        <div className="w-64 shrink-0 border-l border-yellow-900/15 bg-[#0a0a14] flex flex-col">
          <div className="px-3 py-2 border-b border-yellow-900/10 flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-stone-400 tracking-widest">DETAILS</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedAgent && selectedDef ? (
              <div className="space-y-3">
                {/* Agent Header */}
                <div className="flex items-center gap-3 pb-2 border-b border-stone-800/50">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ background: `${selectedDef.color}15`, border: `1px solid ${selectedDef.color}33` }}>
                    <Image
                      src={`/sprites/agents/${selectedDef.id}/idle_f0.png`}
                      alt={selectedDef.label}
                      width={40} height={70}
                      className="pixelated"
                      unoptimized
                    />
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: selectedDef.color }}>
                      {selectedDef.label}
                    </div>
                    <div className="text-[10px] text-stone-500">{selectedDef.role}</div>
                  </div>
                </div>

                {/* Status */}
                {selectedData && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                        <div className="text-stone-500 mb-0.5">ACTIVE</div>
                        <div className="text-emerald-400 font-bold text-sm">{selectedData.activeCount}</div>
                      </div>
                      <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                        <div className="text-stone-500 mb-0.5">READY</div>
                        <div className="text-amber-400 font-bold text-sm">{selectedData.readyCount}</div>
                      </div>
                      <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                        <div className="text-stone-500 mb-0.5">DONE</div>
                        <div className="text-cyan-400 font-bold text-sm">{selectedData.doneCount}</div>
                      </div>
                      <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                        <div className="text-stone-500 mb-0.5">BLOCKED</div>
                        <div className={`font-bold text-sm ${selectedData.blockedCount > 0 ? "text-red-400" : "text-stone-600"}`}>
                          {selectedData.blockedCount}
                        </div>
                      </div>
                    </div>

                    {selectedData.currentTask && (
                      <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30 text-[9px]">
                        <div className="text-stone-500 mb-0.5">CURRENT TASK</div>
                        <div className="text-stone-300 break-words">{selectedData.currentTask.title}</div>
                        <div className="text-stone-600 mt-1 font-mono">{selectedData.currentTask.id}</div>
                      </div>
                    )}

                    {/* Progress bar */}
                    {selectedData.activeCount + selectedData.readyCount + selectedData.doneCount > 0 && (
                      <div>
                        <div className="flex justify-between text-[8px] text-stone-500 mb-1">
                          <span>PROGRESS</span>
                          <span>{Math.round((selectedData.doneCount / (selectedData.activeCount + selectedData.readyCount + selectedData.doneCount + selectedData.blockedCount)) * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(selectedData.doneCount / Math.max(1, selectedData.activeCount + selectedData.readyCount + selectedData.doneCount + selectedData.blockedCount)) * 100}%`,
                              background: `linear-gradient(90deg, ${selectedDef.color}, ${selectedDef.color}88)`,
                              boxShadow: `0 0 8px ${selectedDef.color}66`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!selectedData && (
                  <div className="text-center text-stone-600 text-[10px] py-6">
                    <Cpu className="h-6 w-6 mx-auto mb-2 opacity-20" />
                    No active tasks
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-stone-700 text-[10px] py-12">
                <Hammer className="h-8 w-8 mx-auto mb-3 opacity-10" />
                <p className="leading-relaxed">Select an agent<br />to view details</p>
                <p className="text-stone-800 mt-2 text-[8px]">Press 1-6 to select</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════ BOTTOM TAB BAR ═══════════════ */}
      <div className="shrink-0 flex border-t border-yellow-900/20 bg-[#0a0a16]">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          // Calculate tab counts
          let count: number | undefined
          if (tab.id === "agents") count = AGENTS.length
          if (tab.id === "tasks") count = kanban?.board.totalTasks
          if (tab.id === "assets") count = stats.totalAssets
          if (tab.id === "goals") count = 0

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-all duration-200 text-[10px] tracking-wider ${
                isActive
                  ? "bg-stone-900/80 text-amber-400 border-t-2 border-amber-500"
                  : "text-stone-600 hover:text-stone-400 hover:bg-stone-900/30"
              }`}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{tab.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`text-[8px] px-1 rounded ${isActive ? "bg-amber-950/30 text-amber-400" : "bg-stone-800/50 text-stone-500"}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ═══════════════ BOTTOM TAB CONTENT ═══════════════ */}
      {activeTab !== "station" && (
        <div className="shrink-0 h-32 bg-[#0a0a14] border-t border-yellow-900/10 p-3 overflow-y-auto">
          {activeTab === "agents" && (
            <div className="grid grid-cols-6 gap-2 text-[9px]">
              {AGENTS.map(a => {
                const d = kanban?.agents[a.id]
                return (
                  <button key={a.id}
                    onClick={() => { setSelectedAgent(a.id); setActiveTab("station") }}
                    className="bg-stone-900/50 rounded p-2 border border-stone-800/30 hover:border-stone-600/50 transition-colors text-left">
                    <span className="font-bold" style={{ color: a.color }}>{a.label}</span>
                    <div className="text-stone-500 mt-0.5">
                      {d ? `✓${d.doneCount} ▶${d.activeCount} ⏳${d.readyCount}` : "offline"}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          {activeTab === "tasks" && (
            <div className="text-[10px] text-stone-400">
              <span className="text-emerald-400 font-bold">{kanban?.board.doneTotal ?? 0}</span> done ·
              <span className="text-red-400 font-bold ml-2">{kanban?.board.blockedTotal ?? 0}</span> blocked ·
              <span className="text-amber-400 font-bold ml-2">{kanban?.board.totalTasks ?? 0}</span> total tasks
              {(!kanbanLive || (kanban?.board.totalTasks ?? 0) === 0) && (
                <p className="text-stone-600 mt-1">No tasks on Kanban board. Dispatch from Hermes CLI.</p>
              )}
            </div>
          )}
          {activeTab === "assets" && (
            <div className="text-[10px] text-stone-400">
              <span className="text-purple-400 font-bold">{stats.totalAssets}</span> assets across 7 categories
              <div className="flex gap-3 mt-2 text-[9px]">
                {["Characters", "Tiles", "Furniture", "Weapons", "Props", "UI", "Creative"].map(cat => (
                  <span key={cat} className="bg-stone-900/50 rounded px-2 py-1 border border-stone-800/30">{cat}</span>
                ))}
              </div>
            </div>
          )}
          {activeTab === "stats" && (
            <div className="grid grid-cols-4 gap-2 text-[10px]">
              <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                <div className="text-stone-500">Cycles</div>
                <div className="text-amber-400 font-bold text-lg">{cycleCount}</div>
              </div>
              <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                <div className="text-stone-500">Assets</div>
                <div className="text-purple-400 font-bold text-lg">{stats.totalAssets}</div>
              </div>
              <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                <div className="text-stone-500">Packs</div>
                <div className="text-cyan-400 font-bold text-lg">{stats.packsCount}</div>
              </div>
              <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                <div className="text-stone-500">Revenue</div>
                <div className="text-emerald-400 font-bold text-lg">${stats.revenue}</div>
              </div>
            </div>
          )}
          {activeTab === "archive" && (
            <div className="text-[10px] text-stone-500 text-center py-4">
              <Archive className="h-5 w-5 mx-auto mb-1 opacity-20" />
              Cycle archives will appear here
            </div>
          )}
          {activeTab === "goals" && (
            <div className="text-[10px] text-stone-500 text-center py-4">
              <Target className="h-5 w-5 mx-auto mb-1 opacity-20" />
              Production goals coming soon
            </div>
          )}
          {activeTab === "system" && (
            <div className="text-[10px] text-stone-400 space-y-1">
              <div>Hermes CLI: <span className={kanbanLive ? "text-emerald-400" : "text-red-400"}>{kanbanLive ? "ONLINE" : "OFFLINE"}</span></div>
              <div>Kanban poll: 8s interval</div>
              <div>Vercel: https://kai-asset-forge-hub.vercel.app</div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ AGENT DETAIL POPUP ═══════════════ */}
      {selectedAgent && selectedDef && (
        <GameWindow
          title={`${selectedDef.label} · ${selectedDef.role}`}
          icon={<span>{selectedDef.icon}</span>}
          onClose={() => setSelectedAgent(null)}
        >
          <div className="space-y-3">
            {/* Agent card */}
            <div className="flex items-center gap-3 p-3 rounded-lg border"
              style={{ borderColor: `${selectedDef.color}33`, background: `${selectedDef.color}08` }}>
              <Image
                src={`/sprites/agents/${selectedDef.id}/idle_f0.png`}
                alt={selectedDef.label}
                width={48} height={84}
                className="pixelated"
                unoptimized
              />
              <div>
                <div className="font-bold text-sm" style={{ color: selectedDef.color }}>{selectedDef.label}</div>
                <div className="text-stone-500 text-[10px]">{selectedDef.role}</div>
                <div className="text-stone-600 text-[9px] mt-1">Room [{selectedDef.gridX},{selectedDef.gridY}]</div>
              </div>
            </div>

            {/* Stats grid */}
            {selectedData && (
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                  <div className="text-stone-500">Active Tasks</div>
                  <div className="text-emerald-400 font-bold text-base">{selectedData.activeCount}</div>
                </div>
                <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                  <div className="text-stone-500">Ready Tasks</div>
                  <div className="text-amber-400 font-bold text-base">{selectedData.readyCount}</div>
                </div>
                <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                  <div className="text-stone-500">Completed</div>
                  <div className="text-cyan-400 font-bold text-base">{selectedData.doneCount}</div>
                </div>
                <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                  <div className="text-stone-500">Blocked</div>
                  <div className={`font-bold text-base ${selectedData.blockedCount > 0 ? "text-red-400" : "text-stone-600"}`}>
                    {selectedData.blockedCount}
                  </div>
                </div>
              </div>
            )}

            {selectedData?.currentTask && (
              <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30 text-[9px]">
                <div className="text-stone-500 mb-1">Current Task</div>
                <div className="text-stone-300 break-words">{selectedData.currentTask.title}</div>
                <div className="text-stone-600 mt-1 text-[8px]">{selectedData.currentTask.id}</div>
              </div>
            )}

            {!selectedData && (
              <div className="text-center text-stone-600 text-[10px] py-4">
                No Kanban data available for this agent
              </div>
            )}
          </div>
        </GameWindow>
      )}
    </div>
  )
}
