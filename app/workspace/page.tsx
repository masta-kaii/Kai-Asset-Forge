"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  getWorkshopActivity,
  type WorkshopActivity,
  type WorkshopAgentId,
  type WorkshopStep,
} from "@/app/actions/workshop-activity"
import { runOrchestrator } from "@/app/actions/orchestrator"
import { Crown, Play, Loader2, Pause, RefreshCw, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { AgentSprite, type SpriteVariant } from "@/components/workshop/agent-sprite"
import { AgentSidePanel } from "@/components/workshop/agent-side-panel"

interface AgentDef {
  id: SpriteVariant & WorkshopAgentId
  name: string
  role: string
  description: string
  /** Position in the scene as percentages. */
  x: number
  y: number
}

const AGENTS: AgentDef[] = [
  {
    id: "masta",
    name: "Masta",
    role: "Boss",
    description:
      "Your master agent. Hands the crew their orders, watches the budget, and reports back to you. Talk to Masta when you want anything bigger than one step.",
    x: 50, y: 14,
  },
  {
    id: "scout",
    name: "Scout",
    role: "Trends",
    description:
      "Looks at the ledger and proposes the next sellable niche — theme, asset type, art-style anchor, price band, trending score.",
    x: 12, y: 44,
  },
  {
    id: "director",
    name: "Director",
    role: "Art direction",
    description: "Turns the Scout's pick into a concrete art-direction brief that the Forge uses as its prompt anchor.",
    x: 30, y: 44,
  },
  {
    id: "forge",
    name: "Forge",
    role: "Generator",
    description: "Generates the raw illustration via gpt-image-1, then runs it through pixelize() — downscale, palette quantize, transparent background.",
    x: 50, y: 44,
  },
  {
    id: "curator",
    name: "Curator",
    role: "Quality",
    description: "Scores each generated asset. Failures get rejected before they reach a pack.",
    x: 70, y: 44,
  },
  {
    id: "reflector",
    name: "Reflector",
    role: "Learn",
    description: "After each run, analyzes the ledger and proposes improvements to prompts and strategy.",
    x: 88, y: 44,
  },
  {
    id: "packer",
    name: "Packer",
    role: "Pack & ZIP",
    description: "Bundles approved assets into a buyer-facing ZIP: organized folders, README, license, preview grid, itch.io cover.",
    x: 36, y: 78,
  },
  {
    id: "lister",
    name: "Lister",
    role: "Listings",
    description: "Drafts an itch.io-shaped listing — title, description, tags, suggested price — ready for you to paste into the upload form.",
    x: 64, y: 78,
  },
]

interface ActiveBubble {
  id: number
  agent: WorkshopAgentId
  text: string
  variant: "say" | "did" | "fail" | "boss"
  expiresAt: number
}

interface Parcel {
  id: number
  fromId: WorkshopAgentId
  toId: WorkshopAgentId
  /** Starting position in scene percentages. */
  fromX: number
  fromY: number
  /** Travel delta in scene pixels (computed at launch time from the scene's bounding rect). */
  dxPx: number
  dyPx: number
  startedAt: number
  durationMs: number
}

const BUBBLE_TTL_MS = 7000
const MASTA_BUBBLE_TTL_MS = 10000
const PARCEL_DURATION = 1600

const MASTA_LINES: Record<string, string[]> = {
  forging: ["Forge crew, keep it moving.", "Push the next batch through."],
  packaging: ["Wrap that pack — let's ship it.", "Boxing up assets."],
  publishing: ["Final polish. Time to list.", "Get it on the shelf."],
  blocked: ["We're blocked. Need a fix.", "Stop everything — check providers."],
  paused: ["Holding the line until we resume."],
  scanning: ["Sweeping the workshop.", "Checking the backlog."],
  idle: ["Crew's ready. What's next?", "All quiet. Awaiting orders."],
}

function bubbleVariantFor(status: WorkshopStep["status"]): ActiveBubble["variant"] {
  if (status === "failed") return "fail"
  if (status === "completed") return "did"
  return "say"
}

function truncate(s: string, n = 90): string {
  if (!s) return ""
  return s.length <= n ? s : s.slice(0, n - 1) + "…"
}

export default function WorkshopPage() {
  const router = useRouter()
  const [activity, setActivity] = useState<WorkshopActivity | null>(null)
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([])
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [forging, setForging] = useState(false)
  const [autoPolling, setAutoPolling] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null)
  const idCounter = useRef(0)
  const stepFingerprint = useRef<Map<string, string>>(new Map())
  const lastAction = useRef<string | null>(null)
  const lastRunningAgent = useRef<WorkshopAgentId | null>(null)

  const nextId = () => {
    idCounter.current += 1
    return idCounter.current
  }

  const pushBubble = useCallback(
    (b: Omit<ActiveBubble, "id" | "expiresAt">, ttl = BUBBLE_TTL_MS) => {
      const next: ActiveBubble = { ...b, id: nextId(), expiresAt: Date.now() + ttl }
      setBubbles((prev) => {
        const without = prev.filter((p) => p.agent !== b.agent)
        return [...without, next]
      })
    },
    [],
  )

  const sceneRef = useRef<HTMLDivElement>(null)

  const sendParcel = useCallback((fromId: WorkshopAgentId, toId: WorkshopAgentId) => {
    if (fromId === toId) return
    const from = AGENTS.find((a) => a.id === fromId)
    const to = AGENTS.find((a) => a.id === toId)
    if (!from || !to) return
    const sceneRect = sceneRef.current?.getBoundingClientRect()
    const w = sceneRect?.width ?? 800
    const h = sceneRect?.height ?? 450
    const dxPx = ((to.x - from.x) / 100) * w
    const dyPx = ((to.y - from.y) / 100) * h
    setParcels((prev) => [
      ...prev,
      {
        id: nextId(),
        fromId,
        toId,
        fromX: from.x,
        fromY: from.y,
        dxPx,
        dyPx,
        startedAt: Date.now(),
        durationMs: PARCEL_DURATION,
      },
    ])
  }, [])

  const pickMastaLine = (action: string): string => {
    const lines = MASTA_LINES[action] ?? MASTA_LINES.idle
    return lines[Math.floor(Math.random() * lines.length)]
  }

  const load = useCallback(async () => {
    try {
      const a = await getWorkshopActivity()
      setActivity(a)

      // Track which agent is currently running to detect work hand-offs.
      const currentRunning = a.steps.find((s) => s.status === "running")?.agent ?? null

      for (const step of a.steps) {
        const key = `${a.runId}:${step.step}`
        const prev = stepFingerprint.current.get(key)
        if (prev !== step.status) {
          stepFingerprint.current.set(key, step.status)
          if (step.status === "running" || step.status === "completed" || step.status === "failed") {
            pushBubble({
              agent: step.agent,
              text: truncate(step.summary || step.step, 90),
              variant: bubbleVariantFor(step.status),
            })
          }
          // When a step transitions to running and the prior running agent
          // was someone else, launch a parcel from the prior to the new agent.
          if (
            step.status === "running" &&
            lastRunningAgent.current &&
            lastRunningAgent.current !== step.agent
          ) {
            sendParcel(lastRunningAgent.current, step.agent)
          }
        }
      }

      if (currentRunning) lastRunningAgent.current = currentRunning

      if (a.autonomous.action !== lastAction.current) {
        lastAction.current = a.autonomous.action
        const line = pickMastaLine(a.autonomous.action)
        pushBubble({ agent: "masta", text: line, variant: "boss" }, MASTA_BUBBLE_TTL_MS)
      }
    } catch (e) {
      console.error("workshop activity:", e)
    }
  }, [pushBubble, sendParcel])

  useEffect(() => {
    load()
    if (!autoPolling) return
    const interval = setInterval(load, 4000)
    return () => clearInterval(interval)
  }, [load, autoPolling])

  // Expire bubbles + parcels.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setBubbles((prev) => prev.filter((b) => b.expiresAt > now))
      setParcels((prev) => prev.filter((p) => p.startedAt + p.durationMs + 400 > now))
    }, 400)
    return () => clearInterval(interval)
  }, [])

  const startForgeRun = async () => {
    if (forging) return
    setForging(true)
    pushBubble({ agent: "masta", text: "New batch. Crew — go.", variant: "boss" })
    try {
      const r = await runOrchestrator({ theme: "fantasy creatures", maxAssets: 2 })
      if (r.status === "completed") {
        toast.success("Run complete")
        pushBubble({ agent: "masta", text: "Good work, team. That's a pack.", variant: "boss" }, MASTA_BUBBLE_TTL_MS)
      } else {
        toast.error(r.error ?? "Run stopped")
        pushBubble({ agent: "masta", text: r.error ?? "Run stopped — pause for fixes.", variant: "boss" }, MASTA_BUBBLE_TTL_MS)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run crashed")
    } finally {
      setForging(false)
      load()
    }
  }

  const onAskMasta = (prompt: string) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("masta:preset", prompt)
    }
    setSelectedAgent(null)
    router.push("/masta")
  }

  const activeAgents = new Set(
    (activity?.steps ?? []).filter((s) => s.status === "running").map((s) => s.agent),
  )

  // History for the side panel: filter the current run's steps by the selected agent.
  const historyForSelected = selectedAgent
    ? (activity?.steps ?? []).filter((s) => s.agent === selectedAgent.id).slice().reverse()
    : []

  return (
    <div className="space-y-4 -mx-2 sm:mx-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Workshop</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Watch the crew work. Click any character to see what they're doing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/masta">
              <Crown className="size-3.5" /> Talk to Masta
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setAutoPolling((p) => !p)}
            title={autoPolling ? "Pause live updates" : "Resume live updates"}
          >
            {autoPolling ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {autoPolling ? "Pause" : "Live"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={load}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button
            onClick={startForgeRun}
            disabled={forging || activity?.autonomous.action === "blocked"}
            className="gap-2"
          >
            {forging ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {forging ? "Running..." : "New run"}
          </Button>
        </div>
      </div>

      <Separator />

      <Card className="overflow-hidden border-amber-900/20">
        <CardContent className="p-0">
          {/* Scene */}
          <div
            ref={sceneRef}
            className="relative w-full aspect-[16/9] min-h-[440px] workshop-floor overflow-hidden"
          >
            <div className="absolute inset-0 pointer-events-none workshop-vignette" />
            <div className="absolute inset-x-0 top-0 h-[28%] workshop-wall" />
            <div
              className="absolute workshop-platform"
              style={{ left: "calc(50% - 70px)", top: "8%", width: 140, height: 24 }}
            />

            {/* Agents */}
            {AGENTS.map((a, idx) => {
              const isWorking = activeAgents.has(a.id)
              const isMasta = a.id === "masta"
              const bubble = bubbles.find((b) => b.agent === a.id)
              // Face: workers in the left half face right, right half face left, so
              // they all face the center where most of the action happens.
              const facing: 1 | -1 = a.x < 50 ? 1 : -1
              return (
                <div
                  key={a.id}
                  className="absolute"
                  style={{
                    left: `${a.x}%`,
                    top: `${a.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {bubble && (
                    <SpeechBubble
                      key={bubble.id}
                      text={bubble.text}
                      variant={bubble.variant}
                      above={!isMasta}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedAgent(a)}
                    className="flex flex-col items-center select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 rounded-md hover:brightness-110 transition"
                  >
                    <div
                      className={`relative ${isMasta ? "workshop-boss" : "workshop-agent"} ${
                        isWorking ? "workshop-working" : "workshop-idle"
                      }`}
                      title={`${a.name} — ${a.role}`}
                      style={{ animationDelay: `${idx * 0.2}s` }}
                    >
                      <AgentSprite
                        variant={a.id}
                        size={isMasta ? 64 : 56}
                        facing={facing}
                        working={isWorking}
                      />
                      {isWorking && (
                        <span className="absolute top-0 right-0 size-2.5 rounded-full bg-amber-400 ring-2 ring-white/80 dark:ring-black/40 animate-pulse" />
                      )}
                    </div>
                    {!isMasta && <div className="workshop-desk -mt-1" />}
                    <div className="mt-1 flex flex-col items-center gap-0.5">
                      <span
                        className={`text-[10px] font-semibold tracking-wider uppercase ${
                          isMasta ? "text-amber-200" : "text-stone-100"
                        }`}
                      >
                        {a.name}
                      </span>
                      <span className="text-[9px] text-stone-300/70 font-mono">{a.role}</span>
                    </div>
                  </button>
                </div>
              )
            })}

            {/* Parcels — small papers/boxes flying from one agent to another */}
            {parcels.map((p) => (
              <Parcel key={p.id} parcel={p} />
            ))}

            {/* Status banner */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono pointer-events-none">
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-black/40 text-amber-100 backdrop-blur-sm">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="uppercase tracking-wider">{activity?.runStatus ?? "ready"}</span>
                <span className="opacity-70">·</span>
                <span className="opacity-80">{activity?.autonomous.detail ?? "watching..."}</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-black/40 text-amber-100 backdrop-blur-sm">
                <span className="opacity-70">budget</span>
                <span
                  className={`tabular-nums ${
                    (activity?.budgetPercent ?? 0) >= 90
                      ? "text-red-400"
                      : (activity?.budgetPercent ?? 0) >= 70
                      ? "text-amber-300"
                      : "text-emerald-300"
                  }`}
                >
                  {activity?.budgetPercent ?? 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Activity log strip */}
          <div className="border-t border-border bg-card px-4 py-3 flex items-start gap-3 max-h-32 overflow-y-auto">
            <div className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5">LOG</div>
            <div className="flex-1 space-y-0.5">
              {!activity || activity.steps.length === 0 ? (
                <p className="text-xs text-muted-foreground">Crew is idle. Start a run to see chatter.</p>
              ) : (
                activity.steps
                  .slice()
                  .reverse()
                  .map((s, i) => {
                    const agent = AGENTS.find((a) => a.id === s.agent)
                    const tint =
                      s.status === "failed"
                        ? "text-red-500"
                        : s.status === "completed"
                        ? "text-emerald-500"
                        : s.status === "running"
                        ? "text-blue-500"
                        : "text-muted-foreground"
                    return (
                      <p key={`${s.step}-${i}`} className="text-xs flex items-center gap-2">
                        <span className={`font-mono ${tint}`}>{agent?.name ?? "•"}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className={`font-mono ${tint}`}>{s.step}</span>
                        <span className="text-muted-foreground truncate">{s.summary}</span>
                      </p>
                    )
                  })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {activity?.autonomous.action === "blocked" && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-red-500" />
            <span className="font-medium">Crew is blocked.</span>
            <span className="text-muted-foreground">{activity.autonomous.detail}</span>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <LegendDot color="bg-blue-500" label="running" />
          <LegendDot color="bg-emerald-500" label="completed" />
          <LegendDot color="bg-red-500" label="failed" />
        </div>
        <Badge variant="secondary" className="text-[10px]">
          live · {autoPolling ? "every 4s" : "paused"}
        </Badge>
      </div>

      <AgentSidePanel
        open={!!selectedAgent}
        onOpenChange={(open) => !open && setSelectedAgent(null)}
        agent={selectedAgent}
        history={historyForSelected}
        onAskMasta={onAskMasta}
      />
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function Parcel({ parcel }: { parcel: Parcel }) {
  // Start position is a scene-percentage; travel delta is in pixels (computed
  // when the parcel was launched). The CSS keyframes translate by that pixel
  // delta so the path stays correct at any scene size.
  return (
    <div
      className="absolute pointer-events-none workshop-parcel"
      style={
        {
          left: `${parcel.fromX}%`,
          top: `${parcel.fromY}%`,
          ["--parcel-dx" as string]: `${parcel.dxPx}px`,
          ["--parcel-dy" as string]: `${parcel.dyPx}px`,
          animationDuration: `${parcel.durationMs}ms`,
        } as React.CSSProperties
      }
    >
      <div className="parcel-inner">📄</div>
    </div>
  )
}

function SpeechBubble({
  text,
  variant,
  above,
}: {
  text: string
  variant: ActiveBubble["variant"]
  above: boolean
}) {
  const bg =
    variant === "fail"
      ? "bg-red-50 dark:bg-red-950/85"
      : variant === "did"
      ? "bg-emerald-50 dark:bg-emerald-950/85"
      : variant === "boss"
      ? "bg-amber-50 dark:bg-amber-950/85"
      : "bg-white dark:bg-stone-900/85"
  const textColor =
    variant === "fail"
      ? "text-red-900 dark:text-red-100"
      : variant === "did"
      ? "text-emerald-900 dark:text-emerald-100"
      : variant === "boss"
      ? "text-amber-900 dark:text-amber-100"
      : "text-stone-900 dark:text-stone-100"
  const border =
    variant === "fail"
      ? "border-red-200 dark:border-red-800"
      : variant === "did"
      ? "border-emerald-200 dark:border-emerald-800"
      : variant === "boss"
      ? "border-amber-300 dark:border-amber-700"
      : "border-stone-200 dark:border-stone-700"
  return (
    <div
      className={`absolute left-1/2 ${
        above ? "-top-2 -translate-y-full" : "-bottom-2 translate-y-full"
      } -translate-x-1/2 z-10 min-w-[120px] max-w-[200px] pointer-events-none`}
    >
      <div
        className={`relative rounded-xl px-3 py-2 text-[11px] font-medium leading-snug border shadow-md workshop-bubble ${bg} ${textColor} ${border}`}
      >
        {text}
      </div>
      <span
        className={`absolute left-1/2 -translate-x-1/2 ${bg} ${
          above ? "top-full" : "bottom-full"
        }`}
        style={{
          width: 14,
          height: 8,
          clipPath: above
            ? "polygon(50% 100%, 0 0, 100% 0)"
            : "polygon(50% 0, 0 100%, 100% 100%)",
          marginTop: above ? -1 : 0,
          marginBottom: above ? 0 : -1,
        }}
      />
    </div>
  )
}
