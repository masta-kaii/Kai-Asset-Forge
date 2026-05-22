"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import {
  Zap, X, Activity, ScrollText, Cpu, Flame,
  Hammer, Eye, Package, Archive, Target, BarChart3,
  Settings, Wrench, Gem, Coins, Play, Pause, Volume2, VolumeX,
  ChevronRight, Clock, Download, MessageCircle,
  Sparkles, SendHorizontal,
} from "lucide-react"
import "./dungeon-command.css"

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface KanbanAgent {
  profile: string; label: string
  activeCount: number; readyCount: number; doneCount: number; blockedCount: number
  currentTask?: { id: string; title: string }
}
interface KanbanData {
  agents: Record<string, KanbanAgent>
  pipeline: { currentStep: number; currentAgent: string | null; allDone: boolean }
  board: { totalTasks: number; doneTotal: number; blockedTotal: number }
}
interface StatsData { totalAssets: number; packsCount: number; cycleCount: number; revenue: number }
interface AssetItem {
  name: string; category: string; type: string; filename: string; url: string
  siblingFrames?: { name: string; url: string }[]
}
interface CycleArchive { id: number; completedAt: string; totalAssets: number; packsCount: number; revenue: number }
interface WalkState { agentId: string; fromX: number; fromY: number; toX: number; toY: number; progress: number; frame: number }
interface SpeechBubble { agentId: string; text: string; id: number; timestamp: number }

const AGENTS = [
  { id: "scout",    label: "SCOUT",    role: "Discovery", icon: "🔍", color: "#00ccff", gridX: 0, gridY: 0 },
  { id: "forge",    label: "FORGE",    role: "Production", icon: "⚒️", color: "#ff6600", gridX: 1, gridY: 0 },
  { id: "curator",  label: "CURATOR",  role: "Quality",    icon: "🔬", color: "#aa55ff", gridX: 2, gridY: 0 },
  { id: "popo",     label: "POPO",     role: "Commander",  icon: "👑", color: "#ffd700", gridX: 0, gridY: 1 },
  { id: "packager", label: "PACKAGER", role: "Assembly",   icon: "📦", color: "#ffaa00", gridX: 1, gridY: 1 },
  { id: "lister",   label: "LISTER",   role: "Commerce",   icon: "📋", color: "#00ff88", gridX: 2, gridY: 1 },
] as const

// ═══════════════════════════════════════════════════════════
// SOUL LINES — Each agent's personality dialogue
// ═══════════════════════════════════════════════════════════

const SOUL_LINES: Record<string, string[]> = {
  scout: [
    "Intel incoming! 📡", "The markets are whispering...", "I found something BIG! 💎",
    "Trend spotted on the horizon!", "My eyes don't miss a thing 🔭", "Scanning the digital realm...",
    "Hot trend detected! 94% confidence", "The data never lies...",
  ],
  forge: [
    "By the hammer! ⚒️", "The forge is BURNING HOT! 🔥", "Another masterpiece in progress...",
    "Feel the HEAT!", "I'll forge you something LEGENDARY!", "Metal sings under my hammer 🎵",
    "Pouring molten creativity...", "This one's gonna be SPECIAL!",
  ],
  curator: [
    "Inspecting every pixel... 🔍", "Quality is not negotiable.", "Flawless. Passed with honors. ✅",
    "This needs rework. ⚠️", "I am the shield that guards the standard! 🛡️",
    "No asset escapes my gaze...", "Standards must be UPHELD!",
  ],
  popo: [
    "All agents report! 📋", "The factory THRIVES under my watch!", "Excellent work, team! 🌟",
    "Keep the forge burning!", "Popo is watching... 👀", "This dungeon runs like clockwork! ⏰",
    "Another cycle, another fortune! 💰", "I built this empire from pixels!",
  ],
  packager: [
    "BUNDLE TIME! 📦", "So many assets to organize...", "PERFECT bundle composition! ✨",
    "This goes with THAT! 🎯", "Beautiful organization!", "Packaging with precision...",
  ],
  lister: [
    "A fine choice, customer! 🛒", "Let me make this IRRESISTIBLE! 💎", "LISTED! 📋",
    "This pack writes its own ticket! 🎟️", "LIMITED EDITION — get it while it's hot! 🔥",
    "The marketplace awaits...", "Premium pricing justified! 💰",
  ],
}

const MEETING_LINES: Record<string, string> = {
  "scout-forge": "Scout: Trending theme detected!\nForge: On it! Firing up the forge! 🔥",
  "forge-curator": "Forge: Fresh off the anvil!\nCurator: Let me inspect... pixel by pixel 🔍",
  "curator-packager": "Curator: Approved with honors ✅\nPackager: BUNDLING NOW! 📦",
  "packager-lister": "Packager: Premium pack ready!\nLister: I'll sell this for TOP DOLLAR! 💰",
  "popo-scout": "Popo: What's the market saying?\nScout: Trends are HOT boss! 🔥",
  "popo-forge": "Popo: How's production?\nForge: FULL SPEED AHEAD! ⚒️",
  "popo-curator": "Popo: Quality report?\nCurator: Standards upheld, Commander! 🛡️",
  "popo-packager": "Popo: Bundles ready?\nPackager: PRISTINE condition! 📦",
  "popo-lister": "Popo: Sales numbers?\nLister: THROUGH THE ROOF! 📈",
  "scout-lister": "Scout: Market data for your listings!\nLister: Perfect timing for pricing! 📊",
  "forge-packager": "Forge: Fresh batch incoming!\nPackager: Ready the wrapping station! 🎁",
  "curator-lister": "Curator: Premium quality verified!\nLister: Premium pricing it is! 💎",
}

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
// Sound Engine
// ═══════════════════════════════════════════════════════════

let audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext { if (!audioCtx) audioCtx = new AudioContext(); return audioCtx }
function playBeep(freq: number, duration: number, type: OscillatorType = "square", vol = 0.06) {
  try { const ctx = getAudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = type; osc.frequency.value = freq; gain.gain.value = vol
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain); gain.connect(ctx.destination); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration) } catch {}
}
function sfxStepComplete() { playBeep(880, 0.08, "square", 0.05); setTimeout(() => playBeep(1100, 0.12, "square", 0.06), 80) }
function sfxForgeClang() { playBeep(220, 0.15, "triangle", 0.07); setTimeout(() => playBeep(330, 0.2, "triangle", 0.05), 100) }
function sfxCycleComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playBeep(f, 0.2, "square", 0.05), i * 120)) }
function sfxAgentClick() { playBeep(660, 0.05, "sine", 0.04) }
function sfxChatPop() { playBeep(1200, 0.06, "sine", 0.03); setTimeout(() => playBeep(800, 0.06, "sine", 0.03), 60) }
function sfxForgeStart() { [220, 330, 440, 660].forEach((f, i) => setTimeout(() => playBeep(f, 0.1, "sawtooth", 0.04), i * 80)) }
function sfxCommandCenter() { [523, 659, 784, 1047, 1318].forEach((f, i) => setTimeout(() => playBeep(f, 0.12, "triangle", 0.06), i * 70)); setTimeout(() => playBeep(1568, 0.3, "triangle", 0.08), 350) }

// ═══════════════════════════════════════════════════════════
// Neon Pathway SVG
// ═══════════════════════════════════════════════════════════

function NeonPathways({ activeStep, walks, meetings }: { activeStep: number; walks: WalkState[]; meetings: string[] }) {
  const activeStepSet = new Set<number>()
  if (activeStep >= 1) activeStepSet.add(0)
  if (activeStep >= 2) activeStepSet.add(1)
  if (activeStep >= 3) { activeStepSet.add(2); activeStepSet.add(3) }
  if (activeStep >= 4) activeStepSet.add(4)

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <filter id="neon-glow"><feGaussianBlur stdDeviation="0.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="neon-glow-strong"><feGaussianBlur stdDeviation="0.8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {PATHWAY_DEFS.map((p, i) => {
        const isActive = activeStepSet.has(i)
        const hasMeeting = meetings.some(m => m === p.fromAgent || m === p.toAgent)
        return (
          <g key={p.id}>
            <path d={p.d} fill="none"
              stroke={hasMeeting ? "#ffd700" : isActive ? "#00ff88" : "rgba(0,255,136,0.12)"}
              strokeWidth={hasMeeting ? 0.7 : isActive ? 0.6 : 0.4}
              strokeDasharray={hasMeeting ? "none" : isActive ? "none" : "1 2"}
              filter={hasMeeting ? "url(#neon-glow-strong)" : isActive ? "url(#neon-glow-strong)" : "url(#neon-glow)"}
              className={hasMeeting ? "animate-pulse" : ""}
            />
            {/* Flowing particles on active pathways */}
            {isActive && (
              <circle r="0.8" fill="#00ff88" filter="url(#neon-glow-strong)" opacity="0.8">
                <animateMotion dur="1.5s" repeatCount="indefinite" path={p.d} />
              </circle>
            )}
            {isActive && (
              <circle r="0.6" fill="#88ffcc" filter="url(#neon-glow-strong)" opacity="0.5">
                <animateMotion dur="2s" repeatCount="indefinite" path={p.d} begin="0.5s" />
              </circle>
            )}
          </g>
        )
      })}
      {walks.map(w => {
        const agent = AGENTS.find(a => a.id === w.agentId)
        const def = PATHWAY_DEFS.find(p => p.fromAgent === w.agentId || p.toAgent === w.agentId)
        if (!def) return null
        const pos = getPathPointAt(def.d, w.progress)
        return (
          <g key={`walk-${w.agentId}`} transform={`translate(${pos.x}, ${pos.y})`}>
            <circle r="1.5" fill={agent?.color ?? "#fff"} filter="url(#neon-glow-strong)" opacity={0.9} />
            <text x="-1" y="-2" fontSize="1.4" fill={agent?.color ?? "#fff"} fontFamily="monospace" textAnchor="middle">{agent?.icon ?? "•"}</text>
          </g>
        )
      })}
      <rect x="8%" y="63%" width="17%" height="24%" rx="1" fill="none" stroke="rgba(255,215,0,0.15)" strokeWidth="0.4" strokeDasharray="1 2" filter="url(#neon-glow)" />
    </svg>
  )
}
function getPathPointAt(d: string, t: number): { x: number; y: number } {
  const m = d.match(/M\s+([\d.]+)%?\s+([\d.]+)%?\s+L\s+([\d.]+)%?\s+([\d.]+)%?/)
  if (!m) return { x: 50, y: 50 }
  const [_, x1, y1, x2, y2] = m.map(Number)
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t }
}

// ═══════════════════════════════════════════════════════════
// Speech Bubble
// ═══════════════════════════════════════════════════════════

function SpeechBubble({ text, color, onDone }: { text: string; color: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, text.length > 60 ? 5000 : 3500)
    return () => clearTimeout(t)
  }, [text, onDone])

  return (
    <div className="animate-slide-up absolute -top-14 left-1/2 -translate-x-1/2 z-30 px-2 py-1 rounded text-[8px] leading-relaxed text-center whitespace-pre-line pointer-events-none max-w-[140px]"
      style={{
        background: `linear-gradient(135deg, rgba(10,10,20,0.95), rgba(20,20,30,0.95))`,
        border: `1px solid ${color}44`,
        color: "#ddd",
        boxShadow: `0 0 12px ${color}22`,
      }}>
      {text}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
        style={{ background: "rgba(15,15,25,0.95)", borderRight: `1px solid ${color}44`, borderBottom: `1px solid ${color}44` }} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Room Node
// ═══════════════════════════════════════════════════════════

function RoomNode({
  agent, status, isSelected, onClick, isWalkingAway, speech, frame, soundOn,
}: {
  agent: { id: string; label: string; role: string; icon: string; color: string; gridX: number; gridY: number }
  status: KanbanAgent | undefined; isSelected: boolean; onClick: () => void
  isWalkingAway: boolean; speech: string | undefined; frame: number; soundOn: boolean
}) {
  const isWorking = (status?.activeCount ?? 0) > 0
  const isReady = (status?.readyCount ?? 0) > 0 && !isWorking
  const isBlocked = (status?.blockedCount ?? 0) > 0
  const doneCount = status?.doneCount ?? 0
  const isPopo = agent.id === "popo"

  const glowColor = isBlocked ? "rgba(255,51,68,0.5)" : isWorking ? `${agent.color}66` : isReady ? "rgba(0,255,136,0.25)" : "rgba(212,160,60,0.1)"
  const borderColor = isBlocked ? "#ff3344" : isWorking ? agent.color : isSelected ? "#ffd700" : "#d4a03c"

  const spriteSize = isPopo ? 40 : 32

  return (
    <button onClick={() => { onClick(); sfxAgentClick(); if (isPopo && soundOn) sfxCommandCenter() }}
      className={`relative flex flex-col items-center justify-center rounded-lg transition-all duration-500 group ${isPopo ? "popo-room" : ""}`}
      style={{
        gridColumn: isPopo ? `${agent.gridX + 1} / span 1` : agent.gridX + 1,
        gridRow: agent.gridY + 1,
        background: isPopo
          ? `linear-gradient(135deg, rgba(30,25,10,0.98), rgba(15,12,5,0.98))`
          : `linear-gradient(135deg, rgba(18,18,26,0.95), rgba(10,10,18,0.95))`,
        border: isPopo ? `2.5px solid #ffd700` : `2px solid ${borderColor}`,
        boxShadow: isPopo
          ? `0 0 20px rgba(255,215,0,0.3), inset 0 0 15px rgba(255,215,0,0.08)`
          : (isWorking || isSelected ? `0 0 20px ${glowColor}, inset 0 0 15px ${glowColor}` : `0 0 8px ${glowColor}`),
        transform: isPopo ? "scale(1.12)" : "scale(1)",
        zIndex: isPopo ? 5 : 1,
      }}>
      <div className="absolute inset-0 rounded-lg opacity-5" style={{ backgroundImage: "linear-gradient(rgba(212,160,60,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,160,60,0.3) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />

      {/* Speech bubble */}
      {speech && <SpeechBubble text={speech} color={agent.color} onDone={() => {}} />}

      <div className="relative z-10 mb-1">
        <div className="relative">
          <Image src={`/sprites/agents/${agent.id}/idle_f${frame % 4}.png`} alt={agent.label} width={spriteSize} height={spriteSize * 1.75} className={`pixelated ${isWalkingAway ? "opacity-30" : ""}`} unoptimized />
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-black/50" style={{ backgroundColor: isBlocked ? "#ff3344" : isWorking ? "#00ff88" : isReady ? "#ffaa00" : "#555", boxShadow: isWorking ? "0 0 6px #00ff88" : isBlocked ? "0 0 6px #ff3344" : "none" }} />
        </div>
      </div>
      <span className="font-mono text-[9px] tracking-widest z-10" style={{ color: agent.color, textShadow: `0 0 6px ${agent.color}66` }}>{agent.label}</span>
      <span className="font-mono text-[7px] text-stone-500 z-10">{isPopo ? "COMMAND" : agent.role}</span>
      {doneCount > 0 && (
        <div className="absolute top-1.5 right-1.5 z-10 bg-stone-900/90 border border-stone-700/50 rounded px-1.5 py-0.5">
          <span className="font-mono text-[8px] text-emerald-400">{doneCount}✓</span>
        </div>
      )}
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: `radial-gradient(circle at center, ${agent.color}15, transparent 70%)` }} />
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// Animation Viewer
// ═══════════════════════════════════════════════════════════

function AnimationViewer({ asset, onClose }: { asset: AssetItem; onClose: () => void }) {
  const [animMode, setAnimMode] = useState<"idle" | "walk" | "hit">("idle")
  const [frame, setFrame] = useState(0)
  const [speed, setSpeed] = useState(200)
  const [playing, setPlaying] = useState(false)

  // Build frame URLs from siblingFrames
  const frames = useMemo(() => {
    if (!asset.siblingFrames?.length) return []
    return asset.siblingFrames
      .filter(f => f.name.toLowerCase().includes(animMode))
      .map(f => f.url)
  }, [asset.siblingFrames, animMode])

  // Also build manual frames for spritesheet characters
  const manualFrames = useMemo(() => {
    if (frames.length > 0) return frames
    if (asset.type !== "spritesheet") return []
    // Try to generate frame URLs
    const base = asset.filename.replace("_spritesheet.png", "")
    return [0, 1, 2, 3].map(i => asset.url.replace(asset.filename, `${base}_${animMode}_f${i}.png`))
  }, [frames, asset, animMode])

  const displayFrames = frames.length > 0 ? frames : manualFrames

  useEffect(() => {
    if (!playing || displayFrames.length === 0) return
    const interval = setInterval(() => setFrame(f => (f + 1) % displayFrames.length), speed)
    return () => clearInterval(interval)
  }, [playing, speed, displayFrames.length])

  return (
    <div className="space-y-3">
      <button onClick={onClose} className="text-[9px] text-amber-400 hover:text-amber-300 flex items-center gap-1">
        <ChevronRight className="h-3 w-3 rotate-180" /> Back to assets
      </button>

      {/* Preview */}
      <div className="flex justify-center p-3 bg-stone-900/70 rounded border border-stone-800/30">
        {displayFrames.length > 0 ? (
          <Image src={displayFrames[frame % displayFrames.length]} alt={`Frame ${frame}`}
            width={80} height={80} className="pixelated" unoptimized />
        ) : (
          <Image src={asset.url} alt={asset.name} width={80} height={80} className="pixelated" unoptimized />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => setPlaying(!playing)} className={`px-2 py-1 rounded text-[9px] border ${playing ? "border-amber-500/50 bg-amber-950/20 text-amber-400" : "border-stone-700/30 text-stone-400 hover:text-stone-300"}`}>
          {playing ? "⏸ PAUSE" : "▶ PLAY"}
        </button>
        {["idle", "walk", "hit"].map(mode => (
          <button key={mode} onClick={() => { setAnimMode(mode as any); setFrame(0) }}
            className={`px-2 py-1 rounded text-[9px] border capitalize ${animMode === mode ? "border-cyan-500/50 bg-cyan-950/20 text-cyan-400" : "border-stone-700/30 text-stone-500 hover:text-stone-300"}`}>
            {mode}
          </button>
        ))}
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-2 text-[8px] text-stone-500">
        <span>Speed:</span>
        {[400, 200, 100, 50].map(s => (
          <button key={s} onClick={() => setSpeed(s)}
            className={`px-1.5 py-0.5 rounded border ${speed === s ? "border-amber-500/30 bg-amber-950/20 text-amber-400" : "border-stone-700/20 text-stone-500"}`}>
            {s}ms
          </button>
        ))}
      </div>

      {/* Frame grid */}
      {displayFrames.length > 0 && (
        <div>
          <div className="text-[8px] text-stone-600 mb-1.5">FRAMES ({displayFrames.length})</div>
          <div className="grid grid-cols-4 gap-1">
            {displayFrames.map((url, i) => (
              <button key={i} onClick={() => setFrame(i)}
                className={`p-1 rounded border ${i === frame % displayFrames.length ? "border-amber-500/50 bg-amber-950/20" : "border-stone-800/20 bg-stone-900/30"}`}>
                <Image src={url} alt={`F${i}`} width={32} height={32} className="pixelated" unoptimized />
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="font-bold text-sm text-stone-300">{asset.name}</div>
        <div className="text-[9px] text-stone-500 capitalize">{asset.category} · {asset.type}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Popup Window
// ═══════════════════════════════════════════════════════════

function GameWindow({ title, icon, onClose, children }: { title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-bounce-in rounded-lg border-2 border-yellow-600/60 bg-stone-900/95 shadow-[0_0_30px_rgba(255,200,50,0.15)] max-w-lg w-[90vw] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-600/30 bg-stone-800/80 rounded-t-lg">
          <div className="flex items-center gap-2 text-sm font-mono text-yellow-300">{icon}<span>{title}</span></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-red-900/50 text-stone-400 hover:text-red-400"><X className="size-4" /></button>
        </div>
        <div className="p-3 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

function AssetThumb({ asset, onClick }: { asset: AssetItem; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <button onClick={onClick} className="group relative bg-stone-900/50 rounded-lg border border-stone-800/30 hover:border-yellow-600/40 hover:bg-stone-800/50 transition-all p-2 text-left">
      <div className="flex justify-center mb-1.5">
        {!loaded && <div className="w-12 h-12 bg-stone-800 animate-pulse rounded" />}
        <Image src={asset.url} alt={asset.name} width={48} height={48} className={`pixelated rounded ${loaded ? "" : "hidden"}`} unoptimized onLoad={() => setLoaded(true)} />
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

  // Forge button
  const [forgeLoading, setForgeLoading] = useState(false)
  const [forgeTheme, setForgeTheme] = useState("")
  const [forgeSuccess, setForgeSuccess] = useState(false)

  // Soul system
  const [speeches, setSpeeches] = useState<Record<string, string>>({})
  const [meetings, setMeetings] = useState<string[]>([])
  const soulTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const meetingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Walking
  const [walks, setWalks] = useState<WalkState[]>([])
  const walkRef = useRef<WalkState[]>([])
  walkRef.current = walks

  // Assets
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null)
  const [assetCategory, setAssetCategory] = useState("all")

  // Archive
  const [archive, setArchive] = useState<CycleArchive[]>([])
  const prevPipelineRef = useRef<number>(-1)
  const prevAllDoneRef = useRef(false)

  // Sprite animation
  const [spriteFrame, setSpriteFrame] = useState(0)
  const rafRef = useRef<number>(0)
  const lastFrameRef = useRef(0)

  // Audio init
  const initAudio = useCallback(() => { getAudioCtx() }, [])

  // ═══ SPRITE ANIMATION: Cycle idle frames ═══
  useEffect(() => {
    function tick(ts: number) {
      if (ts - lastFrameRef.current > 180) {
        lastFrameRef.current = ts
        setSpriteFrame(f => (f + 1) % 4)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ═══ SOUL SYSTEM: Random chatter ═══
  useEffect(() => {
    function randomChatter() {
      const idleAgents = AGENTS.filter(a => !walks.some(w => w.agentId === a.id))
      if (idleAgents.length === 0) return
      const agent = idleAgents[Math.floor(Math.random() * idleAgents.length)]
      const lines = SOUL_LINES[agent.id]
      if (!lines) return
      const line = lines[Math.floor(Math.random() * lines.length)]
      setSpeeches(prev => ({ ...prev, [agent.id]: line }))
      if (soundOn) sfxChatPop()
      setTimeout(() => setSpeeches(prev => { const n = { ...prev }; delete n[agent.id]; return n }), 3500)
    }

    soulTimerRef.current = setInterval(randomChatter, 6000 + Math.random() * 8000)
    return () => { if (soulTimerRef.current) clearInterval(soulTimerRef.current) }
  }, [walks, soundOn])

  // ═══ SOUL SYSTEM: Random meetings ═══
  useEffect(() => {
    function triggerMeeting() {
      const idle = AGENTS.filter(a => !walks.some(w => w.agentId === a.id))
      if (idle.length < 2) return
      const shuffled = [...idle].sort(() => Math.random() - 0.5)
      const a1 = shuffled[0], a2 = shuffled[1]

      const pairKey1 = `${a1.id}-${a2.id}`
      const pairKey2 = `${a2.id}-${a1.id}`
      const dialogue = MEETING_LINES[pairKey1] || MEETING_LINES[pairKey2]
      if (!dialogue) return

      // Show meeting dialogue on both agents
      const [line1, line2] = dialogue.split("\n")
      setSpeeches(prev => ({ ...prev, [a1.id]: line1, [a2.id]: line2 }))
      setMeetings([a1.id, a2.id])
      if (soundOn) { sfxChatPop(); setTimeout(() => sfxChatPop(), 800) }

      setTimeout(() => {
        setSpeeches(prev => { const n = { ...prev }; delete n[a1.id]; delete n[a2.id]; return n })
        setMeetings([])
      }, 4500)
    }

    meetingTimerRef.current = setInterval(triggerMeeting, 12000 + Math.random() * 15000)
    return () => { if (meetingTimerRef.current) clearInterval(meetingTimerRef.current) }
  }, [walks, soundOn])

  // ═══ Poll Kanban ═══
  const pollKanban = useCallback(async () => {
    if (pipelinePaused) return
    try {
      const res = await fetch("/api/kanban/status")
      if (!res.ok) return
      const data: KanbanData = await res.json()
      if (data.board.totalTasks > 0 || data.pipeline.currentStep >= 0) {
        setKanbanLive(true)
        const oldStep = prevPipelineRef.current, newStep = data.pipeline.currentStep

        if (newStep !== oldStep && newStep >= 0 && oldStep >= 0) {
          const fromAgent = PIPELINE_ORDER[Math.max(0, oldStep)]
          const toAgent = PIPELINE_ORDER[Math.min(PIPELINE_ORDER.length - 1, newStep)]
          if (fromAgent !== toAgent && soundOn) sfxStepComplete()
        }
        if (newStep === 1 && oldStep !== 1 && soundOn) setTimeout(sfxForgeClang, 400)

        if (data.pipeline.allDone && !prevAllDoneRef.current) {
          const cyc = cycleCount
          setCycleCount(c => c + 1)
          if (soundOn) sfxCycleComplete()
          setArchive(prev => [{ id: cyc, completedAt: new Date().toISOString(), totalAssets: stats.totalAssets, packsCount: stats.packsCount, revenue: stats.revenue }, ...prev].slice(0, 20))
        }

        prevPipelineRef.current = newStep; prevAllDoneRef.current = data.pipeline.allDone
        setKanban(data)
      }
    } catch {}
  }, [pipelinePaused, soundOn, cycleCount, stats])

  const pollStats = useCallback(async () => {
    try {
      const res = await fetch("/api/forge/stats")
      if (res.ok) { const data = await res.json(); setStats({ totalAssets: data.totalAssets ?? 122, packsCount: data.packsCount ?? 5, cycleCount: data.cycleCount ?? cycleCount, revenue: data.revenue ?? 29.99 }) }
    } catch {}
  }, [cycleCount])

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/forge/assets?category=all")
      if (res.ok) { const data = await res.json(); const all: AssetItem[] = []
        if (data.assets) for (const cat of Object.values(data.assets) as AssetItem[][]) all.push(...cat)
        setAssets(all) }
    } catch {}
  }, [])

  useEffect(() => { pollKanban(); pollStats(); fetchAssets()
    const interval = setInterval(() => { pollKanban(); pollStats() }, 8000)
    return () => clearInterval(interval) }, [pollKanban, pollStats, fetchAssets])

  // Keyboard
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setSelectedAgent(null); setSelectedAsset(null) }
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx < AGENTS.length && !e.ctrlKey && !e.metaKey && document.activeElement === document.body)
        setSelectedAgent(AGENTS[idx].id)
      if (e.key === " " && !e.ctrlKey) { e.preventDefault(); setPipelinePaused(p => !p) }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  // ═══ FORGE DISPATCH ═══
  const dispatchForge = useCallback(async () => {
    setForgeLoading(true); setForgeSuccess(false)
    if (soundOn) sfxForgeStart()
    try {
      const res = await fetch("/api/forge/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: forgeTheme || "dungeon pixel art" }),
      })
      if (res.ok) { setForgeSuccess(true); setTimeout(() => setForgeSuccess(false), 4000) }
    } catch {}
    setForgeLoading(false)
  }, [forgeTheme, soundOn])

  // ═══ AGENT QUICK DISPATCH ═══
  const [agentDispatchLoading, setAgentDispatchLoading] = useState<string | null>(null)
  const [agentDispatchSuccess, setAgentDispatchSuccess] = useState<string | null>(null)
  const dispatchAgentTask = useCallback(async (agentId: string, taskLabel: string) => {
    setAgentDispatchLoading(agentId)
    if (soundOn) sfxForgeStart()
    try {
      const agent = AGENTS.find(a => a.id === agentId)
      const res = await fetch("/api/agents/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: `${agent?.label ?? agentId}: ${taskLabel} — ${forgeTheme || "dungeon pixel art"}`,
          count: 3,
          platform: "itch.io",
        }),
      })
      if (res.ok) {
        setAgentDispatchSuccess(agentId)
        setTimeout(() => setAgentDispatchSuccess(null), 3000)
      }
    } catch {}
    setAgentDispatchLoading(null)
  }, [forgeTheme, soundOn])

  // ═══ RECENT ACTIVITY ═══
  const recentTasks = useMemo(() => {
    if (!kanban) return []
    const tasks: { agent: string; title: string; id: string; color: string }[] = []
    for (const [id, a] of Object.entries(kanban.agents)) {
      if (a.currentTask) {
        const agent = AGENTS.find(ag => ag.id === id)
        tasks.push({ agent: id, title: a.currentTask.title, id: a.currentTask.id, color: agent?.color ?? "#555" })
      }
    }
    return tasks.slice(0, 5)
  }, [kanban])

  // Computed
  const selectedDef = AGENTS.find(a => a.id === selectedAgent)
  const selectedData = selectedAgent ? kanban?.agents[selectedAgent] : undefined
  const filteredAssets = useMemo(() => assetCategory === "all" ? assets : assets.filter(a => a.category === assetCategory), [assets, assetCategory])
  const categories = useMemo(() => { const cats = new Map<string, number>(); for (const a of assets) cats.set(a.category, (cats.get(a.category) ?? 0) + 1); return Array.from(cats.entries()) }, [assets])

  return (
    <div className="h-screen w-screen bg-[#08080f] text-stone-300 overflow-hidden flex flex-col font-mono" onClick={initAudio}>
      {/* ═══ TOP BAR ═══ */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#0a0a16] border-b border-yellow-900/20 text-[11px]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${kanbanLive ? "bg-emerald-500 shadow-[0_0_6px_#00ff88]" : "bg-stone-600"}`} />
            <span className="text-stone-400 tracking-wider text-[10px]">{kanbanLive ? "DUNGEON LIVE" : "LOCAL MODE"}</span>
          </div>
          <span className="text-stone-700">│</span>
          <div className="flex items-center gap-1.5"><Flame className="h-3 w-3 text-orange-500" /><span className="text-stone-400">CYCLE</span><span className="text-amber-400 font-bold">{cycleCount}</span></div>
          <span className="text-stone-700">│</span>
          <div className="flex items-center gap-1.5"><Activity className="h-3 w-3 text-cyan-400" /><span className="text-stone-400">AGENTS</span><span className="text-cyan-400 font-bold">{kanbanLive ? `${Object.values(kanban?.agents ?? {}).filter(a => a.activeCount > 0).length}/5` : "—"}</span></div>
          <span className="text-stone-700">│</span>
          <div className="flex items-center gap-1.5"><Package className="h-3 w-3 text-purple-400" /><span className="text-stone-400">PACKS</span><span className="text-purple-400 font-bold">{stats.packsCount}</span></div>
          <span className="text-stone-700">│</span>
          <div className="flex items-center gap-1.5"><Coins className="h-3 w-3 text-yellow-500" /><span className="text-stone-400">REV</span><span className="text-yellow-400 font-bold">${stats.revenue.toFixed(2)}</span></div>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <button onClick={() => setSoundOn(s => !s)} className="p-1 hover:text-stone-300 text-stone-600"><Volume2 className="h-3 w-3" /></button>
          <button onClick={() => setPipelinePaused(p => !p)} className={`p-1 ${pipelinePaused ? "text-red-400" : "text-stone-600"} hover:text-stone-300`}>{pipelinePaused ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}</button>
          <span className="text-stone-600">PIPE:</span>
          {PIPELINE_STEP_LABELS.map((step, i) => {
            const isActive = kanban?.pipeline.currentStep === i; const isDone = kanban?.pipeline.currentStep !== undefined && i < (kanban?.pipeline.currentStep ?? -1)
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
            {kanbanLive && kanban ? Object.entries(kanban.agents).map(([id, a]) => {
              if (a.activeCount === 0 && a.readyCount === 0 && a.blockedCount === 0 && a.doneCount === 0) return null
              const agent = AGENTS.find(ag => ag.id === id)
              const isWalking = walks.some(w => w.agentId === id)
              return (
                <div key={id} className="rounded p-2 text-[9px] cursor-pointer hover:bg-stone-800/40 transition-colors border border-stone-800/30"
                  style={{ borderLeftColor: agent?.color ?? "#555", borderLeftWidth: 2 }} onClick={() => setSelectedAgent(id)}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold flex items-center gap-1" style={{ color: agent?.color }}>{agent?.label ?? id}{isWalking && <span className="text-[7px] animate-pulse">🚶</span>}</span>
                    <span className={`text-[8px] px-1 rounded ${a.blockedCount > 0 ? "bg-red-950/30 text-red-400" : a.activeCount > 0 ? "bg-emerald-950/30 text-emerald-400" : a.readyCount > 0 ? "bg-amber-950/30 text-amber-400" : "bg-stone-900/30 text-stone-500"}`}>
                      {a.blockedCount > 0 ? "⚠" : a.activeCount > 0 ? "▶" : a.readyCount > 0 ? "⏳" : "✓"}
                    </span>
                  </div>
                  <p className="text-stone-500 truncate">{a.currentTask?.title ?? (a.doneCount > 0 ? `${a.doneCount} completed` : "Idle")}</p>
                  <div className="flex gap-2 mt-1 text-stone-600"><span>✓{a.doneCount}</span><span>⏳{a.readyCount}</span>{a.blockedCount > 0 && <span className="text-red-500">⚠{a.blockedCount}</span>}</div>
                </div>
              )
            }).filter(Boolean) : (
              <div className="text-center text-stone-600 text-[10px] py-8"><Activity className="h-5 w-5 mx-auto mb-2 opacity-30" />Awaiting signal...</div>
            )}
          </div>
        </div>

        {/* CENTRAL — Factory Floor */}
        <div className="flex-1 relative p-4 overflow-hidden">
          {/* ═══ DUNGEON ATMOSPHERE ═══ */}
          <div className="absolute inset-0 pointer-events-none z-0" style={{
            background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 85%, rgba(0,0,0,0.9) 100%)",
          }} />
          {/* Floating ember particles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={`ember-${i}`} className="absolute rounded-full pointer-events-none z-0"
              style={{
                width: `${2 + Math.random() * 3}px`, height: `${2 + Math.random() * 3}px`,
                left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                background: i % 3 === 0 ? "#ffaa00" : i % 3 === 1 ? "#ff6600" : "#ffd700",
                boxShadow: `0 0 ${3 + Math.random() * 4}px currentColor`,
                opacity: 0.15 + Math.random() * 0.25,
                animation: `ember-float ${3 + Math.random() * 5}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
          {/* Floor grid lines */}
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(rgba(212,160,60,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(212,160,60,0.5) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }} />
          <NeonPathways activeStep={kanban?.pipeline.currentStep ?? -1} walks={walks} meetings={meetings} />
          <div className="relative z-10 w-full h-full grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(2, 1fr)" }}>
            {AGENTS.map(agent => (
              <RoomNode key={agent.id} agent={agent} status={kanban?.agents[agent.id]}
                isSelected={selectedAgent === agent.id} onClick={() => setSelectedAgent(agent.id)}
                isWalkingAway={walks.some(w => w.agentId === agent.id)}
                speech={speeches[agent.id]}
                frame={spriteFrame}
                soundOn={soundOn}
              />
            ))}
          </div>

          {/* ═══ FORGE BUTTON ═══ */}
          <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2">
            {forgeSuccess && (
              <div className="text-[9px] text-emerald-400 bg-emerald-950/40 border border-emerald-700/30 rounded px-2 py-1 animate-slide-up">
                Pipeline dispatched! 🚀
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text" value={forgeTheme} onChange={e => setForgeTheme(e.target.value)}
                placeholder="dungeon pixel art"
                className="bg-stone-900/80 border border-stone-700/40 rounded px-2 py-1.5 text-[10px] text-stone-300 placeholder-stone-600 w-36 focus:outline-none focus:border-amber-500/50"
              />
              <button onClick={dispatchForge} disabled={forgeLoading}
                className="relative px-4 py-2 rounded font-bold text-[11px] tracking-widest transition-all duration-300 disabled:opacity-50"
                style={{
                  background: forgeLoading ? "#555" : "linear-gradient(135deg, #ff6600, #ff3300)",
                  border: "2px solid #ff8844",
                  boxShadow: forgeLoading ? "none" : "0 0 20px rgba(255,102,0,0.4)",
                  color: "#fff",
                }}>
                {forgeLoading ? (
                  <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 animate-spin" />FORGING</span>
                ) : forgeSuccess ? (
                  <span className="flex items-center gap-1">✓ FORGED!</span>
                ) : (
                  <span className="flex items-center gap-1"><Hammer className="h-3 w-3" />FORGE</span>
                )}
              </button>
            </div>
          </div>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-stone-800 text-[9px] tracking-[0.3em] font-bold pointer-events-none">KAI ASSET FORGE — DUNGEON COMMAND</div>
        </div>

        {/* RIGHT — Detail Panel */}
        <div className="w-64 shrink-0 border-l border-yellow-900/15 bg-[#0a0a14] flex flex-col">
          <div className="px-3 py-2 border-b border-yellow-900/10 flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-stone-400 tracking-widest">DETAILS</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedAsset ? (
              <AnimationViewer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
            ) : selectedAgent && selectedDef ? (
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
                      {[{ label: "ACTIVE", val: selectedData.activeCount, color: "text-emerald-400" }, { label: "READY", val: selectedData.readyCount, color: "text-amber-400" }, { label: "DONE", val: selectedData.doneCount, color: "text-cyan-400" }, { label: "BLOCKED", val: selectedData.blockedCount, color: selectedData.blockedCount > 0 ? "text-red-400" : "text-stone-600" }].map(s => (
                        <div key={s.label} className="bg-stone-900/50 rounded p-2 border border-stone-800/30"><div className="text-stone-500 mb-0.5">{s.label}</div><div className={`font-bold text-sm ${s.color}`}>{s.val}</div></div>
                      ))}
                    </div>
                    {selectedData.currentTask && (
                      <div className="bg-stone-900/50 rounded p-2 border border-stone-800/30 text-[9px]"><div className="text-stone-500 mb-0.5">TASK</div><div className="text-stone-300 break-words">{selectedData.currentTask.title}</div><div className="text-stone-600 mt-1 text-[8px]">{selectedData.currentTask.id}</div></div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-stone-700 text-[10px] py-12"><Hammer className="h-8 w-8 mx-auto mb-3 opacity-10" /><p>Select agent<br />or asset</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM TAB BAR ═══ */}
      <div className="shrink-0 flex border-t border-yellow-900/20 bg-[#0a0a16]">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id; const Icon = tab.icon
          let count: number | undefined
          if (tab.id === "agents") count = AGENTS.length
          if (tab.id === "tasks") count = kanban?.board.totalTasks
          if (tab.id === "assets") count = stats.totalAssets
          if (tab.id === "archive") count = archive.length
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedAsset(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-all duration-200 text-[10px] tracking-wider ${isActive ? "bg-stone-900/80 text-amber-400 border-t-2 border-amber-500" : "text-stone-600 hover:text-stone-400 hover:bg-stone-900/30"}`}>
              <Icon className="h-3 w-3" /><span className="hidden sm:inline">{tab.label}</span>
              {count !== undefined && count > 0 && <span className={`text-[8px] px-1 rounded ${isActive ? "bg-amber-950/30 text-amber-400" : "bg-stone-800/50 text-stone-500"}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      {activeTab !== "station" && (
        <div className="shrink-0 h-40 bg-[#0a0a14] border-t border-yellow-900/10 p-3 overflow-y-auto">
          {activeTab === "agents" && (
            <div className="grid grid-cols-6 gap-2 text-[9px]">
              {AGENTS.map(a => { const d = kanban?.agents[a.id]
                return (<button key={a.id} onClick={() => { setSelectedAgent(a.id); setActiveTab("station") }} className="bg-stone-900/50 rounded p-2 border border-stone-800/30 hover:border-stone-600/50 transition-colors text-left"><span className="font-bold" style={{ color: a.color }}>{a.label}</span><div className="text-stone-500 mt-0.5">{d ? `✓${d.doneCount} ▶${d.activeCount}` : "offline"}</div></button>)
              })}
            </div>
          )}
          {activeTab === "tasks" && (
            <div className="text-[10px] text-stone-400">
              <span className="text-emerald-400 font-bold">{kanban?.board.doneTotal ?? 0}</span> done · <span className="text-red-400 font-bold ml-2">{kanban?.board.blockedTotal ?? 0}</span> blocked · <span className="text-amber-400 font-bold ml-2">{kanban?.board.totalTasks ?? 0}</span> total
            </div>
          )}
          {activeTab === "assets" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setAssetCategory("all")} className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${assetCategory === "all" ? "border-amber-500/50 bg-amber-950/20 text-amber-400" : "border-stone-800/30 text-stone-500"}`}>ALL ({assets.length})</button>
                {categories.map(([cat, count]) => (<button key={cat} onClick={() => setAssetCategory(cat)} className={`text-[9px] px-2 py-0.5 rounded border transition-colors capitalize ${assetCategory === cat ? "border-amber-500/50 bg-amber-950/20 text-amber-400" : "border-stone-800/30 text-stone-500"}`}>{cat} ({count})</button>))}
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {filteredAssets.slice(0, 40).map(a => (<AssetThumb key={a.filename} asset={a} onClick={() => { setSelectedAsset(a); setActiveTab("station") }} />))}
              </div>
            </div>
          )}
          {activeTab === "stats" && (
            <div className="grid grid-cols-4 gap-2 text-[10px]">
              {[{ label: "Cycles", val: cycleCount, color: "text-amber-400" }, { label: "Assets", val: stats.totalAssets, color: "text-purple-400" }, { label: "Packs", val: stats.packsCount, color: "text-cyan-400" }, { label: "Revenue", val: `$${stats.revenue}`, color: "text-emerald-400" }].map(s => (<div key={s.label} className="bg-stone-900/50 rounded p-2 border border-stone-800/30"><div className="text-stone-500">{s.label}</div><div className={`font-bold text-lg ${s.color}`}>{s.val}</div></div>))}
            </div>
          )}
          {activeTab === "archive" && (
            <div>{archive.length > 0 ? (<div className="space-y-1">{archive.map(entry => (<div key={entry.id} className="flex items-center gap-3 text-[9px] bg-stone-900/30 rounded p-2 border border-stone-800/20"><span className="text-amber-400 font-bold w-12">CYCLE {entry.id}</span><Clock className="h-2.5 w-2.5 text-stone-600" /><span className="text-stone-500">{new Date(entry.completedAt).toLocaleTimeString()}</span><span className="text-stone-600">│</span><span className="text-purple-400">{entry.totalAssets} assets</span><span className="text-stone-600">│</span><span className="text-emerald-400">${entry.revenue}</span></div>))}</div>) : (<div className="text-center text-stone-600 text-[10px] py-4"><Archive className="h-5 w-5 mx-auto mb-1 opacity-20" />No completed cycles</div>)}</div>
          )}
          {activeTab === "goals" && (<div className="text-[10px] text-stone-500 text-center py-4"><Target className="h-5 w-5 mx-auto mb-1 opacity-20" />Production goals coming soon</div>)}
          {activeTab === "system" && (<div className="text-[10px] text-stone-400 space-y-1"><div>Hermes CLI: <span className={kanbanLive ? "text-emerald-400" : "text-red-400"}>{kanbanLive ? "ONLINE" : "OFFLINE"}</span></div><div>Sound: {soundOn ? "ON 🔊" : "OFF 🔇"} · Pipeline: {pipelinePaused ? "PAUSED" : "ACTIVE"}</div><div className="text-[8px] text-stone-600 mt-1">Space=pause · 1-6=agents · Esc=close</div></div>)}
        </div>
      )}

      {/* ═══ POPO COMMAND CENTER ═══ */}
      {selectedAgent === "popo" && selectedDef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={() => setSelectedAgent(null)}>
          <div className="animate-command-in rounded-lg border-[2.5px] border-amber-400/70 bg-[#0d0d18]/98 shadow-[0_0_60px_rgba(255,200,0,0.25),0_0_120px_rgba(255,180,0,0.1)] max-w-2xl w-[92vw] max-h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* ── TITLE BAR ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-amber-500/30 bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-amber-950/60">
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-bounce">👑</span>
                <div>
                  <div className="text-lg font-bold text-amber-300 tracking-[0.15em] drop-shadow-[0_0_10px_rgba(255,200,0,0.5)]">COMMAND CENTER</div>
                  <div className="text-[9px] text-amber-500/70 tracking-widest">POPO · DUNGEON OVERLORD</div>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="p-1.5 rounded hover:bg-red-900/60 text-stone-500 hover:text-red-400 transition-colors"><X className="size-5" /></button>
            </div>

            {/* ── CONTENT ── */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* ── ALL AGENTS STATUS GRID ── */}
              <div>
                <div className="text-[9px] text-stone-500 tracking-widest mb-2 flex items-center gap-1.5"><Activity className="h-3 w-3 text-amber-400" />AGENT STATUS OVERVIEW</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {AGENTS.map(a => {
                    const d = kanban?.agents[a.id]
                    const isPopoAgent = a.id === "popo"
                    return (
                      <div key={a.id}
                        className={`rounded p-1.5 border text-center ${isPopoAgent ? "border-amber-400/40 bg-amber-950/20" : "border-stone-700/30 bg-stone-900/40"}`}>
                        <div className="text-[8px] font-bold mb-0.5" style={{ color: a.color }}>{a.label}</div>
                        <div className="flex items-center justify-center gap-1 text-[7px] text-stone-500">
                          <span className="text-emerald-400 font-bold">{d?.activeCount ?? 0}</span>
                          <span className="text-amber-400">{d?.readyCount ?? 0}</span>
                          <span className="text-cyan-400">{d?.doneCount ?? 0}</span>
                          <span className={d?.blockedCount ? "text-red-400 font-bold" : "text-stone-600"}>{(d?.blockedCount ?? 0) > 0 ? d?.blockedCount : 0}</span>
                        </div>
                        <div className="text-[6px] text-stone-600 mt-0.5">▶⏳✓⚠</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── DISPATCH PIPELINE ── */}
              <button onClick={dispatchForge} disabled={forgeLoading}
                className="w-full py-3 rounded-lg font-bold text-sm tracking-[0.2em] transition-all duration-300 disabled:opacity-50 gold-shimmer"
                style={{
                  background: forgeLoading ? "#444" : "linear-gradient(135deg, #b8860b, #ffd700, #b8860b)",
                  border: "2.5px solid #ffd700",
                  boxShadow: forgeLoading ? "none" : "0 0 30px rgba(255,215,0,0.4), 0 0 60px rgba(255,180,0,0.15)",
                  color: "#1a1a00",
                  textShadow: "0 1px 0 rgba(255,255,200,0.5)",
                }}>
                {forgeLoading ? (
                  <span className="flex items-center justify-center gap-2"><Sparkles className="h-4 w-4 animate-spin" />DISPATCHING...</span>
                ) : forgeSuccess ? (
                  <span className="flex items-center justify-center gap-2">✅ PIPELINE DISPATCHED!</span>
                ) : (
                  <span className="flex items-center justify-center gap-2">⚡ DISPATCH PIPELINE ⚡</span>
                )}
              </button>
              {agentDispatchSuccess && (
                <div className="text-center text-[9px] text-emerald-400 animate-slide-up">✓ Agent task dispatched!</div>
              )}

              {/* ── QUICK ACTION BUTTONS ── */}
              <div>
                <div className="text-[9px] text-stone-500 tracking-widest mb-2 flex items-center gap-1.5"><Zap className="h-3 w-3 text-amber-400" />QUICK DISPATCH</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "scout", label: "🔍 SCOUT MARKETS", color: "#00ccff" },
                    { id: "forge", label: "⚒️ FIRE FORGE", color: "#ff6600" },
                    { id: "curator", label: "🔬 AUDIT QUALITY", color: "#aa55ff" },
                    { id: "packager", label: "📦 BUNDLE ASSETS", color: "#ffaa00" },
                    { id: "lister", label: "📋 LIST PRODUCTS", color: "#00ff88" },
                  ].map(btn => {
                    const isLoading = agentDispatchLoading === btn.id
                    const isDone = agentDispatchSuccess === btn.id
                    return (
                      <button key={btn.id} onClick={() => dispatchAgentTask(btn.id, btn.label.replace(/[🔍⚒️🔬📦📋]/g, "").trim())}
                        disabled={isLoading}
                        className="text-[8px] font-bold py-2 rounded border transition-all duration-200 hover:scale-105 disabled:opacity-50 tracking-wider"
                        style={{
                          background: isDone ? `${btn.color}22` : `${btn.color}10`,
                          borderColor: isDone ? `${btn.color}66` : `${btn.color}33`,
                          color: isDone ? btn.color : `${btn.color}aa`,
                          boxShadow: isDone ? `0 0 10px ${btn.color}22` : "none",
                        }}>
                        {isLoading ? "⏳..." : isDone ? "✓ DONE" : btn.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── LIVE STATS ── */}
              <div>
                <div className="text-[9px] text-stone-500 tracking-widest mb-2 flex items-center gap-1.5"><BarChart3 className="h-3 w-3 text-amber-400" />DUNGEON METRICS</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "CYCLES", val: cycleCount, icon: "🔄", color: "text-amber-400" },
                    { label: "ASSETS", val: stats.totalAssets, icon: "🎨", color: "text-purple-400" },
                    { label: "PACKS", val: stats.packsCount, icon: "📦", color: "text-cyan-400" },
                    { label: "REVENUE", val: `$${stats.revenue.toFixed(2)}`, icon: "💰", color: "text-emerald-400" },
                  ].map(s => (
                    <div key={s.label} className="bg-stone-900/50 rounded-lg p-2.5 border border-stone-700/30 text-center">
                      <div className="text-[7px] text-stone-500 mb-1 tracking-wider">{s.icon} {s.label}</div>
                      <div className={`font-bold text-base ${s.color}`}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── RECENT ACTIVITY LOG ── */}
              <div>
                <div className="text-[9px] text-stone-500 tracking-widest mb-2 flex items-center gap-1.5"><Clock className="h-3 w-3 text-amber-400" />RECENT ACTIVITY</div>
                {recentTasks.length > 0 ? (
                  <div className="space-y-1">
                    {recentTasks.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 bg-stone-900/40 rounded px-2.5 py-1.5 border border-stone-800/20">
                        <span className="text-[7px] font-bold w-16 truncate" style={{ color: t.color }}>{AGENTS.find(a => a.id === t.agent)?.label ?? t.agent}</span>
                        <span className="text-[8px] text-stone-400 truncate flex-1">{t.title}</span>
                        <span className="text-[7px] text-stone-600 font-mono">{t.id.substring(0, 10)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-stone-600 text-[9px] py-3 bg-stone-900/30 rounded border border-stone-800/20">No active tasks — dispatch to begin</div>
                )}
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="px-4 py-2 border-t border-amber-500/20 bg-amber-950/20 text-center">
              <span className="text-[7px] text-amber-500/40 tracking-[0.3em]">POPO COMMAND CENTER · KAI ASSET FORGE</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ AGENT POPUP (non-Popo) ═══ */}
      {selectedAgent && selectedAgent !== "popo" && selectedDef && (
        <GameWindow title={`${selectedDef.label} · ${selectedDef.role}`} icon={<span>{selectedDef.icon}</span>} onClose={() => setSelectedAgent(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: `${selectedDef.color}33`, background: `${selectedDef.color}08` }}>
              <Image src={`/sprites/agents/${selectedDef.id}/idle_f0.png`} alt={selectedDef.label} width={48} height={84} className="pixelated" unoptimized />
              <div><div className="font-bold text-sm" style={{ color: selectedDef.color }}>{selectedDef.label}</div><div className="text-stone-500 text-[10px]">{selectedDef.role}</div></div>
            </div>
            {selectedData && (
              <>
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  {[{ l: "Active", v: selectedData.activeCount, c: "text-emerald-400" }, { l: "Ready", v: selectedData.readyCount, c: "text-amber-400" }, { l: "Done", v: selectedData.doneCount, c: "text-cyan-400" }, { l: "Blocked", v: selectedData.blockedCount, c: selectedData.blockedCount > 0 ? "text-red-400" : "text-stone-600" }].map(s => (<div key={s.l} className="bg-stone-900/50 rounded p-2 border border-stone-800/30"><div className="text-stone-500">{s.l}</div><div className={`font-bold text-base ${s.c}`}>{s.v}</div></div>))}
                </div>
                {selectedData.currentTask && (<div className="bg-stone-900/50 rounded p-2 border border-stone-800/30 text-[9px]"><div className="text-stone-500 mb-1">Current Task</div><div className="text-stone-300 break-words">{selectedData.currentTask.title}</div><div className="text-stone-600 mt-1 text-[8px]">{selectedData.currentTask.id}</div></div>)}
              </>
            )}
            {assets.length > 0 && (<div className="pt-2 border-t border-stone-800/30"><div className="text-[9px] text-stone-500 mb-2">Recent Assets</div><div className="grid grid-cols-4 gap-1.5">{assets.slice(0, 12).map(a => (<Image key={a.filename} src={a.url} alt={a.name} width={40} height={40} className="pixelated rounded border border-stone-800/30" unoptimized />))}</div></div>)}
          </div>
        </GameWindow>
      )}
    </div>
  )
}
