"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { autonomousTick, getAutonomousStatus, type AutonomousStatus } from "@/app/actions/autonomous-agent"
import { runOrchestrator } from "@/app/actions/orchestrator"
import { toast } from "sonner"
import { Terminal, Wrench, Zap, Play, Pause, Brain, Loader2 } from "lucide-react"

const STEPS = ["Budget", "Ledger", "Scout", "Decision", "Forge", "Curator", "Finalize", "Reflection"]

const STATUS_COLOR: Record<string, string> = {
  idle: "green", ready: "green", working: "yellow", done: "green", error: "red",
  packaged: "green", resume: "yellow", paused: "orange",
}

export default function MapPage() {
  const [status, setStatus] = useState<AutonomousStatus | null>(null)
  const [autoMode, setAutoMode] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [activityLog, setActivityLog] = useState<string[]>([])

  const log = (msg: string) => setActivityLog((prev) => [msg, ...prev].slice(0, 20))

  // ── Poll autonomous agent ──
  useEffect(() => {
    const tick = () => {
      getAutonomousStatus().then(setStatus).catch(() => {})
    }
    tick()
    const interval = setInterval(tick, 5000)
    return () => clearInterval(interval)
  }, [])

  // ── Auto-mode loop ──
  useEffect(() => {
    if (!autoMode || processing) return

    const loop = async () => {
      setProcessing(true)
      try {
        const tick = await autonomousTick()
        setStatus(tick)
        log(`[${new Date().toLocaleTimeString()}] ${tick.action}: ${tick.detail}`)

        if (tick.action === "resume") {
          log(`[${new Date().toLocaleTimeString()}] RESUME: ${tick.detail} — manual resume required on Dashboard`)
        } else if (tick.action === "ready") {
          toast.info("Auto-forging new product...")
          const result = await runOrchestrator({ maxAssets: 1 })
          log(`[${new Date().toLocaleTimeString()}] Orchestrator ${result.status}${result.error ? `: ${result.error}` : ""}`)
        } else if (tick.action === "packaged" || tick.action === "published") {
          toast.success(tick.detail)
          log(`[${new Date().toLocaleTimeString()}] ${tick.action.toUpperCase()}: ${tick.detail}`)
        } else if (tick.action === "paused" || tick.action === "backlog") {
          log(`[${new Date().toLocaleTimeString()}] ${tick.action.toUpperCase()}: ${tick.detail}`)
        }
      } catch (err) {
        log(`[${new Date().toLocaleTimeString()}] ERROR: ${err}`)
      } finally {
        setProcessing(false)
      }
    }

    loop()
    const interval = setInterval(loop, 15000) // Check every 15s
    return () => clearInterval(interval)
  }, [autoMode, processing])

  // ── Animate step cycling ──
  useEffect(() => {
    const interval = setInterval(() => setStepIndex((p) => (p + 1) % STEPS.length), 2500)
    return () => clearInterval(interval)
  }, [])

  const providerDot = (state: string) => (
    <span className={`size-1.5 rounded-full ${
      state === "healthy" ? "bg-green-500" : state === "degraded" ? "bg-yellow-400" : "bg-red-500"
    }`} />
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight font-mono">FORGE WORKSTATION</h1>
          <p className="text-muted-foreground mt-1 text-xs font-mono">
            {autoMode ? "⚡ AUTO MODE — orchestrator managing the forge independently" : "Manual mode — toggle Auto to let the forge run itself"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoMode ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setAutoMode(!autoMode)}
          >
            {autoMode ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {autoMode ? "Stop Auto" : "Auto Mode"}
          </Button>
          <div className={`size-2 rounded-full self-center ${autoMode ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Workshop Grid */}
        <Card className="lg:col-span-2 overflow-hidden" style={{ background: "#0a0a0a", borderColor: "rgba(57,255,20,0.15)" }}>
          <CardContent className="p-4">
            <div className="relative w-full rounded-lg overflow-hidden" style={{ minHeight: "380px", background: "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(57,255,20,0.04) 31px, rgba(57,255,20,0.04) 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(57,255,20,0.04) 31px, rgba(57,255,20,0.04) 32px), linear-gradient(180deg, #050505, #0d0d0d)" }}>
              {/* Conveyor */}
              <div className="absolute top-[48%] left-0 right-0 h-0.5" style={{ background: "rgba(57,255,20,0.06)" }}>
                {autoMode && (
                  <div className="absolute inset-0 animate-[slide_3s_linear_infinite]" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(57,255,20,0.4) 8px, rgba(57,255,20,0.4) 10px)" }} />
                )}
              </div>

              {/* Agent Desks */}
              {[
                { id: "scout", emoji: "🔍", name: "SCOUT", col: 1, row: 1 },
                { id: "forge", emoji: "⚡", name: "FORGE", col: 2, row: 1 },
                { id: "curator", emoji: "✅", name: "CURATE", col: 3, row: 1 },
                { id: "packager", emoji: "📦", name: "PACK", col: 1, row: 2 },
                { id: "lister", emoji: "🏪", name: "LIST", col: 2, row: 2 },
                { id: "brain", emoji: "🧠", name: "BRAIN", col: 3, row: 2 },
              ].map((agent) => {
                const isActive = autoMode && !status?.isProcessing
                const isWorking = processing && stepIndex === ["scout", "forge", "curator", "packager", "lister", "brain"].indexOf(agent.id)
                return (
                  <div key={agent.id} className="absolute transition-all duration-500" style={{ left: `${(agent.col - 1) * 32 + 4}%`, top: agent.row === 1 ? "12%" : "62%" }}>
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-[68px] h-[52px] rounded-md border-2 flex flex-col items-center justify-center gap-0.5 transition-all ${
                        isWorking ? "border-yellow-400/60 bg-yellow-400/5 shadow-[0_0_10px_rgba(250,204,21,0.12)]"
                        : isActive ? "border-green-500/30 bg-green-500/5"
                        : "border-green-500/10"
                      }`}>
                        <span className={`text-2xl leading-none ${isWorking ? "animate-bounce" : ""}`} style={{ animationDuration: "1.2s", filter: "drop-shadow(2px 2px 0 rgba(0,0,0,0.3))" }}>
                          {agent.emoji}
                        </span>
                        <div className={`w-6 h-0.5 rounded-full ${isWorking ? "bg-yellow-400/40" : "bg-green-500/10"}`} />
                      </div>
                      <span className="text-[8px] font-mono font-bold tracking-wider" style={{ color: "#39ff14", opacity: isActive ? 1 : 0.35 }}>{agent.name}</span>
                    </div>
                  </div>
                )
              })}

              {/* Status overlay */}
              <div className="absolute bottom-3 left-4 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {providerDot(status?.providers.openai ?? "healthy")}
                  <span className="text-[8px] font-mono" style={{ color: "#39ff14", opacity: 0.4 }}>OPENAI</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {providerDot(status?.providers.deepseek ?? "healthy")}
                  <span className="text-[8px] font-mono" style={{ color: "#39ff14", opacity: 0.4 }}>DEEPSEEK</span>
                </div>
              </div>
              <div className="absolute bottom-3 right-4">
                <span className="text-[8px] font-mono" style={{ color: "#39ff14", opacity: 0.3 }}>
                  ${status?.budget.remaining.toFixed(2) ?? "10"} remaining
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Terminal */}
        <Card className="flex flex-col" style={{ background: "#0a0a0a", borderColor: "rgba(57,255,20,0.15)" }}>
          <CardHeader className="pb-2" style={{ borderBottom: "1px solid rgba(57,255,20,0.1)" }}>
            <CardTitle className="text-xs font-mono flex items-center gap-2" style={{ color: "#39ff14" }}>
              <Terminal className="size-3.5" />LIVE LOG
              {autoMode && <span className="text-[9px] text-green-400 animate-pulse">● RECORDING</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-3 font-mono text-[10px] overflow-y-auto max-h-[340px] space-y-1">
            <p className="opacity-30" style={{ color: "#39ff14" }}>█ AUTONOMOUS FORGE v3.0</p>
            <p className="opacity-30" style={{ color: "#39ff14" }}>──────────────────────────</p>

            {status && (
              <>
                <p style={{ color: STATUS_COLOR[status.action] === "red" ? "#ef4444" : STATUS_COLOR[status.action] === "yellow" ? "#facc15" : "#22c55e" }}>
                  ▶ {status.action.toUpperCase()}: {status.detail}
                </p>
                <p className="opacity-40" style={{ color: "#39ff14" }}>
                  Budget: ${status.budget.used.toFixed(2)} / ${status.budget.cap}
                </p>
                <p className="opacity-40" style={{ color: "#39ff14" }}>
                  Backlog: {status.backlog.unlistedAssets} unlisted | {status.backlog.stuckRuns} stuck | {status.backlog.packsNeedingPublish} publish
                </p>
                <p className="opacity-30" style={{ color: "#39ff14" }}>──────────────────────────</p>
              </>
            )}

            {activityLog.map((entry, i) => (
              <p key={i} className="opacity-50" style={{ color: entry.includes("ERROR") ? "#ef4444" : entry.includes("PAUSED") ? "#facc15" : "#39ff14" }}>
                {entry}
              </p>
            ))}

            {activityLog.length === 0 && (
              <p className="opacity-20" style={{ color: "#39ff14" }}>Waiting for activity...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Card style={{ background: "#0a0a0a", borderColor: "rgba(57,255,20,0.1)" }}>
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {autoMode ? (
              <Zap className="size-4 animate-pulse" style={{ color: "#39ff14" }} />
            ) : (
              <Wrench className="size-4 opacity-40" style={{ color: "#39ff14" }} />
            )}
            <span className="font-mono text-[10px] opacity-40" style={{ color: "#39ff14" }}>
              {autoMode
                ? "AUTO MODE — orchestrator managing forge autonomously every 15s"
                : "Toggle Auto Mode to let the forge run itself — you just monitor"}
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px]" style={{ color: "#39ff14", opacity: 0.25 }}>
            <span>v3.0</span><span>AUTO</span><span>{new Date().toLocaleTimeString()}</span>
          </div>
        </CardContent>
      </Card>

      <style jsx global>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(1200%); }
        }
      `}</style>
    </div>
  )
}
