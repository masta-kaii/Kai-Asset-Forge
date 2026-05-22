"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import {
  Zap, X, Activity, ScrollText, Cpu, Flame,
  Hammer, Eye, Package, Archive, Target, BarChart3,
  Settings, Wrench, Gem, Coins, Play, Pause, Volume2, VolumeX,
  ChevronRight, Clock,
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

interface AssetItem {
  name: string
  category: string
  type: string
  filename: string
  url: string
  siblingFrames?: { name: string; url: string }[]
}

interface CycleArchive {
  id: number
  completedAt: string
  totalAssets: number
  packsCount: number
  revenue: number
  steps: string[]
}

interface WalkState {
  agentId: string
  fromX: number; fromY: number
  toX: number; toY: number
  progress: number
  frame: number
}

const AGENTS = [
  { id: "scout",    label: "SCOUT",    role: "Discovery", icon: "🔍", color: "#00ccff", gridX: 0, gridY: 0 },
  { id: "forge",    label: "FORGE",    role: "Production", icon: "⚒️", color: "#ff6600", gridX: 1, gridY: 0 },
  { id: "curator",  label: "CURATOR",  role: "Quality",    icon: "🔬", color: "#aa55ff", gridX: 2, gridY: 0 },
  { id: "popo",     label: "POPO",     role: "Commander",  icon: "👑", color: "#ffd700", gridX: 0, gridY: 1 },
  { id: "packager", label: "PACKAGER", role: "Assembly",   icon: "📦", color: "#ffaa00", gridX: 1, gridY: 1 },
  { id: "lister",   label: "LISTER",   role: "Commerce",   icon: "📋", color: "#00ff88", gridX: 2, gridY: 1 },
] as const

const PIPELINE_ORDER = ["scout", "forge", "curator", "packager", "lister"] as const
const PIPELINE_STEP_LABELS = ["SCOUT", "FORGE", "QC", "BUNDLE", "LIST"]

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

const PATHWAY_DEFS = [
  { d: "M 16.5% 25% L 50% 25%", id: "p1", fromAgent: "scout", toAgent: "forge" },
  { d: "M 50% 25% L 83.5% 25%", id: "p2", fromAgent: "forge", toAgent: "curator" },
  { d: "M 50% 25% L 50% 75%", id: "p3", fromAgent: "forge", toAgent: "packager" },
  { d: "M 16.5% 75% L 50% 75%", id: "p4", fromAgent: "popo", toAgent: "packager" },
  { d: "M 50% 75% L 83.5% 75%", id: "p5", fromAgent: "packager", toAgent: "lister" },
]

// ═══════════════════════════════════════════════════════════
// Sound Engine (Web Audio API — no external deps)
// ═══════════════════════════════════════════════════════════

let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playBeep(freq: number, duration: number, type: OscillatorType = "square", vol = 0.06) {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.value = vol
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {}
}

function sfxStepComplete() { playBeep(880, 0.08, "square", 0.05); setTimeout(() => playBeep(1100, 0.12, "square", 0.06), 80) }
function sfxForgeClang() { playBeep(220, 0.15, "triangle", 0.07); setTimeout(() => playBeep(330, 0.2, "triangle", 0.05), 100) }
function sfxCycleComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playBeep(f, 0.2, "square", 0.05), i * 120)) }
function sfxAgentClick() { playBeep(660, 0.05, "sine", 0.04) }

// ═══════════════════════════════════════════════════════════
// Neon Pathway SVG with Walking Agents
// ═══════════════════════════════════════════════════════════

function NeonPathways({ activeStep, walks }: { activeStep: number; walks: WalkState[] }) {
  const activeStepSet = new Set<number>()
  if (activeStep >= 1) activeStepSet.add(0)
  if (activeStep >= 2) activeStepSet.add(1)
  if (activeStep >= 3) { activeStepSet.add(2); activeStepSet.add(3) }
  if (activeStep >= 4) activeStepSet.add(4)

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <filter id="neon-glow">
          <feGaussianBlur stdDeviation="0.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="neon-glow-strong">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {PATHWAY_DEFS.map((p, i) => {
        const isActive = activeStepSet.has(i)
        return (
          <g key={p.id}>
            <path d={p.d} fill="none"
              stroke={isActive ? "#00ff88" : "rgba(0,255,136,0.12)"}
              strokeWidth={isActive ? 0.6 : 0.4}
              strokeDasharray={isActive ? "none" : "1 2"}
              filter={isActive ? "url(#neon-glow-strong)" : "url(#neon-glow)"}
            />
          </g>
        )
      })}
      {/* Walking agent dots */}
      {walks.map(w => {
        const def = PATHWAY_DEFS.find(p => p.fromAgent === w.agentId || p.toAgent === w.agentId)
        if (!def) return null
        // Parse SVG path to get position at progress
        const pos = getPathPointAt(def.d, w.progress)
        const agent = AGENTS.find(a => a.id === w.agentId)
        return (
          <g key={`walk-${w.agentId}`} transform={`translate(${pos.x}, ${pos.y})`}>
            <circle r="1.5" fill={agent?.color ?? "#fff"} filter="url(#neon-glow-strong)" opacity={0.9} />
            <text x="-1" y="-2" fontSize="1.4" fill={agent?.color ?? "#fff"} fontFamily="monospace" textAnchor="middle"
              style={{ textShadow: `0 0 2px ${agent?.color}` }}>
              {agent?.icon ?? "•"}
            </text>
          </g>
        )
      })}
      <rect x="8%" y="63%" width="17%" height="24%" rx="1"
        fill="none" stroke="rgba(255,215,0,0.15)" strokeWidth="0.4"
        strokeDasharray="1 2" filter="url(#neon-glow)" />
    </svg>
  )
}

function getPathPointAt(d: string, t: number): { x: number; y: number } {
  // Parse simple "M x% y% L x% y%" path
  const m = d.match(/M\s+([\d.]+)%?\s+([\d.]+)%?\s+L\s+([\d.]+)%?\s+([\d.]+)%?/)
  if (!m) return { x: 50, y: 50 }
  const [_, x1, y1, x2, y2] = m.map(Number)
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t }
}

// ═══════════════════════════════════════════════════════════
// Room Node
// ═══════════════════════════════════════════════════════════

function RoomNode({
  agent, status, isSelected, onClick, isWalkingAway,
}: {
  agent: { id: string; label: string; role: string; icon: string; color: string; gridX: number; gridY: number }
  status: KanbanAgent | undefined
  isSelected: boolean
  onClick: () => void
  isWalkingAway: boolean
}) {
  const isWorking = (status?.activeCount ?? 0) > 0
  const isReady = (status?.readyCount ?? 0) > 0 && !isWorking
  const isBlocked = (status?.blockedCount ?? 0) > 0
  const doneCount = status?.doneCount ?? 0

  const glowColor = isBlocked ? "rgba(255,51,68,0.5)"
    : isWorking ? `${agent.color}66`
    : isReady ? "rgba(0,255,136,0.25)"
    : "rgba(212,160,60,0.1)"

  const borderColor = isBlocked ? "#ff3344"
    : isWorking ? agent.color
    : isSelected ? "#ffd700"
    : "#d4a03c"

  return (
    <button onClick={() => { onClick(); sfxAgentClick() }}
      className="relative flex flex-col items-center justify-center rounded-lg transition-all duration-500 group"
      style={{
        gridColumn: agent.gridX + 1, gridRow: agent.gridY + 1,
        background: `linear-gradient(135deg, rgba(18,18,26,0.95), rgba(10,10,18,0.95))`,
        border: `2px solid ${borderColor}`,
        boxShadow: isWorking || isSelected
          ? `0 0 20px ${glowColor}, inset 0 0 15px ${glowColor}`
          : `0 0 8px ${glowColor}`,
      }}>
      <div className="absolute inset-0 rounded-lg opacity-5" style={{
        backgroundImage: "linear-gradient(rgba(212,160,60,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,160,60,0.3) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }} />

      <div className="relative z-10 mb-1">
        <div className="relative">
          <Image src={`/sprites/agents/${agent.id}/idle_f0.png`} alt={agent.label}
            width={32} height={56} className={`pixelated ${isWalkingAway ? "opacity-30" : ""}`} unoptimized />
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-black/50" style={{
            backgroundColor: isBlocked ? "#ff3344" : isWorking ? "#00ff88" : isReady ? "#ffaa00" : "#555",
            boxShadow: isWorking ? "0 0 6px #00ff88" : isBlocked ? "0 0 6px #ff3344" : "none",
          }} />
        </div>
      </div>

      <span className="font-mono text-[9px] tracking-widest z-10" style={{ color: agent.color, textShadow: `0 0 6px ${agent.color}66` }}>
        {agent.label}
      </span>
      <span className="font-mono text-[7px] text-stone-500 z-10">{agent.role}</span>

      {doneCount > 0 && (
        <div className="absolute top-1.5 right-1.5 z-10 bg-stone-900/90 border border-stone-700/50 rounded px-1.5 py-0.5">
          <span className="font-mono text-[8px] text-emerald-400">{doneCount}✓</span>
        </div>
      )}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-bounce-in rounded-lg border-2 border-yellow-600/60 bg-stone-900/95 shadow-[0_0_30px_rgba(255,200,50,0.15)] max-w-lg w-[90vw] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-600/30 bg-stone-800/80 rounded-t-lg">
          <div className="flex items-center gap-2 text-sm font-mono text-yellow-300">{icon}<span>{title}</span></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-red-900/50 text-stone-400 hover:text-red-400"><X className="size-4" /></button>
        </div>
        <div className="p-3 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Asset Thumbnail
// ═══════════════════════════════════════════════════════════

function AssetThumb({ asset, onClick }: { asset: AssetItem; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <button onClick={onClick}
      className="group relative bg-stone-900/50 rounded-lg border border-stone-800/30 hover:border-yellow-600/40 hover:bg-stone-800/50 transition-all p-2 text-left">
      <div className="flex justify-center mb-1.5">
        {!loaded && <div className="w-12 h-12 bg-stone-800 animate-pulse rounded" />}
        <Image src={asset.url} alt={asset.name}
          width={48} height={48}
          className={`pixelated rounded ${loaded ? "" : "hidden"}`}
          unoptimized
          onLoad={() => setLoaded(true)}
        />
      </div>
      <p className="text-stone-400 text-[8px] font-mono truncate">{asset.name}</p>
      <p className="text-stone-600 text-[7px] font-mono capitalize">{asset.category}</p>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function WorkstationPage() {
  const [kanban, setKanban] = useState<KanbanData | null>(null)
  const [stats, setStats] = useState<StatsData>({ totalAssets: 122, packsCount: 5, cycleCount: 0, revenue: 29.99 })
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("station")
  const [kanbanLive, setKanbanLive] = useState(false)
  const [cycleCount, setCycleCount] = useState(1)
  const [soundOn, setSoundOn] = useState(true)
  const [pipelinePaused, setPipelinePaused] = useState(false)

  // Walking agents
  const [walks, setWalks] = useState<WalkState[]>([])
  const walkRef = useRef<WalkState[]>([])
  walkRef.current = walks

  // Asset library
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null)
  const [assetCategory, setAssetCategory] = useState("all")

  // Cycle archive
  const [archive, setArchive] = useState<CycleArchive[]>([])
  const prevPipelineRef = useRef<number>(-1)
  const prevAllDoneRef = useRef(false)

  // Audio context init on first interaction
  const initAudio = useCallback(() => { getAudioCtx() }, [])

  // Poll Kanban
  const pollKanban = useCallback(async () => {
    if (pipelinePaused) return
    try {
      const res = await fetch("/api/kanban/status")
      if (!res.ok) return
      const data: KanbanData = await res.json()
      if (data.board.totalTasks > 0 || data.pipeline.currentStep >= 0) {
        setKanbanLive(true)

        // Detect step change → trigger walk animation
        const oldStep = prevPipelineRef.current
        const newStep = data.pipeline.currentStep

        if (newStep !== oldStep && newStep >= 0 && oldStep >= 0) {
          const fromAgent = PIPELINE_ORDER[Math.max(0, oldStep)]
          const toAgent = PIPELINE_ORDER[Math.min(PIPELINE_ORDER.length - 1, newStep)]

          if (fromAgent !== toAgent) {
            const fromA = AGENTS.find(a => a.id === fromAgent)
            if (fromA) {
              if (soundOn) sfxStepComplete()
              const walk: WalkState = {
                agentId: fromAgent,
                fromX: fromA.gridX * 33.3 + 16.5,
                fromY: fromA.gridY * 50 + 25,
                toX: fromA.gridX * 33.3 + 16.5,
                toY: fromA.gridY * 50 + 25,
                progress: 0,
                frame: 0,
              }
              setWalks(prev => [...prev.filter(w => w.agentId !== fromAgent), walk])
              // Animate walk
              let prog = 0
              const anim = setInterval(() => {
                prog += 0.04
                if (prog >= 1) {
                  clearInterval(anim)
                  setWalks(prev => prev.filter(w => w.agentId !== fromAgent))
                } else {
                  setWalks(prev => prev.map(w => w.agentId === fromAgent
                    ? { ...w, progress: prog, frame: (w.frame + 1) % 4 } : w))
                }
              }, 50)
            }
          }
        }

        // Forge step = clang
        if (newStep === 1 && oldStep !== 1 && soundOn) setTimeout(sfxForgeClang, 400)

        // Cycle complete
        if (data.pipeline.allDone && !prevAllDoneRef.current) {
          const cyc = cycleCount
          setCycleCount(c => c + 1)
          if (soundOn) sfxCycleComplete()
          setArchive(prev => [{
            id: cyc,
            completedAt: new Date().toISOString(),
            totalAssets: stats.totalAssets,
            packsCount: stats.packsCount,
            revenue: stats.revenue,
            steps: PIPELINE_STEP_LABELS.map((s, i) => i <= (prevPipelineRef.current >= 0 ? prevPipelineRef.current : 0) ? s : s),
          }, ...prev].slice(0, 20))
        }

        prevPipelineRef.current = newStep
        prevAllDoneRef.current = data.pipeline.allDone
        setKanban(data)
      }
    } catch {}
  }, [pipelinePaused, soundOn, cycleCount, stats])

  // Poll Stats
  const pollStats = useCallback(async () => {
    try {
      const res = await fetch("/api/forge/stats")
      if (res.ok) {
        const data = await res.json()
        setStats({ totalAssets: data.totalAssets ?? 122, packsCount: data.packsCount ?? 5, cycleCount: data.cycleCount ?? cycleCount, revenue: data.revenue ?? 29.99 })
      }
    } catch {}
  }, [cycleCount])

  // Fetch assets for library
  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/forge/assets?category=all`)
      if (res.ok) {
        const data = await res.json()
        const all: AssetItem[] = []
        if (data.assets) {
          for (const cat of Object.values(data.assets) as AssetItem[][]) {
            all.push(...cat)
          }
        }
        setAssets(all)
      }
    } catch {}
  }, [])

  useEffect(() => {
    pollKanban(); pollStats(); fetchAssets()
    const interval = setInterval(() => { pollKanban(); pollStats() }, 8000)
    return () => clearInterval(interval)
  }, [pollKanban, pollStats, fetchAssets])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setSelectedAgent(null); setSelectedAsset(null) }
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx < AGENTS.length && !e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
        setSelectedAgent(AGENTS[idx].id)
      }
      if (e.key === " " && !e.ctrlKey) { e.preventDefault(); setPipelinePaused(p => !p) }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  const selectedDef = AGENTS.find(a => a.id === selectedAgent)
  const selectedData = selectedAgent ? kanban?.agents[selectedAgent] : undefined
  const filteredAssets = useMemo(() =>
    assetCategory === "all" ? assets : assets.filter(a => a.category === assetCategory),
    [assets, assetCategory]
  )
  const categories = useMemo(() => {
    const cats = new Map<string, number>()
    for (const a of assets) cats.set(a.category, (cats.get(a.category) ?? 0) + 1)
    return Array.from(cats.entries())
  }, [assets])

  return (
    <div className="h-screen w-screen bg-[#08080f] text-stone-300 overflow-hidden flex flex-col font-mono" onClick={initAudio}>
      {/* ═══ TOP STATS BAR ═══ */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#0a0a16] border-b border-yellow-900/20 text-[11px]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${kanbanLive ? "bg-emerald-500 shadow-[0_0_6px_#00ff88]" : "bg-stone-600"}`} />
            <span className="text-stone-400 tracking-wider text-[10px]">{kanbanLive ? "DUNGEON LIVE" : "LOCAL MODE"}</span>
          </div>
          <span className="text-stone-700">│</span>
          <div className="flex items-center gap-1.5">
            <Flame className="h-3 w-3 text-orange-500" />
            <span className="text-stone-400">CYCLE</span>
            <span className="text-amber-400 font-bold">{cycleCount}</span>
          </div>
          <span className="text-stone-700">│</span>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-cyan-400" />
            <span className="text-stone-400">AGENTS</span>
            <span className="text-cyan-400 font-bold">
              {kanbanLive ? `${Object.values(kanban?.agents ?? {}).filter(a => a.activeCount > 0).length}/5` : "—"}
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
            <span className="text-stone-400">REV</span>
            <span className="text-yellow-400 font-bold">${stats.revenue.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <button onClick={() => setSoundOn(s => !s)} className="p-1 hover:text-stone-300 text-stone-600" title="Toggle sound">
            {soundOn ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          </button>
          <button onClick={() => setPipelinePaused(p => !p)} className={`p-1 ${pipelinePaused ? "text-red-400" : "text-stone-600"} hover:text-stone-300`} title="Pause pipeline">
            {pipelinePaused ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
          <span className="text-stone-600">PIPE:</span>
          {PIPELINE_STEP_LABELS.map((step, i) => {
            const isActive = kanban?.pipeline.currentStep === i
            const isDone = kanban?.pipeline.currentStep !== undefined && i < (kanban?.pipeline.currentStep ?? -1)
            return <span key={step} className={`transition-colors ${isActive ? "text-amber-400 font-bold" : isDone ? "text-emerald-500" : "text-stone-700"}`}>{step}</span>
          })}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT — Quest Log */}
        <div className="w-56 shrink-0 border-r border-yellow-900/15 bg-[#0a0a14] flex flex-col">
          <div className="px-3 py-2 border-b border-yellow-900/10 flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[10px] font-bold text-stone-400 tracking-widest">QUEST LOG</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {kanbanLive && kanban ? (
              Object.entries(kanban.agents).map(([id, a]) => {
                if (a.activeCount === 0 && a.readyCount === 0 && a.blockedCount === 0 && a.doneCount === 0) return null
                const agent = AGENTS.find(ag => ag.id === id)
                const isWalking = walks.some(w => w.agentId === id)
                return (
                  <div key={id} className="rounded p-2 text-[9px] cursor-pointer hover:bg-stone-800/40 transition-colors border border-stone-800/30"
                    style={{ borderLeftColor: agent?.color ?? "#555", borderLeftWidth: 2 }}
                    onClick={() => setSelectedAgent(id)}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold flex items-center gap-1" style={{ color: agent?.color }}>
                        {agent?.label ?? id}
                        {isWalking && <span className="text-[7px] animate-pulse">🚶</span>}
                      </span>
                      <span className={`text-[8px] px-1 rounded ${a.blockedCount > 0 ? "bg-red-950/30 text-red-400" : a.activeCount > 0 ? "bg-emerald-950/30 text-emerald-400" : a.readyCount > 0 ? "bg-amber-950/30 text-amber-400" : "bg-stone-900/30 text-stone-500"}`}>
                        {a.blockedCount > 0 ? "⚠" : a.activeCount > 0 ? "▶" : a.readyCount > 0 ? "⏳" : "✓"}
                      </span>
                    </div>
                    <p className="text-stone-500 truncate">{a.currentTask?.title ?? (a.doneCount > 0 ? `${a.doneCount} completed` : "Idle")}</p>
                    <div className="flex gap-2 mt-1 text-stone-600">
                      <span>✓{a.doneCount}</span><span>⏳{a.readyCount}</span>
                      {a.blockedCount > 0 && <span className="text-red-500">⚠{a.blockedCount}</span>}
                    </div>
                  </div>
                )
              }).filter(Boolean)
            ) : (
              <div className="text-center text-stone-600 text-[10px] py-8">
                <Activity className="h-5 w-5 mx-auto mb-2 opacity-30" />Awaiting signal...
              </div>
            )}
          </div>
        </div>

        {/* CENTRAL — Factory Floor */}
        <div className="flex-1 relative p-4">
          <NeonPathways activeStep={kanban?.pipeline.currentStep ?? -1} walks={walks} />
          <div className="relative z-10 w-full h-full grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(2, 1fr)" }}>
            {AGENTS.map(agent => (
              <RoomNode key={agent.id} agent={agent} status={kanban?.agents[agent.id]}
                isSelected={selectedAgent === agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                isWalkingAway={walks.some(w => w.agentId === agent.id)}
              />
            ))}
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-stone-800 text-[9px] tracking-[0.3em] font-bold pointer-events-none">
            KAI ASSET FORGE — DUNGEON COMMAND
          </div>
        </div>

        {/* RIGHT — Detail Panel */}
        <div className="w-64 shrink-0 border-l border-yellow-900/15 bg-[#0a0a14] flex flex-col">
          <div className="px-3 py-2 border-b border-yellow-900/10 flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-stone-400 tracking-widest">DETAILS</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedAgent && selectedDef ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 pb-2 border-b border-stone-800/50">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: `${selectedDef.color}15`, border: `1px solid ${selectedDef.color}33` }}>
                    <Image src={`/sprites/agents/${selectedDef.id}/idle_f0.png`} alt={selectedDef.label} width={40} height={70} className="pixelated" unoptimized />
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: selectedDef.color }}>{selectedDef.label}</div>
                    <div className="text-[10px] text-stone-500">{selectedDef.role}</div>
                    {walks.some(w => w.agentId === selectedDef.id) && <div className="text-[8px] text-amber-400 animate-pulse mt-0.5">🚶 Walking...</div>}
                  </div>
                </div>
                {selectedData && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      {[{ label: "ACTIVE", val: selectedData.activeCount, color: "text-emerald-400" },
                        { label: "READY", val: selectedData.readyCount, color: "text-amber-400" },
                        { label: "DONE", val: selectedData.doneCount, color: "text-cyan-400" },
                        { label: "BLOCKED", val: selectedData.blockedCount, color: selectedData.blockedCount > 0 ? "text-red-400" : "text-stone-600" }]
                        .map(s => (
                          <div key={s.label} className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                            <div className="text-stone-500 mb-0.5">{s.label}</div>
                            <div className={`font-bold text-sm ${s.color}`}>{s.val}</div>
                          </div>
                        ))}
                    </div>
                    {selectedData.currentTask && (
                      <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30 text-[9px]">
                        <div className="text-stone-500 mb-0.5">TASK</div>
                        <div className="text-stone-300 break-words">{selectedData.currentTask.title}</div>
                        <div className="text-stone-600 mt-1 text-[8px]">{selectedData.currentTask.id}</div>
                      </div>
                    )}
                    {selectedData.activeCount + selectedData.readyCount + selectedData.doneCount > 0 && (
                      <div>
                        <div className="flex justify-between text-[8px] text-stone-500 mb-1"><span>PROGRESS</span>
                          <span>{Math.round((selectedData.doneCount / Math.max(1, selectedData.activeCount + selectedData.readyCount + selectedData.doneCount + selectedData.blockedCount)) * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${(selectedData.doneCount / Math.max(1, selectedData.activeCount + selectedData.readyCount + selectedData.doneCount + selectedData.blockedCount)) * 100}%`,
                              background: `linear-gradient(90deg, ${selectedDef.color}, ${selectedDef.color}88)`, boxShadow: `0 0 8px ${selectedDef.color}66` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!selectedData && (
                  <div className="text-center text-stone-600 text-[10px] py-6"><Cpu className="h-6 w-6 mx-auto mb-2 opacity-20" />No active tasks</div>
                )}
                {/* Mini asset preview for this agent */}
                {assets.length > 0 && (
                  <div className="pt-2 border-t border-stone-800/30">
                    <div className="text-[8px] text-stone-600 mb-1.5">LATEST ASSETS</div>
                    <div className="grid grid-cols-3 gap-1">
                      {assets.slice(0, 6).map(a => (
                        <Image key={a.filename} src={a.url} alt={a.name} width={32} height={32} className="pixelated rounded border border-stone-800/30" unoptimized />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : selectedAsset ? (
              <div className="space-y-2">
                <button onClick={() => setSelectedAsset(null)} className="text-[9px] text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 rotate-180" /> Back
                </button>
                <div className="flex justify-center p-2 bg-stone-900/50 rounded border border-stone-800/30">
                  <Image src={selectedAsset.url} alt={selectedAsset.name} width={96} height={96} className="pixelated rounded" unoptimized />
                </div>
                <div className="text-[10px] font-bold text-stone-300">{selectedAsset.name}</div>
                <div className="text-[9px] text-stone-500 capitalize">{selectedAsset.category} · {selectedAsset.type}</div>
              </div>
            ) : (
              <div className="text-center text-stone-700 text-[10px] py-12">
                <Hammer className="h-8 w-8 mx-auto mb-3 opacity-10" />
                <p>Select agent<br />or asset</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM TAB BAR ═══ */}
      <div className="shrink-0 flex border-t border-yellow-900/20 bg-[#0a0a16]">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          let count: number | undefined
          if (tab.id === "agents") count = AGENTS.length
          if (tab.id === "tasks") count = kanban?.board.totalTasks
          if (tab.id === "assets") count = stats.totalAssets
          if (tab.id === "archive") count = archive.length
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedAsset(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-all duration-200 text-[10px] tracking-wider ${
                isActive ? "bg-stone-900/80 text-amber-400 border-t-2 border-amber-500" : "text-stone-600 hover:text-stone-400 hover:bg-stone-900/30"
              }`}>
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{tab.label}</span>
              {count !== undefined && count > 0 && <span className={`text-[8px] px-1 rounded ${isActive ? "bg-amber-950/30 text-amber-400" : "bg-stone-800/50 text-stone-500"}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ═══ TAB CONTENT PANEL ═══ */}
      {activeTab !== "station" && (
        <div className="shrink-0 h-40 bg-[#0a0a14] border-t border-yellow-900/10 p-3 overflow-y-auto">
          {/* AGENTS tab */}
          {activeTab === "agents" && (
            <div className="grid grid-cols-6 gap-2 text-[9px]">
              {AGENTS.map(a => {
                const d = kanban?.agents[a.id]
                return (
                  <button key={a.id} onClick={() => { setSelectedAgent(a.id); setActiveTab("station") }}
                    className="bg-stone-900/50 rounded p-2 border border-stone-800/30 hover:border-stone-600/50 transition-colors text-left">
                    <span className="font-bold" style={{ color: a.color }}>{a.label}</span>
                    <div className="text-stone-500 mt-0.5">{d ? `✓${d.doneCount} ▶${d.activeCount}` : "offline"}</div>
                  </button>
                )
              })}
            </div>
          )}

          {/* TASKS tab */}
          {activeTab === "tasks" && (
            <div className="text-[10px] text-stone-400">
              <span className="text-emerald-400 font-bold">{kanban?.board.doneTotal ?? 0}</span> done ·
              <span className="text-red-400 font-bold ml-2">{kanban?.board.blockedTotal ?? 0}</span> blocked ·
              <span className="text-amber-400 font-bold ml-2">{kanban?.board.totalTasks ?? 0}</span> total
              {kanban?.agents && Object.values(kanban.agents).some(a => a.currentTask) && (
                <div className="mt-2 space-y-1">
                  {Object.entries(kanban.agents).map(([id, a]) => a.currentTask && (
                    <div key={id} className="flex items-center gap-2 text-[9px]">
                      <span style={{ color: AGENTS.find(ag => ag.id === id)?.color }}>{AGENTS.find(ag => ag.id === id)?.label ?? id}</span>
                      <ChevronRight className="h-2 w-2 text-stone-600" />
                      <span className="text-stone-400 truncate">{a.currentTask.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ASSETS tab — OUR FORGED ASSETS! */}
          {activeTab === "assets" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setAssetCategory("all")}
                  className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${assetCategory === "all" ? "border-amber-500/50 bg-amber-950/20 text-amber-400" : "border-stone-800/30 text-stone-500 hover:text-stone-300"}`}>
                  ALL ({assets.length})
                </button>
                {categories.map(([cat, count]) => (
                  <button key={cat} onClick={() => setAssetCategory(cat)}
                    className={`text-[9px] px-2 py-0.5 rounded border transition-colors capitalize ${assetCategory === cat ? "border-amber-500/50 bg-amber-950/20 text-amber-400" : "border-stone-800/30 text-stone-500 hover:text-stone-300"}`}>
                    {cat} ({count})
                  </button>
                ))}
              </div>
              {filteredAssets.length > 0 ? (
                <div className="grid grid-cols-8 gap-1.5">
                  {filteredAssets.slice(0, 40).map(a => (
                    <AssetThumb key={a.filename} asset={a} onClick={() => { setSelectedAsset(a); setActiveTab("station") }} />
                  ))}
                </div>
              ) : (
                <div className="text-center text-stone-600 text-[10px] py-4">
                  <Package className="h-5 w-5 mx-auto mb-1 opacity-20" />
                  {assets.length === 0 ? "Fetching assets..." : "No assets in this category"}
                </div>
              )}
            </div>
          )}

          {/* STATS tab */}
          {activeTab === "stats" && (
            <div className="grid grid-cols-4 gap-2 text-[10px]">
              {[{ label: "Cycles", val: cycleCount, color: "text-amber-400" },
                { label: "Assets", val: stats.totalAssets, color: "text-purple-400" },
                { label: "Packs", val: stats.packsCount, color: "text-cyan-400" },
                { label: "Revenue", val: `$${stats.revenue}`, color: "text-emerald-400" }]
                .map(s => (
                  <div key={s.label} className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                    <div className="text-stone-500">{s.label}</div>
                    <div className={`font-bold text-lg ${s.color}`}>{s.val}</div>
                  </div>
                ))}
            </div>
          )}

          {/* ARCHIVE tab */}
          {activeTab === "archive" && (
            <div>
              {archive.length > 0 ? (
                <div className="space-y-1">
                  {archive.map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 text-[9px] bg-stone-900/30 rounded p-2 border border-stone-800/20">
                      <span className="text-amber-400 font-bold w-12">CYCLE {entry.id}</span>
                      <Clock className="h-2.5 w-2.5 text-stone-600" />
                      <span className="text-stone-500">{new Date(entry.completedAt).toLocaleTimeString()}</span>
                      <span className="text-stone-600">│</span>
                      <span className="text-purple-400">{entry.totalAssets} assets</span>
                      <span className="text-stone-600">│</span>
                      <span className="text-cyan-400">{entry.packsCount} packs</span>
                      <span className="text-stone-600">│</span>
                      <span className="text-emerald-400">${entry.revenue}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-stone-600 text-[10px] py-4">
                  <Archive className="h-5 w-5 mx-auto mb-1 opacity-20" />
                  No completed cycles yet. Run the pipeline!
                </div>
              )}
            </div>
          )}

          {/* GOALS tab */}
          {activeTab === "goals" && (
            <div className="text-[10px] text-stone-500 text-center py-4">
              <Target className="h-5 w-5 mx-auto mb-1 opacity-20" />
              Production goals coming soon
            </div>
          )}

          {/* SYSTEM tab */}
          {activeTab === "system" && (
            <div className="text-[10px] text-stone-400 space-y-1">
              <div>Hermes CLI: <span className={kanbanLive ? "text-emerald-400" : "text-red-400"}>{kanbanLive ? "ONLINE" : "OFFLINE"}</span></div>
              <div>Kanban poll: 8s · Sound: {soundOn ? "ON 🔊" : "OFF 🔇"} · Pipeline: {pipelinePaused ? "PAUSED ⏸" : "ACTIVE ▶"}</div>
              <div>Agents: {AGENTS.map(a => a.label).join(" → ")}</div>
              <div>Assets loaded: {assets.length} · Archive: {archive.length} cycles</div>
              <div className="text-[8px] text-stone-600 mt-1">Space = pause · 1-6 = select · Esc = close</div>
            </div>
          )}
        </div>
      )}

      {/* ═══ AGENT DETAIL POPUP ═══ */}
      {selectedAgent && selectedDef && (
        <GameWindow title={`${selectedDef.label} · ${selectedDef.role}`} icon={<span>{selectedDef.icon}</span>} onClose={() => setSelectedAgent(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: `${selectedDef.color}33`, background: `${selectedDef.color}08` }}>
              <Image src={`/sprites/agents/${selectedDef.id}/idle_f0.png`} alt={selectedDef.label} width={48} height={84} className="pixelated" unoptimized />
              <div>
                <div className="font-bold text-sm" style={{ color: selectedDef.color }}>{selectedDef.label}</div>
                <div className="text-stone-500 text-[10px]">{selectedDef.role} · Room [{selectedDef.gridX},{selectedDef.gridY}]</div>
              </div>
            </div>
            {selectedData && (
              <>
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  {[{ l: "Active", v: selectedData.activeCount, c: "text-emerald-400" },
                    { l: "Ready", v: selectedData.readyCount, c: "text-amber-400" },
                    { l: "Done", v: selectedData.doneCount, c: "text-cyan-400" },
                    { l: "Blocked", v: selectedData.blockedCount, c: selectedData.blockedCount > 0 ? "text-red-400" : "text-stone-600" }]
                    .map(s => (
                      <div key={s.l} className="bg-stone-900/50 rounded p-2 border border-stone-800/30">
                        <div className="text-stone-500">{s.l}</div><div className={`font-bold text-base ${s.c}`}>{s.v}</div>
                      </div>
                    ))}
                </div>
                {selectedData.currentTask && (
                  <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30 text-[9px]">
                    <div className="text-stone-500 mb-1">Current Task</div>
                    <div className="text-stone-300 break-words">{selectedData.currentTask.title}</div>
                    <div className="text-stone-600 mt-1 text-[8px]">{selectedData.currentTask.id}</div>
                  </div>
                )}
                {/* Show agent-specific assets */}
                {assets.length > 0 && (
                  <div className="pt-2 border-t border-stone-800/30">
                    <div className="text-[9px] text-stone-500 mb-2">Recent Forged Assets</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {assets.slice(0, 12).map(a => (
                        <Image key={a.filename} src={a.url} alt={a.name} width={40} height={40} className="pixelated rounded border border-stone-800/30" unoptimized />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {!selectedData && <div className="text-center text-stone-600 text-[10px] py-4">No Kanban data available</div>}
          </div>
        </GameWindow>
      )}
    </div>
  )
}
