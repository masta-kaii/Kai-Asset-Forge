// ═══════════════════════════════════════════════════════════════════════════
// Workstation Configuration
// Kai-Asset-Forge factory floor constants, types, and helpers
// ═══════════════════════════════════════════════════════════════════════════

// ── Timing ──
export const FRAME_INTERVAL = 200
export const SCALE = 3
export const PIPELINE_TICK_MS = 2000
export const PIPELINE_STEP_DURATION = 8000
export const WALK_SPEED = 0.02

// ── Types ──
export interface AgentDef {
  id: string
  label: string
  role: string
  homeX: number
  homeY: number
  floorTile: string
  wallDecor?: string
  prop?: string
  propDir?: string
  color: string
}

export type AgentStatus = "idle" | "walking" | "meeting" | "working" | "done"

export interface WalkTarget {
  targetX: number
  targetY: number
  walkProgress: number
  fromX: number
  fromY: number
}

export interface AgentState {
  status: AgentStatus
  message: string
  gridX: number
  gridY: number
  pulse: boolean
  frame: number
  facing: "right" | "left"
  animMode: "idle" | "run"
  walk: WalkTarget | null
  dialogueTimer: number
}

export interface LogEntry {
  id: number
  time: string
  agent: string
  msg: string
  type: "info" | "ok" | "warn" | "err"
}

// ── Agent Grid ──
export const AGENTS: AgentDef[] = [
  { id: "scout",    label: "Scout",   role: "Intel",    homeX: 0, homeY: 0, floorTile: "2", prop: "sign_post", propDir: "props", wallDecor: "wall_banner_red", color: "#22c55e" },
  { id: "forge",    label: "Forge",   role: "Prod",     homeX: 1, homeY: 0, floorTile: "3", prop: "anvil", propDir: "furniture", color: "#f97316" },
  { id: "curator",  label: "Curator", role: "QA",       homeX: 2, homeY: 0, floorTile: "1", prop: "bookshelf", propDir: "furniture", color: "#eab308" },
  { id: "popo",     label: "Popo",    role: "CEO ✦ CMD",homeX: 0, homeY: 1, floorTile: "8", wallDecor: "wall_banner_red", prop: "throne", propDir: "furniture", color: "#fbbf24" },
  { id: "packager", label: "Packager",role: "Assembly", homeX: 1, homeY: 1, floorTile: "7", prop: "crate_stack", propDir: "furniture", color: "#fb923c" },
  { id: "lister",   label: "Lister",  role: "Sales",    homeX: 2, homeY: 1, floorTile: "5", prop: "barrel", propDir: "furniture", color: "#3b82f6" },
  { id: "testbench",label: "Test",    role: "Bench ✦",  homeX: 1, homeY: 2, floorTile: "4", prop: "crystal", propDir: "props", color: "#a855f7" },
  { id: "treasure", label: "Vault",   role: "Treasure ✦",homeX: 0, homeY: 2, floorTile: "6_mossy", prop: "chest_large", propDir: "furniture", color: "#fbbf24" },
  { id: "armory",   label: "Armory",  role: "Gear ✦",   homeX: 2, homeY: 2, floorTile: "2", prop: "axe_battle", propDir: "weapons", color: "#a3a3a3" },
]

// ── Pipeline ──
export const PIPELINE_STEPS = [
  { id: 0, name: "SCAN",  agentId: "scout",    label: "Scanning markets..." },
  { id: 1, name: "FORGE", agentId: "forge",    label: "Forging assets..." },
  { id: 2, name: "QC",    agentId: "curator",  label: "Inspecting quality..." },
  { id: 3, name: "BUNDLE",agentId: "packager", label: "Bundling packs..." },
  { id: 4, name: "LIST",  agentId: "lister",   label: "Listing for sale..." },
] as const

export function nextPipelineStep(current: number): number {
  return (current + 1) % PIPELINE_STEPS.length
}

export function prevPipelineStep(current: number): number {
  return (current - 1 + PIPELINE_STEPS.length) % PIPELINE_STEPS.length
}

// ── Soul Dialogues ──
export const SOUL_LINES: Record<string, string[]> = {
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
  treasure: [
    "Gold glitters in the dark...", "The vault is FULL!", "Only the worthy may enter!",
    "Riches beyond imagination!", "Every coin tells a story...",
  ],
  armory: [
    "Sharpen your blades!", "Steel meets flesh!", "Forged in dragon fire!",
    "Pick your weapon wisely...", "The armory never sleeps!",
  ],
}

export const MEETING_LINES: Record<string, string> = {
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

export function randomSoulLine(agentId: string): string {
  const lines = SOUL_LINES[agentId] ?? ["..."]
  return lines[Math.floor(Math.random() * lines.length)]
}

export function meetingLine(a: string, b: string): string {
  const key = `${a}-${b}`
  const reverseKey = `${b}-${a}`
  return MEETING_LINES[key] ?? MEETING_LINES[reverseKey] ?? "Hey there!"
}

// ── Helpers ──
export function now(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false })
}

export function logTypeColor(type: string): string {
  switch (type) {
    case "ok": return "#34d399"
    case "warn": return "#fbbf24"
    case "err": return "#f87171"
    default: return "#a1a1aa"
  }
}
