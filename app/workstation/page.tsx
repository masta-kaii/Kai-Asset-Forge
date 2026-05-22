"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import {
  Zap, Loader2, Clock,
  Cpu, Activity, Sparkles, ScrollText,
  X, Library, FileText, ListChecks,
  Eye, Footprints, RefreshCw,
  Building2, Moon, Star, Volume2, VolumeX,
  Hammer, Trophy, Coins, Skull, Flame,
  BookOpen, Gem, ArrowUpDown,
} from "lucide-react"
import { CuratorPanel } from "@/components/workstation/curator-panel"
import { ScoutPanel } from "@/components/workstation/scout-panel"
import { ListerPanel } from "@/components/workstation/lister-panel"
import type { Asset, PackLibraryEntry } from "@/lib/types"
import "./kairosoft-theme.css"
import "./dungeon-maze.css"
import {
  playPipelineStart, playStepComplete, playCycleComplete,
  playAgentClick, playLogNotification,
  startAmbientDrone, stopAmbientDrone,
} from "@/lib/factory-audio"
import {
  FRAME_INTERVAL, SCALE, PIPELINE_TICK_MS, PIPELINE_STEP_DURATION, WALK_SPEED,
  AGENTS, PIPELINE_STEPS, nextPipelineStep, prevPipelineStep,
  SOUL_LINES, MEETING_LINES, randomSoulLine, meetingLine,
  now, logTypeColor,
  type AgentDef, type AgentStatus, type WalkTarget, type AgentState, type LogEntry,
} from "@/lib/workstation-config"

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

  // 🎮 XP / Gold / Level system
  const [xp, setXp] = useState(0)
  const [gold, setGold] = useState(0)
  const [level, setLevel] = useState(1)
  const xpToNext = level * 100

  // 🏆 Achievement system
  interface Achievement { id: string; title: string; desc: string; icon: string; unlocked: boolean }
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: "first_cycle", title: "First Cycle!", desc: "Complete your first pipeline cycle", icon: "🔄", unlocked: false },
    { id: "forge_10", title: "Mass Production", desc: "Reach 10 pipeline cycles", icon: "🔨", unlocked: false },
    { id: "forge_25", title: "Factory Veteran", desc: "Reach 25 pipeline cycles", icon: "⚡", unlocked: false },
    { id: "forge_50", title: "Master Forger!", desc: "Reach 50 pipeline cycles", icon: "👑", unlocked: false },
    { id: "meeting", title: "Team Meeting!", desc: "Witness agents meet for the first time", icon: "🤝", unlocked: false },
    { id: "rich_100", title: "Gold Hoarder", desc: "Accumulate 100 gold", icon: "💰", unlocked: false },
    { id: "rich_500", title: "Treasure Vault", desc: "Accumulate 500 gold", icon: "🏦", unlocked: false },
    { id: "level_5", title: "Rising Star", desc: "Reach Level 5", icon: "⭐", unlocked: false },
  ])
  const [showAchievement, setShowAchievement] = useState(false)
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null)
  const achievementTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 🔨 Forge Modal state
  const [forgeModalOpen, setForgeModalOpen] = useState(false)
  const [forgeTheme, setForgeTheme] = useState("fantasy creatures")
  const [forgeCount, setForgeCount] = useState(3)
  const [forgeSubmitting, setForgeSubmitting] = useState(false)
  const [forgeResult, setForgeResult] = useState<string | null>(null)

  // ⚡ Killswitch
  const [pipelinePaused, setPipelinePaused] = useState(false)

  // 📚 Asset Pack Library state
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [selectedPack, setSelectedPack] = useState<PackLibraryEntry | null>(null)
  const [librarySort, setLibrarySort] = useState<"quality" | "newest" | "price">("quality")
  const [libraryFilter, setLibraryFilter] = useState<string>("all")

  // 🎯 Decision Popup state (Game Dev Story style)
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [decisionData, setDecisionData] = useState<{
    title: string
    body: string
    choices: { label: string; effect: string; action: () => void }[]
  } | null>(null)

  // 📊 Stats bar state (from real data)
  const [forgeStats, setForgeStats] = useState<{ trend: number; quality: number; hype: number; revenue: number }>({
    trend: 0, quality: 0, hype: 0, revenue: 0
  })

  // Generate pack library from pipeline progress
  const packLibrary = useMemo<PackLibraryEntry[]>(() => {
    const themes = [
      { name: "Dragon Hoard", theme: "dragon eggs & treasure", category: "creatures", baseScore: 8 },
      { name: "Crystal Cavern", theme: "magic crystals & gems", category: "items", baseScore: 7 },
      { name: "Shadow Realm", theme: "dark rituals & demons", category: "creatures", baseScore: 9 },
      { name: "Forest Spirits", theme: "nature sprites & fairies", category: "creatures", baseScore: 6 },
      { name: "Forged Steel", theme: "weapons & armor", category: "weapons", baseScore: 8 },
      { name: "Arcane Tomes", theme: "spell books & scrolls", category: "ui", baseScore: 7 },
      { name: "Potion Cabinet", theme: "alchemy bottles & elixirs", category: "items", baseScore: 8 },
      { name: "Dungeon Decor", theme: "torches, chains, banners", category: "environment", baseScore: 6 },
      { name: "Monster Manual", theme: "creature sprites pack", category: "creatures", baseScore: 9 },
      { name: "Treasure Vault", theme: "gold coins, crowns, gems", category: "mixed", baseScore: 8 },
      { name: "Battle Arena", theme: "arena tiles & props", category: "environment", baseScore: 7 },
      { name: "Inferno Forge", theme: "fire & lava assets", category: "weapons", baseScore: 9 },
    ]

    // More pipeline cycles = more packs unlocked
    const unlockedCount = Math.min(themes.length, Math.floor(pipelineCycle / 2) + 1)
    
    return themes.slice(0, unlockedCount).map((t, i) => {
      const quality = Math.min(10, t.baseScore + Math.floor(pipelineCycle / 10) + (Math.random() > 0.5 ? 1 : 0))
      const assetCount = 3 + Math.floor(Math.random() * 5) + Math.floor(pipelineCycle / 2)
      const price = quality >= 8 ? 7.99 : quality >= 6 ? 4.99 : 2.99
      const status: PackLibraryEntry["status"] = quality >= 7 ? "ready" : quality >= 5 ? "ready" : "draft"
      
      return {
        id: `pack-${i}`,
        title: t.name,
        theme: t.theme,
        qualityScore: quality,
        assetCount: Math.min(assetCount, 8),
        previewUrls: [],
        status,
        price,
        category: t.category,
        description: `A curated pack of ${t.theme} — ${assetCount} hand-crafted pixel art assets forged in the dungeon depths. Quality rated ${quality}/10 by the Curator.`,
        tags: t.theme.split(/[,\s&]+/).filter(w => w.length > 2).concat(["pixel-art", "game-assets"]),
      }
    })
  }, [pipelineCycle])

  const sortedLibrary = useMemo(() => {
    const sorted = [...packLibrary]
    if (librarySort === "quality") sorted.sort((a, b) => b.qualityScore - a.qualityScore)
    if (librarySort === "newest") sorted.reverse()
    if (librarySort === "price") sorted.sort((a, b) => b.price - a.price)
    if (libraryFilter !== "all") return sorted.filter(p => p.category === libraryFilter)
    return sorted
  }, [packLibrary, librarySort, libraryFilter])

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

  // Fetch assets for Test Bench
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
  const pipelinePausedRef = useRef(pipelinePaused)
  pipelinePausedRef.current = pipelinePaused

  // ── Logging ──
  const addLog = useCallback((agent: string, msg: string, type: LogEntry["type"] = "info") => {
    const id = ++logCounter.current
    const time = now().slice(0, 8)
    setLogs((p) => [...p.slice(-80), { id, time, agent, msg, type }])
  }, [])

  // 🎯 Decision Popup trigger — fires at end of each cycle
  const triggerDecisionPopup = useCallback((cycleNum: number) => {
    const choices = [
      {
        label: "Dungeon Tiles (+3 Quality)",
        effect: "forgePromptOverride",
        action: () => {
          setForgeTheme("16x16 dungeon floor and wall tiles, 0x72 palette")
          addLog("popo", "👑 DECISION: Dungeon Tiles — Forge configured!", "ok")
          setDecisionOpen(false)
        }
      },
      {
        label: "Monster Sprites (+3 Hype)",
        effect: "forgePromptOverride",
        action: () => {
          setForgeTheme("RPG monsters: goblin, skeleton, slime, dragon hatchling")
          addLog("popo", "👑 DECISION: Monster Sprites — Forge configured!", "ok")
          setDecisionOpen(false)
        }
      },
      {
        label: "UI Icons (+2 Revenue, +1 Speed)",
        effect: "forgePromptOverride",
        action: () => {
          setForgeTheme("pixel art RPG UI elements: health bar, coin, sword icon, potion")
          addLog("popo", "👑 DECISION: UI Icons — Forge configured!", "ok")
          setDecisionOpen(false)
        }
      },
      {
        label: "Let Scout decide (random)",
        effect: "random",
        action: () => {
          const allChoices = ["dungeon tiles", "RPG monsters", "UI icons"]
          const rand = allChoices[Math.floor(Math.random() * allChoices.length)]
          setForgeTheme(rand)
          addLog("popo", `👑 DECISION: Scout chose — ${rand}!`, "ok")
          setDecisionOpen(false)
        }
      },
    ]
    setDecisionData({
      title: `Cycle ${cycleNum} Complete!`,
      body: `The factory has finished another cycle. Scout detected market trends — what should the Forge produce next?`,
      choices,
    })
    setDecisionOpen(true)
    addLog("popo", `🎯 Decision time! Cycle ${cycleNum} complete.`, "info")
  }, [addLog, setForgeTheme])

  // 📊 Real Stats Polling
  useEffect(() => {
    async function pollStats() {
      try {
        const res = await fetch("/api/forge/stats")
        if (res.ok) {
          const data = await res.json()
          setForgeStats({
            trend: data.trend ?? 0,
            quality: data.quality ?? 0,
            hype: data.hype ?? 0,
            revenue: data.revenue ?? 0,
          })
        }
      } catch {}
    }
    pollStats()
    const interval = setInterval(pollStats, 30000)
    return () => clearInterval(interval)
  }, [])

  // ── Uptime ──
  useEffect(() => {
    const i = setInterval(() => setUptime((u) => u + 1), 1000)
    return () => clearInterval(i)
  }, [])

  // ── Real Agent Data (Hermes Kanban API) ──
  interface AgentApiTask {
    id: string; status: string; assignee: string; title: string
    hasFiles: boolean; fileCount: number; summary?: string
  }
  interface AgentApiData {
    agents: Record<string, { tasks: AgentApiTask[]; activeCount: number; doneCount: number; blockedCount: number }>
    totalTasks: number; kanbanStats: string; timestamp: number
  }
  const [agentApiData, setAgentApiData] = useState<AgentApiData | null>(null)
  
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/agents/status")
        if (res.ok) {
          const data = await res.json()
          setAgentApiData(data)
        }
      } catch { /* API not available yet */ }
    }
    poll()
    const interval = setInterval(poll, 15000) // every 15s
    return () => clearInterval(interval)
  }, [])

  // 🏭 REAL KANBAN OVERLAY — pulls actual agent statuses from the factory floor
  // Overrides the visual simulation with real Kanban task data
  const [kanbanOverride, setKanbanOverride] = useState(false)
  useEffect(() => {
    async function pollKanban() {
      try {
        const res = await fetch("/api/kanban/status")
        if (!res.ok) return
        const data = await res.json()
        if (!data?.agents) return

        const pipelineStepMap: Record<string, number> = {
          scout: 0, forge: 1, curator: 2, packager: 3, lister: 4,
        }

        setKanbanOverride(true)

        // Update agent statuses based on real Kanban data
        setAgents((prev) => {
          const next: Record<string, AgentState> = { ...prev }
          let changed = false

          for (const [agentId, kanbanAgent] of Object.entries(data.agents) as [string, any][]) {
            const st = next[agentId]
            if (!st) continue

            const hasActive = kanbanAgent.activeCount > 0
            const hasReady = kanbanAgent.readyCount > 0
            const hasBlocked = kanbanAgent.blockedCount > 0
            const isWorking = hasActive || hasReady

            if (hasBlocked && st.status !== "working") {
              next[agentId] = {
                ...st, status: "idle", pulse: true,
                message: `⚠ Blocked: ${kanbanAgent.blockedCount} task(s)`,
                animMode: "idle",
              }
              changed = true
            } else if (isWorking && st.status !== "working") {
              next[agentId] = {
                ...st, status: "working", pulse: true,
                message: hasActive
                  ? `🔨 Working: ${kanbanAgent.currentTask?.title?.slice(0, 40) ?? "Active task"}`
                  : `⏳ Ready: ${kanbanAgent.readyCount} task(s) queued`,
                animMode: "idle",
              }
              changed = true
            } else if (!isWorking && !hasBlocked && st.status !== "idle" && st.status !== "done") {
              next[agentId] = {
                ...st, status: "idle", pulse: false,
                message: kanbanAgent.doneCount > 0 ? `✅ ${kanbanAgent.doneCount} completed` : "",
                animMode: "idle",
              }
              changed = true
            }
          }

          return changed ? next : prev
        })

        // Set current pipeline step from real data
        if (data.pipeline?.currentStep !== undefined && data.pipeline.currentStep >= 0) {
          setCurrentPipelineStep(data.pipeline.currentStep)
        }

        // Update board stats
        if (data.board) {
          setPipelineCycle(data.board.doneTotal)
        }
      } catch {}
    }

    pollKanban()
    const kanbanInterval = setInterval(pollKanban, 8000) // every 8s
    return () => clearInterval(kanbanInterval)
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

    schedulerRef.current = setInterval(() => {
      // ⚡ Killswitch guard — skip if paused
      if (pipelinePausedRef.current) return

      const currentStepIdx = pipelineStepRef.current
      const currentCycle = pipelineCycleRef.current
      stepTimer += PIPELINE_TICK_MS

      // Update step progress
      setStepProgress(Math.min(1, stepTimer / PIPELINE_STEP_DURATION))

      // Update walk movements
      setAgents((prev) => updateWalk(prev))

      if (stepTimer >= PIPELINE_STEP_DURATION) {
        // Pipeline step complete
        stepTimer = 0

        setAgents((prev) => {
          const next: Record<string, AgentState> = {}
          for (const [id, st] of Object.entries(prev)) {
            next[id] = { ...st }
          }

          const currentStep = PIPELINE_STEPS[currentStepIdx]
          const nextStep = PIPELINE_STEPS[nextPipelineStep(currentStepIdx)]
          const stepAgent = currentStep.agentId

          // Current step agent → done briefly, then back to idle
          if (next[stepAgent]) {
            if (next[stepAgent].status === "working" || next[stepAgent].status === "idle") {
              next[stepAgent] = {
                ...next[stepAgent],
                status: "done",
                pulse: false,
                message: `${currentStep.name} complete!`,
                animMode: "idle",
              }
              // Add log
              addLog(stepAgent, `${currentStep.name} complete!`, "ok")
              // Play sound
              if (soundEnabled) playStepComplete()
            }
          }

          // Next step agent starts walking toward previous agent's position
          if (next[nextStep.agentId] && next[stepAgent]) {
            const prevAgentPos = {
              x: Math.round(next[stepAgent].gridX),
              y: Math.round(next[stepAgent].gridY),
            }
            const def = AGENTS.find(a => a.id === nextStep.agentId)
            if (def) {
              next[nextStep.agentId] = {
                ...next[nextStep.agentId],
                status: "walking",
                message: `Heading to ${currentStep.agentId}...`,
                animMode: "run",
                walk: {
                  fromX: def.homeX,
                  fromY: def.homeY,
                  targetX: prevAgentPos.x,
                  targetY: prevAgentPos.y,
                  walkProgress: 0,
                },
                facing: prevAgentPos.x > def.homeX ? "right" : "left",
              }
            }
          }

          return next
        })

        // Advance pipeline step
        setCurrentPipelineStep((prev) => nextPipelineStep(prev))
        setPipelineCycle((c) => {
          const newCycle = c + 1
          // Play cycle complete at the end of a full cycle (every 5 steps)
          if (soundEnabled && newCycle % PIPELINE_STEPS.length === 0) {
            playCycleComplete()
          }
          // 🎯 Trigger decision popup every full cycle (every 5 steps)
          if (newCycle % PIPELINE_STEPS.length === 0) {
            const cycleNum = Math.floor(newCycle / PIPELINE_STEPS.length)
            triggerDecisionPopup(cycleNum)
          }
          return newCycle
        })
      } else if (stepTimer === PIPELINE_TICK_MS) {
        // Just started a new step
        setAgents((prev) => {
          const next: Record<string, AgentState> = {}
          for (const [id, st] of Object.entries(prev)) {
            next[id] = { ...st }
          }

          const currentStep = PIPELINE_STEPS[currentStepIdx]
          const stepAgent = currentStep.agentId

          // If this agent just arrived from walking and is at home, switch to working
          const def = AGENTS.find(a => a.id === stepAgent)
          if (def && next[stepAgent]) {
            if (next[stepAgent].status !== "walking") {
              next[stepAgent] = {
                ...next[stepAgent],
                status: "working" as AgentStatus,
                pulse: true,
                message: currentStep.label,
                animMode: "idle",
                gridX: def.homeX,
                gridY: def.homeY,
                walk: null,
              }
              addLog(stepAgent, currentStep.label, "info")
            }
          }

          return next
        })
      } else if (stepTimer > PIPELINE_TICK_MS && stepTimer < PIPELINE_STEP_DURATION) {
        // Mid-step: check for walking agents that arrived
        setAgents((prev) => {
          const next: Record<string, AgentState> = {}
          let changed = false
          for (const [id, st] of Object.entries(prev)) {
            let n = { ...st }
            // If walking agent arrived (walk was consumed, at target)
            if (n.status === "walking" && !n.walk) {
              // They've arrived - switch to working at their home
              const def = AGENTS.find(a => a.id === id)
              if (def) {
                n = {
                  ...n,
                  status: "working" as AgentStatus,
                  pulse: true,
                  message: PIPELINE_STEPS.find(s => s.agentId === id)?.label ?? "Working...",
                  animMode: "idle",
                  gridX: def.homeX,
                  gridY: def.homeY,
                }
                changed = true
              }
            }
            next[id] = n
          }
          return changed ? next : prev
        })
      }

      // ── Random buddy visits ──
      if (Math.random() < 0.15) { // ~15% chance per tick
        const allIds = AGENTS.map(a => a.id)
        const idx = Math.floor(Math.random() * allIds.length)
        const walkerId = allIds[idx]

        setAgents((prev) => {
          if (!prev[walkerId] || prev[walkerId].status !== "idle") return prev
          const def = AGENTS.find(a => a.id === walkerId)
          if (!def) return prev

          // Pick a random buddy (different agent)
          const buddies = AGENTS.filter(a => a.id !== walkerId)
          const buddy = buddies[Math.floor(Math.random() * buddies.length)]

          const next: Record<string, AgentState> = { ...prev }
          next[walkerId] = {
            ...next[walkerId],
            status: "walking" as AgentStatus,
            message: `Visiting ${buddy.label}...`,
            animMode: "run",
            walk: {
              fromX: def.homeX,
              fromY: def.homeY,
              targetX: buddy.homeX,
              targetY: buddy.homeY,
              walkProgress: 0,
            },
            facing: buddy.homeX > def.homeX ? "right" : "left",
          }
          return next
        })
      }

      // ── Popo checks on random agent ──
      if (Math.random() < 0.12) {
        setAgents((prev) => {
          if (!prev["popo"] || prev["popo"].status !== "idle") return prev
          const popoDef = AGENTS.find(a => a.id === "popo")
          if (!popoDef) return prev

          const targets = AGENTS.filter(a => a.id !== "popo" && prev[a.id]?.status === "working")
          if (targets.length === 0) return prev
          const target = targets[Math.floor(Math.random() * targets.length)]

          const next: Record<string, AgentState> = { ...prev }
          next["popo"] = {
            ...next["popo"],
            status: "walking" as AgentStatus,
            message: `Checking on ${target.label}...`,
            animMode: "run",
            walk: {
              fromX: popoDef.homeX,
              fromY: popoDef.homeY,
              targetX: target.homeX,
              targetY: target.homeY,
              walkProgress: 0,
            },
            facing: target.homeX > popoDef.homeX ? "right" : "left",
          }
          return next
        })
      }

      // ── Meeting detection ──
      setAgents((prev) => {
        const next: Record<string, AgentState> = { ...prev }
        // Check all pairs
        for (let i = 0; i < AGENTS.length; i++) {
          for (let j = i + 1; j < AGENTS.length; j++) {
            const a = AGENTS[i]; const b = AGENTS[j]
            const sa = next[a.id]; const sb = next[b.id]
            if (!sa || !sb) continue
            const ax = Math.round(sa.gridX); const ay = Math.round(sa.gridY)
            const bx = Math.round(sb.gridX); const by = Math.round(sb.gridY)
            const dist = Math.abs(ax - bx) + Math.abs(ay - by)
            if (dist <= 1 && (sa.status === "walking" || sa.status === "working") && (sb.status === "walking" || sb.status === "working" || sb.status === "idle")) {
              // Both agents are close — start meeting
              next[a.id] = {
                ...sa,
                status: "meeting",
                message: meetingLine(a.id, b.id),
                animMode: "idle",
                walk: null,
                pulse: false,
              }
              next[b.id] = {
                ...sb,
                status: "meeting",
                message: meetingLine(a.id, b.id),
                animMode: "idle",
                walk: null,
                pulse: false,
              }
            }
          }
        }
        return next
      })
    }, PIPELINE_TICK_MS)

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

  // ── Achievement detection + XP/Gold earning ──
  const levelRef = useRef(level)
  levelRef.current = level
  const goldRef = useRef(gold)
  goldRef.current = gold

  useEffect(() => {
    // Earn XP and gold per cycle
    if (pipelineCycle > 0) {
      const earnedXp = 10 + Math.floor(Math.random() * 15)
      const earnedGold = 3 + Math.floor(Math.random() * 8)
      setXp((x) => {
        const newXp = x + earnedXp
        if (newXp >= levelRef.current * 100) {
          setLevel((l) => l + 1)
          return newXp - levelRef.current * 100
        }
        return newXp
      })
      setGold((g) => g + earnedGold)
    }

    // Check achievements (runs slightly after state update via setTimeout)
    setTimeout(() => {
      setAchievements((prev) => {
        const unlocked = prev.find(a => !a.unlocked && (
          (a.id === "first_cycle" && pipelineCycle >= 1) ||
          (a.id === "forge_10" && pipelineCycle >= 10) ||
          (a.id === "forge_25" && pipelineCycle >= 25) ||
          (a.id === "forge_50" && pipelineCycle >= 50) ||
          (a.id === "rich_100" && goldRef.current >= 100) ||
          (a.id === "rich_500" && goldRef.current >= 500) ||
          (a.id === "level_5" && levelRef.current >= 5)
        ))
        if (unlocked) {
          setCurrentAchievement(unlocked)
          setShowAchievement(true)
          if (achievementTimer.current) clearTimeout(achievementTimer.current)
          achievementTimer.current = setTimeout(() => setShowAchievement(false), 4000)
          addLog("popo", `🏆 Achievement: ${unlocked.title}!`, "ok")
          return prev.map(a => a.id === unlocked.id ? { ...a, unlocked: true } : a)
        }
        return prev
      })
    }, 100)
  }, [pipelineCycle])

  // ── Meeting achievement check ──
  useEffect(() => {
    const hasMeeting = Object.values(agents).some(a => a.status === "meeting")
    if (hasMeeting) {
      setAchievements((prev) => {
        const ach = prev.find(a => a.id === "meeting" && !a.unlocked)
        if (ach) {
          setCurrentAchievement(ach)
          setShowAchievement(true)
          if (achievementTimer.current) clearTimeout(achievementTimer.current)
          achievementTimer.current = setTimeout(() => setShowAchievement(false), 4000)
          addLog("popo", `🏆 Achievement: ${ach.title}!`, "ok")
          return prev.map(a => a.id === "meeting" ? { ...a, unlocked: true } : a)
        }
        return prev
      })
    }
  }, [agents])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key.toLowerCase()) {
        case "escape": setSelectedAgent(null); setShowLogModal(false); setForgeModalOpen(false); setLibraryOpen(false); setSelectedPack(null); setDecisionOpen(false); break
        case "l": setLibraryOpen(true); break
        case "f": setForgeModalOpen(true); break
        case "k": setPipelinePaused((p) => !p); addLog("popo", pipelinePaused ? "Killswitch RELEASED — pipeline resuming!" : "⚠ KILLSWITCH ENGAGED — pipeline halted!", pipelinePaused ? "ok" : "warn"); break
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
          <div className={`h-2 w-2 rounded-full ${pipelinePaused ? "bg-red-500 shadow-[0_0_6px_#ef4444] animate-pulse" : "bg-emerald-500 shadow-[0_0_6px_#34d399] animate-pulse"}`} />
          <span className={pipelinePaused ? "text-red-400" : "text-emerald-400"}>{pipelinePaused ? "HALTED" : kanbanOverride ? "KANBAN LIVE" : "SIM"}</span>
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
          {/* XP Bar */}
          <span className="flex items-center gap-1 text-[10px]">
            <Star className="h-3 w-3 text-yellow-500" />
            <span className="font-mono text-yellow-400 tabular-nums">Lv.{level}</span>
            <div className="w-16 h-1.5 bg-stone-800 rounded-full overflow-hidden border border-stone-700/50">
              <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500" style={{ width: `${(xp / xpToNext) * 100}%` }} />
            </div>
            <span className="font-mono text-stone-500 text-[9px]">{xp}/{xpToNext}</span>
          </span>
          {/* Gold */}
          <span className="flex items-center gap-1 text-[10px]">
            <Coins className="h-3 w-3 text-amber-400" />
            <span className="font-mono text-amber-300 tabular-nums">{gold}</span>
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Real Agent Activity (from Hermes Kanban) */}
        {agentApiData && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-stone-500">KANBAN</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
              <span className="text-stone-400">{agentApiData.totalTasks} tasks</span>
            </span>
            {["scout","forge","curator","packager","lister"].map((id) => {
              const a = agentApiData.agents[id]
              return a ? (
                <span key={id} className="flex items-center gap-0.5">
                  <span className={a.blockedCount > 0 ? "text-red-400" : a.activeCount > 0 ? "text-emerald-400" : "text-stone-500"}>
                    {id[0].toUpperCase()}
                  </span>
                  <span className="text-stone-600">{a.doneCount}</span>
                </span>
              ) : null
            })}
          </div>
        )}

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

        {/* Library button */}
        <a href="/library"
          className="flex items-center gap-1 px-2 py-0.5 rounded border border-violet-700/30 hover:border-violet-500/50 text-violet-400 hover:text-violet-300 transition-colors text-[10px] bg-violet-950/20 no-underline">
          <BookOpen className="h-3 w-3" />
          LIBRARY
        </a>
      </div>

      {/* ═══════ ACHIEVEMENT TOAST ═══════ */}
      {showAchievement && currentAchievement && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] animate-slide-down pointer-events-none">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-yellow-500/60 bg-stone-900/95 shadow-[0_0_30px_rgba(255,200,50,0.3)] backdrop-blur">
            <span className="text-2xl">{currentAchievement.icon}</span>
            <div>
              <p className="font-mono text-sm text-yellow-300 font-bold tracking-wider">{currentAchievement.title}</p>
              <p className="font-mono text-[10px] text-stone-400">{currentAchievement.desc}</p>
            </div>
            <Trophy className="h-5 w-5 text-yellow-500" />
          </div>
        </div>
      )}

      {/* ═══════ DUNGEON FLOOR — FULL SCREEN ═══════ */}
      <div className="flex-1 relative overflow-hidden">
        {/* Torchlit ambient glow */}
        <div className="pointer-events-none absolute inset-0 z-10" style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(255,180,40,0.06) 0%, transparent 60%), radial-gradient(ellipse at 25% 25%, rgba(255,140,40,0.03) 0%, transparent 50%), radial-gradient(ellipse at 75% 75%, rgba(255,140,40,0.03) 0%, transparent 50%)",
        }} />

        {/* 🏰 Wing ambient overlays */}
        <div className="pointer-events-none absolute inset-0 z-11">
          <div className="wing-ambient wing-discovery-bg" style={{ top: 0, height: "33.33%" }} />
          <div className="wing-ambient wing-command-bg" style={{ top: "33.33%", height: "33.33%" }} />
          <div className="wing-ambient wing-commerce-bg" style={{ top: "66.66%", height: "33.34%" }} />
        </div>

        {/* 🌀 Maze corridor SVG overlay */}
        <svg className="absolute inset-0 z-5 w-full h-full pointer-events-none" viewBox="0 0 300 300" preserveAspectRatio="none">
          <defs>
            <filter id="mazeGlow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Horizontal maze corridors — staggered for dungeon feel */}
          <line x1="0" y1="100" x2="115" y2="100" stroke="rgba(168,85,247,0.25)" strokeWidth="1.5" strokeDasharray="4,6" filter="url(#mazeGlow)" className="maze-corridor-glow" />
          <line x1="185" y1="100" x2="300" y2="100" stroke="rgba(168,85,247,0.25)" strokeWidth="1.5" strokeDasharray="4,6" filter="url(#mazeGlow)" className="maze-corridor-glow" />
          <line x1="0" y1="200" x2="115" y2="200" stroke="rgba(251,191,36,0.2)" strokeWidth="1.5" strokeDasharray="4,6" filter="url(#mazeGlow)" className="maze-corridor-glow" />
          <line x1="185" y1="200" x2="300" y2="200" stroke="rgba(251,191,36,0.2)" strokeWidth="1.5" strokeDasharray="4,6" filter="url(#mazeGlow)" className="maze-corridor-glow" />
          {/* Vertical maze corridors */}
          <line x1="100" y1="0" y2="90" x2="100" stroke="rgba(168,85,247,0.25)" strokeWidth="1.5" strokeDasharray="4,6" filter="url(#mazeGlow)" className="maze-corridor-glow" />
          <line x1="100" y1="110" y2="190" x2="100" stroke="rgba(251,191,36,0.2)" strokeWidth="1.5" strokeDasharray="4,6" filter="url(#mazeGlow)" className="maze-corridor-glow" />
          <line x1="100" y1="210" y2="300" x2="100" stroke="rgba(52,211,153,0.2)" strokeWidth="1.5" strokeDasharray="4,6" filter="url(#mazeGlow)" className="maze-corridor-glow" />
          <line x1="200" y1="0" y2="90" x2="200" stroke="rgba(168,85,247,0.25)" strokeWidth="1.5" strokeDasharray="4,6" filter="url(#mazeGlow)" className="maze-corridor-glow" />
          <line x1="200" y1="110" y2="190" x2="200" stroke="rgba(251,191,36,0.2)" strokeWidth="1.5" strokeDasharray="4,6" filter="url(#mazeGlow)" className="maze-corridor-glow" />
          <line x1="200" y1="210" y2="300" x2="200" stroke="rgba(52,211,153,0.2)" strokeWidth="1.5" strokeDasharray="4,6" filter="url(#mazeGlow)" className="maze-corridor-glow" />
        </svg>

        {/* Kairosoft Day Counter + Factory Controls */}
        <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="kairosoft-day-counter pointer-events-auto">
            <Building2 className="h-3 w-3" />
            <span className="day-number">Day {pipelineCycle + 1}</span>
          </div>
          <div className="flex gap-2 pointer-events-auto">
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
                  className={`relative cursor-pointer group ${agent.homeY === 0 ? "wing-discovery" : agent.homeY === 1 ? "wing-command" : "wing-commerce"}`}
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
                        <Image src={`/sprites/${agent.propDir || "tiles"}/${agent.prop}.png`} alt="" width={16 * SCALE} height={16 * SCALE} className="pixelated" unoptimized />
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
          <span><span className="text-yellow-500">F</span> Forge</span>
          <span><span className="text-red-500">K</span> Kill</span>
          <span><span className="text-violet-400">L</span> Library</span>
        </div>

        {/* ═══════ FLOATING FORGE BUTTON ═══════ */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
          {/* KILLSWITCH */}
          <button
            onClick={() => {
              setPipelinePaused((p) => {
                const next = !p
                addLog("popo", next ? "⚠ KILLSWITCH ENGAGED — pipeline halted!" : "▶ Killswitch RELEASED — pipeline resuming!", next ? "warn" : "ok")
                return next
              })
            }}
            className={`group relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
              pipelinePaused
                ? "border-red-500 bg-red-950/80 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse"
                : "border-stone-700/50 bg-stone-900/60 hover:border-red-500/60 hover:bg-red-950/40"
            }`}
            title="KILLSWITCH (K)"
          >
            <Skull className={`h-5 w-5 transition-colors ${pipelinePaused ? "text-red-400" : "text-stone-500 group-hover:text-red-400"}`} />
          </button>

          {/* FORGE */}
          <button
            onClick={() => {
              setForgeModalOpen(true)
              if (soundEnabled) playAgentClick()
            }}
            className="group relative flex items-center justify-center w-16 h-16 rounded-full border-2 border-amber-500/60 bg-amber-950/80 hover:bg-amber-900/80 transition-all duration-300 shadow-[0_0_30px_rgba(255,200,50,0.3)] hover:shadow-[0_0_50px_rgba(255,200,50,0.5)] hover:scale-110"
            title="FORGE (F)"
          >
            <Hammer className="h-7 w-7 text-amber-400 group-hover:text-yellow-300 transition-colors animate-bob-slow" />
            <div className="absolute -inset-1 rounded-full border border-amber-500/20 animate-ping-slow" />
          </button>
        </div>
      </div>

      {/* ═══════ STATS BAR (Game Dev Story style) ═══════ */}
      <div className="stats-bar shrink-0 flex items-center justify-around px-2 py-2 border-t border-yellow-900/30">
        <div className="stat-item flex flex-col items-center px-6">
          <span className="stat-label">📈 TREND</span>
          <span className="stat-value">{forgeStats.trend}</span>
        </div>
        <div className="stat-item flex flex-col items-center px-6">
          <span className="stat-label">⭐ QUALITY</span>
          <span className="stat-value">{forgeStats.quality > 0 ? forgeStats.quality.toFixed(1) : "-"}</span>
        </div>
        <div className="stat-item flex flex-col items-center px-6">
          <span className="stat-label">🔥 HYPE</span>
          <span className="stat-value">{forgeStats.hype}</span>
        </div>
        <div className="flex flex-col items-center px-6">
          <span className="stat-label">💰 REVENUE</span>
          <span className="stat-value">${forgeStats.revenue.toFixed(2)}</span>
        </div>
      </div>

      {/* ═══════ PIPELINE PROGRESS BAR ═══════ */}
      <PipelineBar currentStep={currentPipelineStep} stepProgress={stepProgress} />

      {/* ═══════ DECISION POPUP (Game Dev Story style) ═══════ */}
      {decisionOpen && decisionData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDecisionOpen(false)}>
          <div className="decision-popup animate-decision-enter max-w-sm w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <div className="decision-title-bar">
              👑 {decisionData.title}
            </div>
            <div className="p-4 space-y-3">
              <p className="font-mono text-xs text-stone-300 leading-relaxed">{decisionData.body}</p>
              <div className="space-y-2">
                {decisionData.choices.map((choice, i) => (
                  <button
                    key={i}
                    onClick={choice.action}
                    className="decision-btn w-full text-left flex items-center gap-2"
                  >
                    <span className="text-yellow-500 text-sm">{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1">{choice.label}</span>
                  </button>
                ))}
              </div>
              <p className="font-mono text-[8px] text-stone-600 text-center mt-2">Click a choice or press Esc to skip</p>
            </div>
          </div>
        </div>
      )}

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
              case "treasure": return <Sparkles className="h-4 w-4" />
              case "armory": return <Zap className="h-4 w-4" />
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
              {/* 🎒 Inventory */}
              <div className="kairosoft-dept-card col-span-2">
                <div className="card-title"><span className="card-icon">🎒</span>Inventory</div>
                <div className="flex gap-2 flex-wrap mt-1">
                  {[
                    { name: "Iron Ore", icon: "🪨", qty: 12 + pipelineCycle },
                    { name: "Gold Bar", icon: "🟡", qty: Math.floor(pipelineCycle / 2) + 2 },
                    { name: "Dragon Scale", icon: "🛡️", qty: Math.max(1, pipelineCycle) },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-800/60 border border-stone-700/30">
                      <span className="text-[11px]">{item.icon}</span>
                      <span className="text-[8px] font-mono text-stone-400">{item.name}</span>
                      <span className="text-[8px] font-mono text-amber-400">×{item.qty}</span>
                    </div>
                  ))}
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
              {/* 🎒 Inventory */}
              <div className="kairosoft-dept-card col-span-2">
                <div className="card-title"><span className="card-icon">🎒</span>Inventory</div>
                <div className="flex gap-2 flex-wrap mt-1">
                  {[
                    { name: "Magnifying Glass", icon: "🔍", qty: 1 },
                    { name: "QC Stamp", icon: "✅", qty: 3 + pipelineCycle },
                    { name: "Reject Notice", icon: "📋", qty: Math.max(0, Math.floor(pipelineCycle / 5)) },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-800/60 border border-stone-700/30">
                      <span className="text-[11px]">{item.icon}</span>
                      <span className="text-[8px] font-mono text-stone-400">{item.name}</span>
                      <span className="text-[8px] font-mono text-amber-400">×{item.qty}</span>
                    </div>
                  ))}
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
              {/* 🎒 Inventory */}
              <div className="kairosoft-dept-card col-span-2">
                <div className="card-title"><span className="card-icon">🎒</span>Inventory</div>
                <div className="flex gap-2 flex-wrap mt-1">
                  {[
                    { name: "Spyglass", icon: "🔭", qty: 1 },
                    { name: "Market Intel", icon: "📊", qty: 2 + pipelineCycle },
                    { name: "Bounty Poster", icon: "📜", qty: Math.floor(pipelineCycle / 3) + 1 },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-800/60 border border-stone-700/30">
                      <span className="text-[11px]">{item.icon}</span>
                      <span className="text-[8px] font-mono text-stone-400">{item.name}</span>
                      <span className="text-[8px] font-mono text-amber-400">×{item.qty}</span>
                    </div>
                  ))}
                </div>
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
              {/* 🎒 Inventory */}
              <div className="kairosoft-dept-card col-span-2">
                <div className="card-title"><span className="card-icon">🎒</span>Inventory</div>
                <div className="flex gap-2 flex-wrap mt-1">
                  {[
                    { name: "Bundle Wrapper", icon: "🎁", qty: 1 + Math.floor(pipelineCycle / 2) },
                    { name: "Packing Tape", icon: "📎", qty: 5 + pipelineCycle },
                    { name: "Label Maker", icon: "🏷️", qty: 1 },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-800/60 border border-stone-700/30">
                      <span className="text-[11px]">{item.icon}</span>
                      <span className="text-[8px] font-mono text-stone-400">{item.name}</span>
                      <span className="text-[8px] font-mono text-amber-400">×{item.qty}</span>
                    </div>
                  ))}
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
              {/* 🎒 Inventory */}
              <div className="kairosoft-dept-card col-span-2">
                <div className="card-title"><span className="card-icon">🎒</span>Inventory</div>
                <div className="flex gap-2 flex-wrap mt-1">
                  {[
                    { name: "Listing Sheet", icon: "📄", qty: 1 + Math.floor(pipelineCycle / 2) },
                    { name: "Price Tags", icon: "💰", qty: 3 + pipelineCycle },
                    { name: "Sales Ledger", icon: "📒", qty: 1 },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-800/60 border border-stone-700/30">
                      <span className="text-[11px]">{item.icon}</span>
                      <span className="text-[8px] font-mono text-stone-400">{item.name}</span>
                      <span className="text-[8px] font-mono text-amber-400">×{item.qty}</span>
                    </div>
                  ))}
                </div>
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

              {/* 🏆 Achievements */}
              <div>
                <p className="text-stone-500 text-[10px] font-mono uppercase mb-2">🏆 Achievements ({achievements.filter(a => a.unlocked).length}/{achievements.length})</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {achievements.map((ach) => (
                    <div key={ach.id} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-mono ${
                      ach.unlocked
                        ? "border-yellow-600/30 bg-yellow-950/20 text-yellow-300"
                        : "border-stone-700/20 bg-stone-800/20 text-stone-600"
                    }`}>
                      <span className={ach.unlocked ? "" : "grayscale opacity-50"}>{ach.icon}</span>
                      <span className="truncate">{ach.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent sprite preview */}
              <div className="flex justify-center py-1">
                <AgentSprite agentId="popo" frame={selectedAgentState.frame} size={64} facing="right"
                  className="drop-shadow-[0_0_14px_rgba(255,215,0,0.4)]" />
              </div>

              {/* 🎒 Popo's Inventory */}
              <div>
                <p className="text-stone-500 text-[10px] font-mono uppercase mb-2">🎒 Popo's Inventory</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { name: "CEO Badge", icon: "👑", qty: 1 },
                    { name: "Factory Keys", icon: "🔑", qty: 1 },
                    { name: "Gold Coins", icon: "🪙", qty: gold },
                    { name: "Reports", icon: "📋", qty: Math.floor(pipelineCycle / 5) + 1 },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-1 px-2 py-1 rounded bg-stone-800/60 border border-stone-700/30">
                      <span className="text-sm">{item.icon}</span>
                      <span className="text-[9px] font-mono text-stone-400">{item.name}</span>
                      <span className="text-[9px] font-mono text-amber-400">×{item.qty}</span>
                    </div>
                  ))}
                </div>
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

          {/* 💰 Treasure Vault */}
          {selectedAgent === "treasure" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-stone-700/30">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                <span className="font-mono text-xs text-stone-400 uppercase tracking-wider">
                  Treasure Vault · The Factory's Riches
                </span>
              </div>
              <p className="text-stone-500 text-[11px] font-mono leading-relaxed">
                Glittering gold and precious gems fill this chamber. Every asset the factory
                produces adds to the treasury. The Vault Guardian watches over the accumulated
                wealth — coins, gems, crowns, and legendary artifacts.
              </p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {["chest_large", "icon_gem", "icon_coin"].map((item) => (
                  <div key={item} className="bg-stone-800/40 rounded-lg border border-yellow-600/20 p-3 flex flex-col items-center gap-1 hover:border-yellow-500/40 transition-all">
                    <Image src={`/sprites/${item.startsWith("icon_") ? "ui" : "furniture"}/${item}.png`}
                      alt={item} width={32} height={32} className="pixelated" unoptimized />
                    <span className="text-stone-400 text-[9px] font-mono capitalize">{item.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 p-2 bg-yellow-900/10 rounded border border-yellow-700/20">
                <Sparkles className="h-3 w-3 text-yellow-400" />
                <p className="text-yellow-400/70 text-[10px] font-mono">Pipeline cycle: {pipelineCycle} · Treasury grows with every forge!</p>
              </div>
            </div>
          )}

          {/* ⚔️ Armory */}
          {selectedAgent === "armory" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-stone-700/30">
                <Zap className="h-4 w-4 text-stone-300" />
                <span className="font-mono text-xs text-stone-400 uppercase tracking-wider">
                  Armory · Weapons & Gear
                </span>
              </div>
              <p className="text-stone-500 text-[11px] font-mono leading-relaxed">
                Steel sings and shields gleam. The Armory holds the factory's combat-ready
                arsenal — axes, bows, staffs, and armor forged in dragon fire. Equip your
                agents for the battles ahead!
              </p>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {["axe_battle", "bow", "mace", "dagger", "spear", "wand", "helmet_iron", "crown"].map((item) => (
                  <div key={item} className="bg-stone-800/40 rounded-lg border border-stone-600/20 p-2 flex flex-col items-center gap-1 hover:border-stone-400/40 transition-all">
                    <Image src={`/sprites/weapons/${item}.png`}
                      alt={item} width={24} height={24} className="pixelated" unoptimized />
                    <span className="text-stone-500 text-[7px] font-mono capitalize text-center leading-tight">{item.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 p-2 bg-stone-800/40 rounded border border-stone-700/20">
                <Zap className="h-3 w-3 text-amber-400" />
                <p className="text-stone-400 text-[10px] font-mono">14 weapons · 5 armor pieces · Forged in the dungeon depths</p>
              </div>
            </div>
          )}

          {/* 🔍 Unknown agent fallback */}
          {!["popo", "testbench", "forge", "curator", "scout", "packager", "lister", "treasure", "armory"].includes(selectedAgent) && (
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

      {/* ═══════ POPUP: ASSET PACK LIBRARY ═══════ */}
      {libraryOpen && (
        <GameWindow
          title={`📚 ASSET PACK LIBRARY · ${packLibrary.length} Packs`}
          icon={<BookOpen className="h-4 w-4" />}
          onClose={() => { setLibraryOpen(false); setSelectedPack(null); setLibraryFilter("all") }}
          className="kairosoft-window-v2 max-w-2xl! !max-w-[640px]"
        >
          <div className="space-y-3">
            {selectedPack ? (
              /* 📦 Pack Detail View */
              <div className="space-y-3">
                <button onClick={() => setSelectedPack(null)}
                  className="text-[10px] font-mono text-violet-400 hover:text-violet-300 flex items-center gap-1">
                  ← Back to Library
                </button>

                {/* Pack header */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-stone-800/40 border border-violet-700/20">
                  <div className="shrink-0 w-16 h-16 rounded-lg bg-stone-900/80 border border-stone-700/30 flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-mono text-sm text-stone-200 font-bold truncate">{selectedPack.title}</h3>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase ${
                        selectedPack.qualityScore >= 8 ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/30" :
                        selectedPack.qualityScore >= 6 ? "bg-amber-900/40 text-amber-400 border border-amber-700/30" :
                        "bg-red-900/30 text-red-400 border border-red-700/20"
                      }`}>
                        {selectedPack.qualityScore}/10
                      </span>
                    </div>
                    <p className="font-mono text-[9px] text-stone-500 mb-2">{selectedPack.description}</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[8px] font-mono text-stone-600 bg-stone-800/50 px-1.5 py-0.5 rounded">
                        📦 {selectedPack.assetCount} assets
                      </span>
                      <span className="text-[8px] font-mono text-stone-600 bg-stone-800/50 px-1.5 py-0.5 rounded">
                        💰 ${selectedPack.price}
                      </span>
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                        selectedPack.status === "ready" ? "bg-emerald-900/30 text-emerald-400" :
                        selectedPack.status === "published" ? "bg-blue-900/30 text-blue-400" :
                        "bg-stone-800/30 text-stone-500"
                      }`}>
                        {selectedPack.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pack contents — asset grid */}
                <div>
                  <p className="font-mono text-[9px] text-stone-500 uppercase tracking-wider mb-2">
                    📋 Pack Contents
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: selectedPack.assetCount }).map((_, i) => {
                      const assetNames = [
                        "Dragon Egg", "Gold Coin", "Magic Crystal", "Enchanted Sword",
                        "Shadow Orb", "Forest Sprite", "Iron Shield", "Spell Scroll",
                        "Health Potion", "Torch Sconce", "Demon Horn", "Treasure Chest",
                        "Fire Staff", "Ice Shard", "Thunder Axe", "Void Gem",
                      ]
                      const name = assetNames[i % assetNames.length]
                      const colors = ["#fbbf24", "#a78bfa", "#34d399", "#f97316", "#3b82f6", "#f87171", "#22c55e", "#eab308"]
                      const color = colors[i % colors.length]
                      return (
                        <div key={i} className="bg-stone-800/40 rounded-lg border border-stone-700/20 p-2 flex flex-col items-center gap-1 hover:border-violet-500/30 transition-all">
                          <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                            <Gem className="h-5 w-5" style={{ color }} />
                          </div>
                          <span className="text-[7px] font-mono text-stone-500 text-center leading-tight truncate w-full">
                            {name}
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="h-1 w-1 rounded-full bg-emerald-500" />
                            <span className="text-[6px] font-mono text-stone-600">
                              {selectedPack.qualityScore + Math.floor(Math.random() * 2)}/10
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {selectedPack.tags.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-stone-800/60 text-stone-500 text-[8px] font-mono border border-stone-700/20">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              /* 📚 Library Grid View */
              <>
                {/* Controls */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-700/30">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setLibraryFilter("all")}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all ${
                        libraryFilter === "all" ? "border-violet-500/50 bg-violet-950/30 text-violet-300" : "border-stone-700/30 text-stone-500 hover:border-stone-600/50"
                      }`}>
                      All
                    </button>
                    {["creatures", "weapons", "items", "environment", "mixed"].map((cat) => (
                      <button key={cat} onClick={() => setLibraryFilter(cat)}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all capitalize ${
                          libraryFilter === cat ? "border-violet-500/50 bg-violet-950/30 text-violet-300" : "border-stone-700/30 text-stone-500 hover:border-stone-600/50"
                        }`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3 text-stone-600" />
                    {(["quality", "newest", "price"] as const).map((s) => (
                      <button key={s} onClick={() => setLibrarySort(s)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-all ${
                          librarySort === s ? "border-violet-500/50 bg-violet-950/30 text-violet-300" : "border-stone-700/30 text-stone-500"
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pack count */}
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[9px] text-stone-500">
                    {sortedLibrary.length} packs · Sorted by <span className="text-violet-400">{librarySort}</span>
                  </p>
                  <p className="font-mono text-[8px] text-stone-600">
                    Unlocks every 2 cycles · {pipelineCycle} cycles
                  </p>
                </div>

                {/* Empty state */}
                {sortedLibrary.length === 0 && (
                  <div className="text-center py-8">
                    <BookOpen className="h-8 w-8 text-stone-700 mx-auto mb-2" />
                    <p className="font-mono text-xs text-stone-600">
                      No packs yet! Run the pipeline to unlock packs.
                    </p>
                  </div>
                )}

                {/* Pack grid */}
                <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {sortedLibrary.map((pack) => {
                    const scoreColor = pack.qualityScore >= 8 ? "emerald" : pack.qualityScore >= 6 ? "amber" : "red"
                    const scoreBg = pack.qualityScore >= 8 ? "bg-emerald-900/30 border-emerald-700/30" : pack.qualityScore >= 6 ? "bg-amber-900/30 border-amber-700/30" : "bg-red-900/20 border-red-700/20"
                    const scoreText = pack.qualityScore >= 8 ? "text-emerald-400" : pack.qualityScore >= 6 ? "text-amber-400" : "text-red-400"
                    
                    return (
                      <button
                        key={pack.id}
                        onClick={() => setSelectedPack(pack)}
                        className="group relative bg-stone-800/40 rounded-lg border border-stone-700/20 p-3 hover:border-violet-500/40 hover:bg-stone-800/70 transition-all text-left"
                      >
                        {/* Quality badge */}
                        <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-mono border ${scoreBg} ${scoreText}`}>
                          {pack.qualityScore}/10
                        </div>

                        {/* Title */}
                        <div className="flex items-center gap-2 mb-2">
                          <Gem className={`h-4 w-4 ${
                            scoreColor === "emerald" ? "text-emerald-400" : scoreColor === "amber" ? "text-amber-400" : "text-red-400"
                          }`} />
                          <span className="font-mono text-xs text-stone-300 font-bold truncate">{pack.title}</span>
                        </div>

                        {/* Description excerpt */}
                        <p className="text-[9px] text-stone-500 font-mono leading-relaxed mb-2 line-clamp-2">
                          {pack.theme}
                        </p>

                        {/* Stats row */}
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-mono text-stone-600">
                            📦 {pack.assetCount} assets
                          </span>
                          <span className={`text-[8px] font-mono ${
                            pack.status === "ready" ? "text-emerald-500" : "text-stone-600"
                          }`}>
                            ${pack.price} · {pack.status}
                          </span>
                        </div>

                        {/* Hover glow */}
                        <div className="absolute inset-0 rounded-lg border border-violet-500/0 group-hover:border-violet-500/20 transition-all pointer-events-none" />
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </GameWindow>
      )}

      {/* ═══════ POPUP: FORGE MODAL ═══════ */}
      {forgeModalOpen && (
        <GameWindow
          title="🔨 FORGE · Commission New Assets"
          icon={<Hammer className="h-4 w-4" />}
          onClose={() => { setForgeModalOpen(false); setForgeResult(null) }}
        >
          <div className="space-y-4">
            {forgeResult ? (
              /* 🎉 Success state */
              <div className="text-center py-6 space-y-3">
                <div className="text-4xl animate-bounce-in">🔥</div>
                <p className="font-mono text-sm text-emerald-400 font-bold">{forgeResult}</p>
                <p className="font-mono text-[10px] text-stone-500">
                  The agents are hard at work! Check the Test Bench for results.
                </p>
                <button
                  onClick={() => { setForgeModalOpen(false); setForgeResult(null); setForgeTheme("fantasy creatures"); setForgeCount(3) }}
                  className="kairosoft-btn px-4 py-1 text-xs"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Theme Input */}
                <div>
                  <label className="font-mono text-[10px] text-stone-400 uppercase tracking-wider block mb-1">
                    🎨 Theme
                  </label>
                  <input
                    type="text"
                    value={forgeTheme}
                    onChange={(e) => setForgeTheme(e.target.value)}
                    className="w-full bg-stone-800/80 border border-stone-600/50 rounded px-3 py-2 font-mono text-sm text-stone-200 focus:border-amber-500/50 focus:outline-none placeholder:text-stone-600"
                    placeholder="e.g. dragon eggs, magic crystals..."
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {["fantasy creatures", "magic weapons", "dragon eggs", "pixel potions", "dark rituals", "treasure hoards"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setForgeTheme(t)}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all ${
                          forgeTheme === t
                            ? "border-amber-500/50 bg-amber-950/30 text-amber-300"
                            : "border-stone-700/30 text-stone-500 hover:border-stone-600/50"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Asset Count Slider */}
                <div>
                  <label className="font-mono text-[10px] text-stone-400 uppercase tracking-wider block mb-1">
                    📦 Asset Count: <span className="text-amber-400">{forgeCount}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    value={forgeCount}
                    onChange={(e) => setForgeCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500 forge-slider"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-stone-600 mt-1">
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
                  </div>
                </div>

                {/* Pipeline Preview */}
                <div className="bg-stone-800/40 rounded-lg p-3 border border-stone-700/20">
                  <p className="font-mono text-[9px] text-stone-500 uppercase tracking-wider mb-2">Pipeline Preview</p>
                  <div className="flex items-center gap-2">
                    {["Scout", "Forge", "Curator", "Packager", "Lister"].map((name, i) => (
                      <div key={name} className="flex items-center gap-1 flex-1">
                        <div className="flex flex-col items-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-stone-700" />
                          <span className="text-[7px] font-mono text-stone-600 mt-0.5">{name}</span>
                        </div>
                        {i < 4 && <div className="flex-1 h-px bg-stone-700" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <button
                  disabled={forgeSubmitting}
                  onClick={() => {
                    setForgeSubmitting(true)
                    addLog("forge", `🔨 FORGE COMMISSION: "${forgeTheme}" ×${forgeCount}`, "info")
                    // Show loading state briefly, then show success
                    setTimeout(() => {
                      setForgeSubmitting(false)
                      setForgeResult(`Commission submitted! "${forgeTheme}" ×${forgeCount} — agents dispatched!`)
                      // Trigger a pipeline run by resetting step
                      setStepProgress(0)
                      setCurrentPipelineStep(0)
                      setPipelineCycle((c) => c + 1)
                    }, 800)
                  }}
                  className="w-full kairosoft-btn py-2 text-sm font-mono flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {forgeSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Forging...</>
                  ) : (
                    <><Flame className="h-4 w-4" /> COMMISSION FORGE</>
                  )}
                </button>
              </>
            )}
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
        .animate-bob-slow { animation: bob 2s ease-in-out infinite; }
        .animate-ping-slow { animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        @keyframes ping-slow { 0% { transform: scale(1); opacity: 1; } 75%, 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes slide-down { 0% { transform: translateY(-20px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes slide-up { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-20px); opacity: 0; } }
        :global(.pixelated) { image-rendering: pixelated; image-rendering: crisp-edges; }
      `}</style>
    </div>
  )
}
