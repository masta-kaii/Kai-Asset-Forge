"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Play, Pause, Zap, Loader2, Wifi, WifiOff, Clock,
  Cpu, Brain, Activity, TrendingUp, CheckCircle2, XCircle,
  AlertTriangle, Package, Sparkles, ScrollText,
  X, Monitor, MessageSquare, ChevronRight, Library, FileText, ListChecks,
  MapPin, Eye, Footprints, RefreshCw, Grid, Wallpaper,
  Building2, Moon, Star, Volume2, VolumeX,
} from "lucide-react"
import { CuratorPanel } from "@/components/workstation/curator-panel"
import { ScoutPanel } from "@/components/workstation/scout-panel"
import { ListerPanel } from "@/components/workstation/lister-panel"
import type { Asset } from "@/lib/types"
import "./kairosoft-theme.css"
import {
  playPipelineStart, playStepComplete, playCycleComplete,
  playAgentClick, playLogNotification, initAudio,
  startAmbientDrone, stopAmbientDrone,
} from "@/lib/factory-audio"

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const FRAME_INTERVAL = 200
const SCALE = 3
const PIPELINE_TICK_MS = 2000 // scheduler tick every 2s
const PIPELINE_STEP_DURATION = 8000 // 8 seconds per pipeline step
const WALK_SPEED = 0.02 // progress per tick
const RANDOM_WALK_INTERVAL_MS = 12000 // agents randomly walk to visit buddies
const POPO_CHECK_INTERVAL_MS = 15000 // popo checks on agents

interface AgentDef {
  id: string; label: string; role: string
  homeX: number; homeY: number
  floorTile: string
  wallDecor?: string
  prop?: string
  color: string // theme color
}

const AGENTS: AgentDef[] = [
  { id: "scout",    label: "Scout",   role: "Intel",    homeX: 0, homeY: 0, floorTile: "2", color: "#22c55e" },
  { id: "forge",    label: "Forge",   role: "Prod",     homeX: 1, homeY: 0, floorTile: "3", prop: "floor_ladder", color: "#f97316" },
  { id: "curator",  label: "Curator", role: "QA",       homeX: 2, homeY: 0, floorTile: "1", prop: "column", color: "#eab308" },
  { id: "popo",     label: "Popo",    role: "CEO ✦ CMD",homeX: 0, homeY: 1, floorTile: "8", wallDecor: "wall_banner_red", prop: "column", color: "#fbbf24" },
  { id: "packager", label: "Packager",role: "Assembly", homeX: 1, homeY: 1, floorTile: "7", prop: "crate", color: "#fb923c" },
  { id: "lister",   label: "Lister",  role: "Sales",    homeX: 2, homeY: 1, floorTile: "5", prop: "crate", color: "#3b82f6" },
  { id: "testbench",label: "Test",    role: "Bench ✦",  homeX: 1, homeY: 2, floorTile: "4", prop: "column", color: "#a855f7" },
]

// ═══════════════════════════════════════════════════════════════════════════
// Pipeline Config
// ═══════════════════════════════════════════════════════════════════════════

const PIPELINE_STEPS = [
  { id: 0, name: "SCAN",  agentId: "scout",    label: "Scanning markets..." },
  { id: 1, name: "FORGE", agentId: "forge",    label: "Forging assets..." },
  { id: 2, name: "QC",    agentId: "curator",  label: "Inspecting quality..." },
  { id: 3, name: "BUNDLE",agentId: "packager", label: "Bundling packs..." },
  { id: 4, name: "LIST",  agentId: "lister",   label: "Listing for sale..." },
] as const

function nextPipelineStep(current: number): number {
  return (current + 1) % PIPELINE_STEPS.length
}

function prevPipelineStep(current: number): number {
  return (current - 1 + PIPELINE_STEPS.length) % PIPELINE_STEPS.length
}

// ═══════════════════════════════════════════════════════════════════════════
// Soul Dialogues
// ═══════════════════════════════════════════════════════════════════════════

const SOUL_LINES: Record<string, string[]> = {
  scout: [
    "Intel incoming!", "The markets are whispering...", "I found something BIG!",
    "Trend spotted!", "My eyes don't miss a thing!",
  ],
  forge: [
    "By the hammer!", "The forge is HOT!", "Another masterpiece!",
    "Feel the HEAT!", "I'll forge you something magnificent!",
  ],
  curator: [
    "Inspecting...", "Quality check in progress.", "Flawless. Passed with honors.",
    "This needs rework.", "I am the shield that guards the standard!",
  ],
  packager: [
    "BUNDLE TIME!", "So many assets to organize!", "PERFECT bundle!",
    "This goes with THAT!", "Beautiful organization!",
  ],
  lister: [
    "A fine choice!", "Let me make this irresistible!", "LISTED!",
    "This pack writes its own ticket!", "LIMITED EDITION!",
  ],
  popo: [
    "All agents report!", "The factory thrives!", "Excellent work, team!",
    "Keep the forge burning!", "Popo is watching!",
  ],
  testbench: [
    "Come see the latest forges!", "Asset showcase ready!",
    "Share-worthy preview!", "Zoom in on the details!",
    "Spin it, zoom it, share it!",
  ],
}

const MEETING_LINES: Record<string, string> = {
  "scout-forge": "Found a hot trend, Forge! Get your hammer ready!",
  "forge-curator": "Fresh off the anvil! Tell me it's perfect.",
  "curator-packager": "Approved assets ready for bundling.",
  "packager-lister": "Premium packs ready for the market!",
  "popo-scout": "How's the factory running?",
  "popo-forge": "How's the factory running?",
  "popo-curator": "How's the factory running?",
  "popo-packager": "How's the factory running?",
  "popo-lister": "How's the factory running?",
}

function randomSoulLine(agentId: string): string {
  const lines = SOUL_LINES[agentId] ?? ["..."]
  return lines[Math.floor(Math.random() * lines.length)]
}

function meetingLine(a: string, b: string): string {
  const key = `${a}-${b}`
  const reverseKey = `${b}-${a}`
  return MEETING_LINES[key] ?? MEETING_LINES[reverseKey] ?? "Hey there!"
}

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type AgentStatus = "idle" | "walking" | "meeting" | "working" | "done"

interface WalkTarget {
  targetX: number; targetY: number
  walkProgress: number // 0 → 1
  fromX: number; fromY: number
}

interface AgentState {
  status: AgentStatus
  message: string
  gridX: number; gridY: number
  pulse: boolean
  frame: number
  facing: "right" | "left"
  animMode: "idle" | "run"
  walk: WalkTarget | null
  dialogueTimer: number // countdown ticks until next random line
}

interface LogEntry {
  id: number; time: string; agent: string; msg: string
  type: "info" | "ok" | "warn" | "err"
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function now(): string { return new Date().toLocaleTimeString("en-US", { hour12: false }) }

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
// Sprite component (with animMode support)
// ═══════════════════════════════════════════════════════════════════════════

function AgentSprite({ agentId, frame, size, facing, animMode, className }: {
  agentId: string; frame: number; size: number; facing: "right" | "left"
  animMode?: "idle" | "run"; className?: string
}) {
  const def = AGENTS.find((a) => a.id === agentId)
  if (!def) return null
  const w = size; const h = size * 1.75
  const mode = animMode ?? "idle"
  const src = `/sprites/agents/${agentId}/${mode}_f${frame % 4}.png`
  return (
    <div className={className} style={{ width: w, height: h, transform: facing === "left" ? "scaleX(-1)" : undefined }}>
      <Image src={src} alt={def.label} width={w} height={h} className="pixelated" unoptimized priority />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Popup Window Component
// ═══════════════════════════════════════════════════════════════════════════

function GameWindow({ title, icon, onClose, children, className }: {
  title: string; icon?: React.ReactNode; onClose: () => void
  children: React.ReactNode; className?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
         onClick={onClose}>
      <div className={`animate-bounce-in kairosoft-window max-w-lg w-[90vw] max-h-[80vh] flex flex-col ${className ?? ""}`}
           onClick={(e) => e.stopPropagation()}>
        {/* Window title bar */}
        <div className="window-title flex items-center justify-between px-3 py-2 rounded-t-lg">
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
        <div className="window-body p-3 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
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
// Pipeline Progress Bar
// ═══════════════════════════════════════════════════════════════════════════

function PipelineBar({ currentStep, stepProgress }: { currentStep: number; stepProgress: number }) {
  return (
    <div className="flex items-center gap-1 px-3 py-1 bg-stone-900/80 border-t border-yellow-900/20">
      {PIPELINE_STEPS.map((step, idx) => {
        const isCurrent = idx === currentStep
        const isDone = false // we highlight current only
        return (
          <div key={step.id} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono transition-all ${
              isCurrent
                ? "bg-yellow-900/40 text-yellow-300 border border-yellow-600/40 shadow-[0_0_6px_rgba(255,200,50,0.2)]"
                : "text-stone-600"
            }`}>
              <div className={`h-1.5 w-1.5 rounded-full ${
                isCurrent ? "bg-yellow-400 animate-pulse" : "bg-stone-700"
              }`} />
              <span>{step.name}</span>
            </div>
            {idx < PIPELINE_STEPS.length - 1 && (
              <div className="flex-1 h-px bg-stone-800 mx-0.5 relative">
                {isCurrent && (
                  <div className="absolute inset-0 bg-yellow-600/40 transition-all" style={{ width: `${stepProgress * 100}%` }} />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Page — AUTONOMOUS DUNGEON
// ═══════════════════════════════════════════════════════════════════════════

export default function WorkstationPage() {
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showForgeModal, setShowForgeModal] = useState(false)
  
  async function startForge() {
    try {
      const res = await fetch("/api/agents/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "auto" })
      });
      if (res.ok) {
        addLog("popo", "Factory started via API", "info");
      }
    } catch(e) {
      addLog("popo", "Failed to start factory", "err");
    }
  }
  

  // Pipeline state
  const [currentPipelineStep, setCurrentPipelineStep] = useState(0)
  const [stepProgress, setStepProgress] = useState(0) // 0→1 over step duration
  const [pipelineCycle, setPipelineCycle] = useState(0)

  // Agent state
  const [agents, setAgents] = useState<Record<string, AgentState>>(() => {
    const s: Record<string, AgentState> = {}
    for (const a of AGENTS) {
      s[a.id] = {
        status: "idle",
        message: "",
        gridX: a.homeX,
        gridY: a.homeY,
        pulse: false,
        frame: Math.floor(Math.random() * 4),
        facing: "right",
        animMode: "idle",
        walk: null,
        dialogueTimer: Math.floor(Math.random() * 15) + 5, // 5-20 ticks
      }
    }
    return s
  })

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [forgeRunning, setForgeRunning] = useState(false)
  const [uptime, setUptime] = useState(0)

  // Test Bench state
  const [recentAssets, setRecentAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [bgMode, setBgMode] = useState<"transparent" | "grid" | "dungeon">("grid")
  const [testBenchZoom, setTestBenchZoom] = useState(3)

  // Fetch assets for Test Bench
  const fetchAssets = useCallback(async () => {
    setAssetsLoading(true)
    try {
      const res = await fetch("/api/agents/dashboard", {
        headers: { "Authorization": "Bearer kaf_e864d42e9b6c0653c9ec9e4c281f1479f40db4d21d365df5" }
      })
      const data = await res.json()
      if (data?.recentAssets) {
        setRecentAssets(data.recentAssets)
      }
    } catch {}
    setAssetsLoading(false)
  }, [])
  const spinRef = useRef(0)

  const logsEnd = useRef<HTMLDivElement>(null)
  const logCounter = useRef(0)
  const rafRef = useRef<number>(0)
  const lastFrameTime = useRef(0)
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pipelineStepRef = useRef(currentPipelineStep)
  pipelineStepRef.current = currentPipelineStep
  const pipelineCycleRef = useRef(pipelineCycle)
  pipelineCycleRef.current = pipelineCycle

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

  // ── Frame animation (single rAF) ──
  useEffect(() => {
    function tick(ts: number) {
      if (ts - lastFrameTime.current > FRAME_INTERVAL) {
        lastFrameTime.current = ts
        setAgents((prev) => {
          let changed = false
          const next: Record<string, AgentState> = {}
          for (const [id, st] of Object.entries(prev)) {
            const n = { ...st, frame: (st.frame + 1) % 4 }
            // Decay dialogue timer
            if (n.dialogueTimer > 0) {
              n.dialogueTimer = n.dialogueTimer - 1
              changed = true
            } else {
              // Trigger random soul line when idle
              if (n.status === "idle" && !n.message) {
                n.message = randomSoulLine(id)
                n.dialogueTimer = Math.floor(Math.random() * 15) + 8
                changed = true
              }
            }
            // Auto-clear idle messages after a bit
            if (n.status === "idle" && n.message && n.dialogueTimer < 3) {
              n.message = ""
            }
            next[id] = n
          }
          return changed ? next : prev
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Walk movement tick (runs every FRAME_INTERVAL via the update logic in scheduler) ──
  function updateWalk(prev: Record<string, AgentState>): Record<string, AgentState> {
    const next: Record<string, AgentState> = {}
    let changed = false
    for (const id of Object.keys(prev)) {
      const st = prev[id]
      let n = { ...st, frame: st.frame }
      if (st.walk && st.status === "walking") {
        n.walk = { ...st.walk }
        n.walk.walkProgress = Math.min(1, n.walk.walkProgress + WALK_SPEED)
        // Interpolate position
        n.gridX = st.walk.fromX + (st.walk.targetX - st.walk.fromX) * n.walk.walkProgress
        n.gridY = st.walk.fromY + (st.walk.targetY - st.walk.fromY) * n.walk.walkProgress
        // Facing direction
        if (st.walk.targetX > st.walk.fromX) n.facing = "right"
        else if (st.walk.targetX < st.walk.fromX) n.facing = "left"
        n.animMode = "run"
        changed = true
        if (n.walk.walkProgress >= 1) {
          // Arrived at destination
          n.gridX = st.walk.targetX
          n.gridY = st.walk.targetY
          n.walk = null
          n.animMode = "idle"
          // Check if someone else is at this position → meeting
          // Will be handled by scheduler
        }
      }
      next[id] = n
    }
    return changed ? next : prev
  }

  // ── Scheduler (autonomous pipeline + random walks) ──
  useEffect(() => {
    // Initial loading delay
    const loadTimer = setTimeout(() => {
      setLoading(false)
      if (soundEnabled) {
        playPipelineStart()
        startAmbientDrone()
      }
    }, 800)

    // Fetch recent assets for Test Bench
    fetchAssets()

    // Pipeline scheduler
    let stepTimer = 0

    
    // Poll the Hermes API for real status
    schedulerRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/agents/status');
        const data = await res.json();
        
        if (data.success) {
          setForgeRunning(data.isBusy);
          
          // Update agents based on real data
          if (data.isBusy) {
            setCurrentPipelineStep(1); // Show forging
            setAgents(prev => {
              const next = { ...prev };
              if (next['forge']) {
                next['forge'] = {
                  ...next['forge'],
                  status: 'working',
                  message: 'Forging asset...',
                  pulse: true
                };
              }
              return next;
            });
          } else {
            setCurrentPipelineStep(0); // Show idle
            setAgents(prev => {
              const next = { ...prev };
              if (next['forge'] && next['forge'].status === 'working') {
                next['forge'] = {
                  ...next['forge'],
                  status: 'done',
                  message: 'Pipeline complete!',
                  pulse: false
                };
              }
              return next;
            });
          }
          
          if (data.results && data.results.length > 0) {
            // Update latest generated assets
            const latest = data.results[data.results.length - 1];
            if (latest.assets) {
              setRecentAssets(latest.assets);
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll status', err);
      }
    }, 5000)


    return () => {
      clearTimeout(loadTimer)
      if (schedulerRef.current) clearInterval(schedulerRef.current)
    }
  }, [addLog]) // Only depends on addLog, uses refs for pipeline state

  // ── Handle completed walking agents (arrived at destination) ──
  // Also reset walking agents after meeting
  useEffect(() => {
    const cleanup = setInterval(() => {
      setAgents((prev) => {
        let changed = false
        const next: Record<string, AgentState> = {}
        for (const [id, st] of Object.entries(prev)) {
          let n = { ...st }
          // If walking but no walk target and not at home, return home
          if (n.status === "walking" && !n.walk) {
            const def = AGENTS.find(a => a.id === id)
            if (def) {
              // If arrived at non-home location, they're visiting - start meeting
              n = {
                ...n,
                status: "idle" as AgentStatus,
                gridX: def.homeX,
                gridY: def.homeY,
                animMode: "idle",
                message: "Back at post.",
                dialogueTimer: 5,
              }
              changed = true
            }
          }
          // Reset meeting agents after some time (handled by timer in next cleanup)
          next[id] = n
        }
        return changed ? next : prev
      })
    }, 4000)
    return () => clearInterval(cleanup)
  }, [])

  // ── Meeting reset timer ──
  useEffect(() => {
    const mtgReset = setInterval(() => {
      setAgents((prev) => {
        let changed = false
        const next: Record<string, AgentState> = {}
        for (const [id, st] of Object.entries(prev)) {
          let n = { ...st }
          if (n.status === "meeting") {
            const def = AGENTS.find(a => a.id === id)
            if (def) {
              n = {
                ...n,
                status: "idle" as AgentStatus,
                message: "",
                animMode: "idle",
                gridX: def.homeX,
                gridY: def.homeY,
                pulse: false,
                dialogueTimer: 5,
              }
              changed = true
            }
          }
          next[id] = n
        }
        return changed ? next : prev
      })
    }, 6000) // meetings last ~6 seconds
    return () => clearInterval(mtgReset)
  }, [])

  // ── Done → idle cleanup ──
  useEffect(() => {
    const doneReset = setInterval(() => {
      setAgents((prev) => {
        let changed = false
        const next: Record<string, AgentState> = {}
        for (const [id, st] of Object.entries(prev)) {
          let n = { ...st }
          if (n.status === "done") {
            const def = AGENTS.find(a => a.id === id)
            if (def) {
              n = {
                ...n,
                status: "idle" as AgentStatus,
                message: "",
                pulse: false,
                animMode: "idle",
                gridX: def.homeX,
                gridY: def.homeY,
                walk: null,
                dialogueTimer: 3,
              }
              changed = true
            }
          }
          next[id] = n
        }
        return changed ? next : prev
      })
    }, 3000)
    return () => clearInterval(doneReset)
  }, [])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key.toLowerCase()) {
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
  }, [])

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
        {/* Status */}
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#34d399] animate-pulse" />
          <span className="text-emerald-400">LIVE</span>
        </div>

        <div className="w-px h-4 bg-yellow-900/40" />

        {/* Pipeline info + step progress */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500 uppercase tracking-wider text-[9px]">Cycle</span>
            <Badge variant="outline" className="gap-1 font-mono text-[10px] h-5 border-yellow-600/30 bg-yellow-950/20 text-yellow-400">
              <Activity className="h-2.5 w-2.5" />
              {PIPELINE_STEPS[currentPipelineStep]?.name ?? "IDLE"}
            </Badge>
          </div>
          {/* Step progress bar */}
          <div className="kairosoft-step-progress">
            <div className="step-track">
              <div className="step-fill" style={{ width: `${stepProgress * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="w-px h-4 bg-yellow-900/40" />

        {/* Stats */}
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-stone-400 text-[10px]">
            <Footprints className="h-3 w-3 text-stone-500" />
            <span className="font-mono tabular-nums">{workingAgents}/6</span>
          </span>
          <span className="flex items-center gap-1 text-stone-400 text-[10px]">
            <Cpu className="h-3 w-3 text-stone-500" />
            <span className="font-mono tabular-nums">Cycle #{pipelineCycle}</span>
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
      </div>

      {/* ═══════ DUNGEON FLOOR — FULL SCREEN ═══════ */}
      <div className="flex-1 relative overflow-hidden">
        {/* Torchlit ambient glow */}
        <div className="pointer-events-none absolute inset-0 z-10" style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(255,180,40,0.06) 0%, transparent 60%), radial-gradient(ellipse at 25% 25%, rgba(255,140,40,0.03) 0%, transparent 50%), radial-gradient(ellipse at 75% 75%, rgba(255,140,40,0.03) 0%, transparent 50%)",
        }} />

        {/* Kairosoft Day Counter + Factory Controls */}
        <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="kairosoft-day-counter pointer-events-auto">
            <Building2 className="h-3 w-3" />
            <span className="day-number">Day {pipelineCycle + 1}</span>
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button className="kairosoft-btn" style={{background: 'linear-gradient(180deg, #d4a03c 0%, #8b6914 100%)', borderColor: '#f5d98a', textShadow: '1px 1px 0 #5c4510'}} onClick={() => startForge()}>
              <Zap className="h-3 w-3 inline-block mr-1" />START
            </button>
            <button className="kairosoft-btn" onClick={() => {
              if (soundEnabled) playLogNotification()
              setShowLogModal(true)
            }}>
              <ScrollText className="h-3 w-3 inline-block mr-1" />LOG
            </button>
            <button className="kairosoft-btn" onClick={() => {
              setSoundEnabled(!soundEnabled)
              if (!soundEnabled) {
                playPipelineStart()
                startAmbientDrone()
              } else {
                stopAmbientDrone()
              }
            }}>
              {soundEnabled ? <><Volume2 className="h-3 w-3 inline-block mr-1" />SFX</> : <><VolumeX className="h-3 w-3 inline-block mr-1" />MUTE</>}
            </button>
            <button className="kairosoft-btn kairosoft-btn-danger" onClick={() => addLog("popo", "Factory shutting down for the day...", "warn")}>
              <Moon className="h-3 w-3 inline-block mr-1" />CLOSE
            </button>
          </div>
        </div>

        {/* Grid — 3x2 layout */}
        <div className="absolute inset-0 p-2 sm:p-4">
          <div className="grid gap-1 sm:gap-2 w-full h-full" style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(3, 1fr)",
          }}>
            {AGENTS.map((agent) => {
              const st = agents[agent.id]
              if (!st) return null
              const isPopo = agent.id === "popo"
              const isWorking = st.status === "working" || st.status === "walking"
              const isMeeting = st.status === "meeting"
              const isSelected = selectedAgent === agent.id
              const isPipelineStep = PIPELINE_STEPS[currentPipelineStep]?.agentId === agent.id

              return (
                <div
                  key={agent.id}
                  className="relative cursor-pointer group"
                  style={{ gridColumn: agent.homeX + 1, gridRow: agent.homeY + 1 }}
                  onClick={() => {
                    if (soundEnabled) playAgentClick()
                    setSelectedAgent(isSelected ? null : agent.id)
                  }}
                  title={`${agent.label} — ${agent.role} (${st.status})`}
                >
                  {/* Room container */}
                  <div className={`relative w-full h-full flex flex-col items-center justify-center border-2 transition-all duration-300 ${
                    isSelected ? "border-primary/60 ring-2 ring-primary/20" :
                    isPopo ? "border-yellow-500/60 bg-yellow-950/20 ring-1 ring-yellow-500/30" :
                    isMeeting ? "border-violet-500/60 bg-violet-950/20 ring-1 ring-violet-500/30" :
                    isPipelineStep ? "border-amber-500/50 bg-stone-900/40 ring-1 ring-amber-500/20" :
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
                    {st.message && (
                      <div className="absolute -top-7 z-30 animate-bounce-in max-w-[85%]">
                        <div className={`relative px-2 py-0.5 rounded border text-center bg-stone-900/95 backdrop-blur ${
                          st.status === "meeting" ? "border-violet-500/40" :
                          st.status === "walking" ? "border-blue-500/30" :
                          st.status === "done" ? "border-emerald-500/40" :
                          st.status === "working" ? "border-amber-500/40" :
                          "border-yellow-700/20"
                        }`}>
                          <p className={`font-mono text-[10px] leading-tight ${
                            st.status === "meeting" ? "text-violet-300" :
                            st.status === "walking" ? "text-blue-300" :
                            st.status === "done" ? "text-emerald-300" :
                            st.status === "working" ? "text-amber-300" :
                            "text-stone-400"
                          }`}>{st.message}</p>
                          <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-stone-900/95 backdrop-blur border-r border-b ${
                            st.status === "meeting" ? "border-violet-500/40" :
                            st.status === "walking" ? "border-blue-500/30" :
                            st.status === "done" ? "border-emerald-500/40" :
                            st.status === "working" ? "border-amber-500/40" :
                            "border-yellow-700/20"
                          }`} />
                        </div>
                      </div>
                    )}

                    {/* Kairosoft building roof */}
                    <div className="kairosoft-building absolute -top-1 left-1/2 -translate-x-1/2 z-4">
                      <div className="roof" />
                      <div className="building-body" style={{ width: 50 }}>
                        <div className="sign">{agent.label}</div>
                      </div>
                    </div>

                    {/* Agent sprite */}
                    <div className={`relative z-10 transition-transform duration-700 ${
                      st.status !== "walking" ? "animate-bob" : ""
                    } ${st.status === "meeting" ? "animate-meeting-bounce" : ""} ${st.status === "done" ? "animate-shake" : ""}`}>
                      <AgentSprite
                        agentId={agent.id}
                        frame={st.frame}
                        size={isPopo ? 56 : 40}
                        facing={st.facing}
                        animMode={st.animMode}
                        className={`transition-all duration-500 ${
                          st.pulse ? "drop-shadow-[0_0_14px_rgba(255,200,50,0.7)]" :
                          st.status === "meeting" ? "drop-shadow-[0_0_14px_rgba(139,92,246,0.5)]" :
                          st.status === "walking" ? "drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]" :
                          isPopo ? "drop-shadow-[0_0_10px_rgba(255,215,0,0.4)]" :
                          "drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                        }`}
                      />
                      {st.pulse && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2/3 h-1.5 rounded-full bg-amber-400/30 blur-sm animate-pulse" />
                      )}
                    </div>

                    {/* Nameplate */}
                    <div className={`absolute bottom-2 px-2 py-0.5 rounded border text-center z-10 transition-colors ${
                      isPopo ? "border-yellow-500/60 bg-black/90" :
                      "border-stone-700/30 bg-black/70"
                    }`}>
                      <p className={`font-mono text-[10px] leading-none ${
                        isPopo ? "text-yellow-400 font-bold tracking-wider" :
                        "text-stone-200"
                      }`}>{agent.label}</p>
                      <p className="font-mono text-[9px] leading-none text-stone-600">{agent.role}</p>
                    </div>

                    {/* Status indicator */}
                    <div className="absolute top-1.5 right-1.5">
                      <div className={`h-2.5 w-2.5 rounded-full transition-colors ${
                        st.status === "working" ? "bg-emerald-500 shadow-[0_0_6px_#34d399]" :
                        st.status === "walking" ? "bg-blue-400 shadow-[0_0_6px_#60a5fa]" :
                        st.status === "meeting" ? "bg-violet-400 shadow-[0_0_6px_#a78bfa]" :
                        st.status === "done" ? "bg-emerald-400" :
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
        <svg className="absolute inset-0 z-5 w-full h-full pointer-events-none" viewBox="0 0 300 200" preserveAspectRatio="none">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Horizontal corridors */}
          <line x1="0" y1="66" x2="300" y2="66" stroke="rgba(217,168,65,0.3)" strokeWidth="2" strokeDasharray="6,8" filter="url(#glow)" />
          <line x1="0" y1="133" x2="300" y2="133" stroke="rgba(217,168,65,0.3)" strokeWidth="2" strokeDasharray="6,8" filter="url(#glow)" />
          {/* Vertical corridors */}
          <line x1="100" y1="0" x2="100" y2="200" stroke="rgba(217,168,65,0.3)" strokeWidth="2" strokeDasharray="6,8" filter="url(#glow)" />
          <line x1="200" y1="0" x2="200" y2="200" stroke="rgba(217,168,65,0.3)" strokeWidth="2" strokeDasharray="6,8" filter="url(#glow)" />
        </svg>

        {/* ═══════ KEYBOARD HINT ═══════ */}
        <div className="absolute bottom-8 left-6 z-20 flex gap-3 text-[9px] font-mono text-stone-600">
          <span><span className="text-stone-500">1-6</span> Focus</span>
          <span><span className="text-stone-500">Esc</span> Close</span>
        </div>
      </div>

      {/* ═══════ PIPELINE PROGRESS BAR ═══════ */}
      <PipelineBar currentStep={currentPipelineStep} stepProgress={stepProgress} />

      {/* ═══════ POPUP: AGENT DETAIL / DEPARTMENT VIEW ═══════ */}
      {selectedAgent && selectedAgentDef && selectedAgentState && (
        <GameWindow
          title={`${selectedAgentDef.label} · ${selectedAgentDef.role}`}
          icon={(() => {
            switch (selectedAgent) {
              case "popo": return <Activity className="h-4 w-4" />
              case "curator": return <Library className="h-4 w-4" />
              case "scout": return <ListChecks className="h-4 w-4" />
              case "lister": return <FileText className="h-4 w-4" />
              case "testbench": return <Eye className="h-4 w-4" />
              default: return <Activity className="h-4 w-4" />
            }
          })()}
          onClose={() => setSelectedAgent(null)}
          className="kairosoft-window-v2"
        >
          {/* 🏗️ V2 — Agent Header with Large Portrait + Compact Stats */}
          {selectedAgent !== "testbench" && selectedAgentState && (
            <div className="kairosoft-agent-header">
              <div className="agent-portrait">
                <AgentSprite agentId={selectedAgent} frame={selectedAgentState.frame} size={72} facing="right" />
                <div className={`status-dot ${
                  selectedAgentState.status === "working" ? "bg-emerald-500 border-emerald-400" :
                  selectedAgentState.status === "walking" ? "bg-blue-400 border-blue-300" :
                  selectedAgentState.status === "meeting" ? "bg-violet-400 border-violet-300" :
                  selectedAgentState.status === "done" ? "bg-emerald-400 border-emerald-300" :
                  "bg-stone-700 border-stone-600"
                }`} />
              </div>
              <div className="header-info">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="agent-name">{selectedAgentDef.label}</div>
                    <div className="agent-role">{selectedAgentDef.role}</div>
                  </div>
                  <div className="text-right">
                    <span className={`kairosoft-badge ${
                      selectedAgentState.status === "working" ? "amber" :
                      selectedAgentState.status === "walking" ? "blue" :
                      selectedAgentState.status === "done" ? "green" : "amber"
                    }`}>
                      {selectedAgentState.status}
                    </span>
                    <div className="agent-level mt-1">Lv.{Math.floor((pipelineCycle + 1) / 3) + 1}</div>
                  </div>
                </div>
                {/* 3-column stat grid */}
                <div className="kairosoft-stat-grid">
                  <div className="k-stat">
                    <div className="k-stat-label"><span>⚡ Speed</span><span className="val">{Math.min(10, 4 + pipelineCycle)}</span></div>
                    <div className="k-stat-bar"><div className="fill" style={{ width: `${Math.min(100, 40 + pipelineCycle * 10)}%`, background: "linear-gradient(90deg, #d4a03c, #f5d98a)" }} /></div>
                  </div>
                  <div className="k-stat">
                    <div className="k-stat-label"><span>🎨 Quality</span><span className="val">{Math.min(10, 3 + pipelineCycle)}</span></div>
                    <div className="k-stat-bar"><div className="fill" style={{ width: `${Math.min(100, 30 + pipelineCycle * 10)}%`, background: "linear-gradient(90deg, #6b8e23, #8fbc3f)" }} /></div>
                  </div>
                  <div className="k-stat">
                    <div className="k-stat-label"><span>🔬 Research</span><span className="val">{Math.min(10, 5 + pipelineCycle)}</span></div>
                    <div className="k-stat-bar"><div className="fill" style={{ width: `${Math.min(100, 50 + pipelineCycle * 8)}%`, background: "linear-gradient(90deg, #25608b, #4299e0)" }} /></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 📊 V2 — Department Content in 2-Column Card Grid */}
          {selectedAgent === "forge" && (
            <div className="kairosoft-dept-grid">
              <div className="kairosoft-dept-card">
                <div className="card-title"><span className="card-icon">🔨</span>Production Queue</div>
                <div className="text-[7px] text-[#8a7a4a] mb-1">"Pixel Asset Pack Vol.1"</div>
                <div className="flex gap-1 mb-2">
                  <div className="flex-1 h-1 bg-[#2a1f0a] border border-[#5c4510]">
                    <div className="h-full w-[45%]" style={{ background: "#d4a03c" }} />
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <span className="kairosoft-badge blue">Dragon 🐉</span>
                  <span className="kairosoft-badge" style={{ background: "#1a1206", borderColor: "#3a2a0a", color: "#5c5010" }}>Sword 🗡️</span>
                </div>
              </div>
              <div className="kairosoft-dept-card">
                <div className="card-title"><span className="card-icon">📊</span>Quality Metrics</div>
                <div className="flex justify-center gap-3 py-1">
                  <div className="text-center">
                    <div className="text-[13px] text-[#34d399]">92%</div>
                    <div className="text-[6px] text-[#5c5010] tracking-wider">Pass Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[13px] text-[#f5d98a]">{pipelineCycle + 3}</div>
                    <div className="text-[6px] text-[#5c5010] tracking-wider">Total Forged</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[13px] text-[#f87171]">0</div>
                    <div className="text-[6px] text-[#5c5010] tracking-wider">Reworks</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedAgent === "curator" && (
            <div className="kairosoft-dept-grid">
              <div className="kairosoft-dept-card">
                <div className="card-title"><span className="card-icon">🔬</span>QC Queue</div>
                <div className="text-[7px] text-[#8a7a4a] mb-1">2 assets pending review</div>
              </div>
              <div className="kairosoft-dept-card">
                <div className="card-title"><span className="card-icon">✅</span>Approval Rate</div>
                <div className="flex justify-center gap-3 py-1">
                  <div className="text-center">
                    <div className="text-[13px] text-[#34d399]">85%</div>
                    <div className="text-[6px] text-[#5c5010] tracking-wider">Approved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[13px] text-[#f87171]">15%</div>
                    <div className="text-[6px] text-[#5c5010] tracking-wider">Rejected</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedAgent === "scout" && (
            <div className="kairosoft-dept-grid">
              <div className="kairosoft-dept-card">
                <div className="card-title"><span className="card-icon">🎯</span>Active Bounties</div>
                <div className="text-[7px] text-[#8a7a4a]">3 trending themes identified</div>
              </div>
              <div className="kairosoft-dept-card">
                <div className="card-title"><span className="card-icon">📈</span>Market Pulse</div>
                <div className="text-[7px] text-[#8a7a4a]">Summer Beach pack trending</div>
              </div>
            </div>
          )}

          {selectedAgent === "packager" && (
            <div className="kairosoft-dept-grid">
              <div className="kairosoft-dept-card">
                <div className="card-title"><span className="card-icon">📦</span>Active Bundles</div>
                <div className="text-[7px] text-[#8a7a4a]">1 pack being assembled</div>
              </div>
              <div className="kairosoft-dept-card">
                <div className="card-title"><span className="card-icon">🏷️</span>Tags</div>
                <div className="flex gap-1 flex-wrap">
                  <span className="kairosoft-badge green">pixel-art</span>
                  <span className="kairosoft-badge blue">sprites</span>
                  <span className="kairosoft-badge amber">game-assets</span>
                </div>
              </div>
            </div>
          )}

          {selectedAgent === "lister" && (
            <div className="kairosoft-dept-grid">
              <div className="kairosoft-dept-card">
                <div className="card-title"><span className="card-icon">📝</span>Pending Listings</div>
                <div className="text-[7px] text-[#8a7a4a]">Waiting for Popo approval</div>
              </div>
              <div className="kairosoft-dept-card">
                <div className="card-title"><span className="card-icon">💰</span>Pricing</div>
                <div className="text-[7px] text-[#8a7a4a]">$3.99 - $8.99 range</div>
              </div>
            </div>
          )}

          {/* 🗺️ V2 — Pipeline Kanban Mini View */}
          {selectedAgent !== "testbench" && selectedAgent !== "popo" && (
            <div className="mt-2">
              <div className="text-[8px] text-[#c8b88a] tracking-[1px] uppercase mb-1">Pipeline Kanban</div>
              <div className="kairosoft-kanban-mini">
                {["Scout", "Forge", "Curator", "Packager", "Lister"].map((name, i) => {
                  const isCurrent = PIPELINE_STEPS[currentPipelineStep]?.name === name.toUpperCase()
                  const isPast = PIPELINE_STEPS.findIndex(s => s.name === name.toUpperCase()) < currentPipelineStep % PIPELINE_STEPS.length
                  return (
                    <div key={name} className="kb-col">
                      <div className="kb-title">{
                        name === "Scout" ? "🔍" : name === "Forge" ? "⚒️" : name === "Curator" ? "🔬" : name === "Packager" ? "📦" : "📋"
                      } {name}</div>
                      <div className={`kb-card ${isCurrent ? "active" : ""}`} style={{ opacity: isPast ? 1 : isCurrent ? 1 : 0.3 }}>
                        {isPast ? "✓ Done" : isCurrent ? "Active" : "—"}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 👑 Popo CEO Overview — Command Center */}
          {selectedAgent === "popo" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-stone-700/30">
                <Activity className="h-4 w-4 text-yellow-500" />
                <span className="font-mono text-xs text-stone-400 uppercase tracking-wider">Command Center · Factory Overview</span>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-stone-800/60 rounded-lg p-3 border border-stone-700/30">
                  <p className="text-stone-500 text-[10px] font-mono uppercase mb-1">Pipeline</p>
                  <span className="font-mono text-xs text-yellow-400 uppercase">{PIPELINE_STEPS[currentPipelineStep]?.name ?? "IDLE"}</span>
                </div>
                <div className="bg-stone-800/60 rounded-lg p-3 border border-stone-700/30">
                  <p className="text-stone-500 text-[10px] font-mono uppercase mb-1">Cycle</p>
                  <span className="font-mono text-xs text-stone-300">#{pipelineCycle}</span>
                </div>
                <div className="bg-stone-800/60 rounded-lg p-3 border border-stone-700/30">
                  <p className="text-stone-500 text-[10px] font-mono uppercase mb-1">Uptime</p>
                  <span className="font-mono text-xs text-stone-300">{uptimeStr}</span>
                </div>
                <div className="bg-stone-800/60 rounded-lg p-3 border border-stone-700/30">
                  <p className="text-stone-500 text-[10px] font-mono uppercase mb-1">Workers</p>
                  <span className="font-mono text-xs text-stone-300">{workingAgents}/6 active</span>
                </div>
              </div>

              {/* Pipeline status */}
              <div>
                <p className="text-stone-500 text-[10px] font-mono uppercase mb-2">Pipeline Steps</p>
                <div className="space-y-1">
                  {PIPELINE_STEPS.map((step, idx) => {
                    const isCurrent = idx === currentPipelineStep
                    const st = agents[step.agentId]
                    return (
                      <div key={step.id} className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-mono ${
                        isCurrent ? "bg-yellow-950/30 border border-yellow-700/30" : "bg-stone-800/30 border border-stone-800/20"
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${
                          isCurrent ? "bg-yellow-400 animate-pulse" :
                          st?.status === "done" ? "bg-emerald-500" :
                          "bg-stone-700"
                        }`} />
                        <span className={isCurrent ? "text-yellow-300" : "text-stone-500"}>{step.name}</span>
                        <span className="text-stone-600 ml-auto">{step.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Agent overview */}
              <div>
                <p className="text-stone-500 text-[10px] font-mono uppercase mb-2">Agent Fleet</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {AGENTS.filter((a) => a.id !== "popo").map((a) => {
                    const st = agents[a.id]
                    const statusColors: Record<string, string> = {
                      working: "bg-emerald-500", idle: "bg-stone-700", done: "bg-emerald-400",
                      walking: "bg-blue-400", meeting: "bg-violet-400", error: "bg-red-500",
                    }
                    return (
                      <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-stone-800/40 border border-stone-700/20">
                        <div className={`h-1.5 w-1.5 rounded-full ${statusColors[st?.status ?? "idle"] ?? "bg-stone-700"} ${st?.pulse ? "animate-pulse" : ""}`} />
                        <span className="font-mono text-[10px] text-stone-400 truncate">{a.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Agent sprite preview */}
              <div className="flex justify-center py-1">
                <AgentSprite agentId="popo" frame={selectedAgentState.frame} size={64} facing="right"
                  className="drop-shadow-[0_0_14px_rgba(255,215,0,0.4)]" />
              </div>
            </div>
          )}

          {/* 🏟️ Test Bench — REAL ASSET SHOWCASE */}
          {selectedAgent === "testbench" && (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-stone-700/30">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-violet-400" />
                  <span className="font-mono text-xs text-stone-400 uppercase tracking-wider">
                    Test Bench · {recentAssets.length} Assets
                  </span>
                </div>
                <button onClick={() => { setAssetsLoading(true); fetchAssets(); }}
                  className="text-stone-500 hover:text-violet-400 transition-colors">
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>

              {/* Loading spinner */}
              {assetsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
              ) : recentAssets.length === 0 ? (
                <p className="text-stone-500 text-[11px] font-mono text-center py-6">
                  No assets yet. Run the pipeline to generate some!
                </p>
              ) : selectedAsset ? (
                /* 🎬 Asset preview (zoomed) */
                <div className="space-y-3">
                  {/* Preview canvas */}
                  <div className="flex justify-center">
                    <div className={`rounded-lg border-2 p-4 ${
                      bgMode === "dungeon" ? "border-stone-600/30 bg-stone-800/60" :
                      bgMode === "grid" ? "border-stone-600/30 bg-stone-900/80" :
                      "border-stone-700/30 bg-black/40"
                    }`}>
                      <div className="relative" style={{
                        width: 64 * testBenchZoom,
                        height: 64 * testBenchZoom,
                        background: bgMode === "grid" ?
                          "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 16px 16px" :
                          bgMode === "dungeon" ?
                          "url(/sprites/tiles/floor_1.png) repeat" :
                          "transparent",
                        imageRendering: bgMode === "dungeon" ? "pixelated" : undefined,
                      }}>
                        <img
                          src={selectedAsset.previewUrl}
                          alt={selectedAsset.name}
                          className="absolute inset-0 pixelated animate-bob"
                          style={{
                            width: 64 * testBenchZoom,
                            height: 64 * testBenchZoom,
                            imageRendering: "pixelated",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Controls row */}
                  <div className="flex items-center justify-center gap-2">
                    {(["transparent", "grid", "dungeon"] as const).map((mode) => (
                      <button key={mode}
                        onClick={() => setBgMode(mode)}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all ${
                          bgMode === mode
                            ? "border-violet-500/50 bg-violet-900/30 text-violet-300"
                            : "border-stone-700/30 text-stone-500 hover:border-stone-600/50"
                        }`}>
                        {mode === "transparent" ? "⬤" : mode === "grid" ? "▦" : "◫"} {mode}
                      </button>
                    ))}
                    <span className="text-stone-600 text-[9px] mx-1">|</span>
                    {[2, 3, 4, 6].map((z) => (
                      <button key={z}
                        onClick={() => setTestBenchZoom(z)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                          testBenchZoom === z
                            ? "border-violet-500/50 bg-violet-900/30 text-violet-300"
                            : "border-stone-700/30 text-stone-500 hover:border-stone-600/50"
                        }`}>
                        {z}×
                      </button>
                    ))}
                    <button onClick={() => setSelectedAsset(null)}
                      className="px-2 py-0.5 rounded text-[9px] font-mono border border-stone-700/30 text-stone-500 hover:text-stone-300">
                      ← Back
                    </button>
                  </div>

                  {/* Asset details */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="bg-stone-800/40 rounded p-2 border border-stone-700/20">
                      <p className="text-stone-500 mb-0.5">Name</p>
                      <p className="text-stone-300 truncate">{selectedAsset.name}</p>
                    </div>
                    <div className="bg-stone-800/40 rounded p-2 border border-stone-700/20">
                      <p className="text-stone-500 mb-0.5">Score</p>
                      <p className={selectedAsset.qualityScore >= 6 ? "text-emerald-400" : "text-amber-400"}>
                        {selectedAsset.qualityScore}/10
                      </p>
                    </div>
                    <div className="bg-stone-800/40 rounded p-2 border border-stone-700/20">
                      <p className="text-stone-500 mb-0.5">Type</p>
                      <p className="text-stone-300 capitalize">{selectedAsset.type}</p>
                    </div>
                    <div className="bg-stone-800/40 rounded p-2 border border-stone-700/20">
                      <p className="text-stone-500 mb-0.5">Style</p>
                      <p className="text-stone-300">{selectedAsset.style}</p>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedAsset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedAsset.tags.map((t, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-stone-800/60 text-stone-400 text-[9px] font-mono border border-stone-700/20">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* 🖼️ Asset grid */
                <div className="grid grid-cols-3 gap-2">
                  {recentAssets.slice(0, 12).map((asset) => (
                    <button key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className="group relative bg-stone-800/40 rounded-lg border border-stone-700/20 p-2 hover:border-violet-500/40 hover:bg-stone-800/70 transition-all text-left"
                    >
                      <div className="flex justify-center mb-1.5">
                        <img src={asset.previewUrl} alt={asset.name}
                          className="pixelated rounded"
                          style={{ width: 48, height: 48, imageRendering: "pixelated" }}
                        />
                      </div>
                      <p className="text-stone-400 text-[9px] font-mono truncate">{asset.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[8px] font-mono px-1 py-0.5 rounded ${
                          asset.qualityScore >= 6 ? "bg-emerald-900/30 text-emerald-400" :
                          asset.qualityScore >= 4 ? "bg-amber-900/30 text-amber-400" :
                          "bg-stone-800/50 text-stone-500"
                        }`}>
                          {asset.qualityScore}/10
                        </span>
                        <span className={`text-[8px] font-mono uppercase ${
                          asset.status === "approved" ? "text-emerald-500" :
                          asset.status === "review" ? "text-amber-500" :
                          "text-stone-600"
                        }`}>
                          {asset.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 🔍 Unknown agent fallback */}
          {!["popo", "testbench", "forge", "curator", "scout", "packager", "lister"].includes(selectedAgent) && (
            <div className="space-y-4">
              {/* Agent sprite preview */}
              <div className="flex justify-center py-2">
                <div className="bg-stone-800/80 rounded-lg border border-stone-700/50 p-4">
                  <AgentSprite
                    agentId={selectedAgent}
                    frame={selectedAgentState.frame}
                    size={80}
                    facing={selectedAgentState.facing}
                    animMode={selectedAgentState.animMode}
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
                    selectedAgentState.status === "walking" ? "border-blue-500/30 text-blue-400" :
                    selectedAgentState.status === "meeting" ? "border-violet-500/30 text-violet-400" :
                    selectedAgentState.status === "done" ? "border-emerald-500/30 text-emerald-400" :
                    "border-stone-600/30 text-stone-400"
                  }`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${
                      selectedAgentState.status === "working" ? "bg-emerald-500" :
                      selectedAgentState.status === "walking" ? "bg-blue-400" :
                      selectedAgentState.status === "meeting" ? "bg-violet-400" :
                      selectedAgentState.status === "done" ? "bg-emerald-400" : "bg-stone-600"
                    } ${selectedAgentState.pulse ? "animate-pulse" : ""}`} />
                    {selectedAgentState.status.toUpperCase()}
                  </div>
                </div>
                <div className="bg-stone-800/60 rounded-lg p-3 border border-stone-700/30">
                  <p className="text-stone-500 text-[10px] uppercase tracking-wider mb-1">Position</p>
                  <p className="text-stone-300 font-mono text-[11px]">({Math.round(selectedAgentState.gridX)}, {Math.round(selectedAgentState.gridY)})</p>
                </div>
              </div>

              {selectedAgentState.message && (
                <div className="bg-stone-800/60 rounded-lg p-3 border border-stone-700/30">
                  <p className="text-stone-500 text-[10px] uppercase tracking-wider mb-1">Last Report</p>
                  <p className="text-stone-300 text-xs leading-relaxed">{selectedAgentState.message}</p>
                </div>
              )}
            </div>
          )}
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
                No events yet. The autonomous pipeline is running...
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
        @keyframes meeting-bounce { 0%, 100% { transform: translateY(0) scale(1); } 25% { transform: translateY(-2px) scale(1.02); } 75% { transform: translateY(-2px) scale(1.02); } }
        .animate-bob { animation: bob 1s ease-in-out infinite; }
        .animate-shake { animation: shake 0.3s ease-in-out infinite; }
        .animate-bounce-in { animation: bounce-in 0.2s ease-out; }
        .animate-meeting-bounce { animation: meeting-bounce 0.8s ease-in-out infinite; }
        :global(.pixelated) { image-rendering: pixelated; image-rendering: crisp-edges; }
      `}</style>
    </div>
  )
}
