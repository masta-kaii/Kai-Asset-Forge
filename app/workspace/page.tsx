"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { getDashboardData } from "@/app/actions/dashboard"
import { findIncompleteRun } from "@/app/actions/orchestrator"
import type { BudgetStatus } from "@/lib/budget/types"
import { Cpu, Terminal, Wrench, Zap, ArrowRight } from "lucide-react"

interface AgentPixel {
  id: string
  emoji: string
  name: string
  desk: { row: number; col: number }
  status: "idle" | "working" | "done" | "error"
  task: string
}

const DESKS = [
  { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
  { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
]

const AGENTS = [
  { id: "scout", emoji: "🔍", name: "Scout" },
  { id: "trend", emoji: "📊", name: "Trend" },
  { id: "director", emoji: "🎨", name: "Director" },
  { id: "forge", emoji: "⚡", name: "Forge" },
  { id: "curator", emoji: "✅", name: "Curator" },
  { id: "packager", emoji: "📦", name: "Packager" },
]

const STEPS = ["Scout", "Trend", "Director", "Forge", "Curator", "Packager", "Reflection"]

export default function MapPage() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null)
  const [totalAssets, setTotalAssets] = useState(0)
  const [genCount, setGenCount] = useState(0)
  const [readyPacks, setReadyPacks] = useState(0)
  const [activeWorkflows, setActiveWorkflows] = useState(0)
  const [stuckStep, setStuckStep] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    getDashboardData().then((data) => {
      setBudget(data.budget)
      setTotalAssets(data.totalAssets)
      setGenCount(data.recentGenerations.length)
      setReadyPacks(data.readyPacks)
      setActiveWorkflows(data.activeWorkflows)
    }).catch(() => {})

    findIncompleteRun().then((run) => {
      if (run) setStuckStep(STEPS[run.completedSteps.length] ?? null)
    }).catch(() => {})
  }, [])

  // Animate active step cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const agents: AgentPixel[] = AGENTS.map((a, i) => ({
    ...a,
    desk: DESKS[i],
    status: stuckStep && STEPS.indexOf(stuckStep) === i ? "error" as const
      : i < activeStep ? "done" as const
      : i === activeStep ? "working" as const
      : "idle" as const,
    task: stuckStep && STEPS.indexOf(stuckStep) === i ? `Stuck at ${stuckStep}`
      : i < activeStep ? "Complete"
      : i === activeStep ? "Processing..."
      : "Waiting",
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight font-mono">FORGE WORKSTATION</h1>
          <p className="text-muted-foreground mt-1 text-xs font-mono">
            {stuckStep ? `⚠ Pipeline stuck at "${stuckStep}" — click Resume` : "Live agent workshop — real-time pipeline view"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stuckStep && (
            <Badge variant="destructive" className="gap-1 font-mono text-[10px]">
              <Zap className="size-2.5" />Stuck
            </Badge>
          )}
          <div className="bg-black/80 border border-green-500/30 rounded-md px-3 py-1.5 font-mono text-xs text-green-400 flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-green-500" />
            </span>
            {genCount > 0 ? "ACTIVE" : "IDLE"}
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Workshop Grid */}
        <Card className="lg:col-span-2 overflow-hidden" style={{ background: "#0a0a0a", borderColor: "rgba(57,255,20,0.15)" }}>
          <CardContent className="p-4">
            <div className="relative w-full rounded-lg overflow-hidden" style={{ minHeight: "380px", background: "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(57,255,20,0.04) 31px, rgba(57,255,20,0.04) 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(57,255,20,0.04) 31px, rgba(57,255,20,0.04) 32px), linear-gradient(180deg, #050505, #0d0d0d)" }}>
              {/* Conveyor belt */}
              <div className="absolute top-[45%] left-0 right-0 h-1 overflow-hidden" style={{ background: "rgba(57,255,20,0.08)" }}>
                <div className="absolute inset-0 animate-[slide_4s_linear_infinite]" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(57,255,20,0.3) 12px, rgba(57,255,20,0.3) 16px)" }} />
              </div>

              {/* Pipeline flow arrows */}
              <div className="absolute top-[40%] left-0 right-0 flex justify-between px-6 pointer-events-none">
                {STEPS.map((step, i) => (
                  <div key={step} className="flex items-center gap-1">
                    <div className={`size-2 rounded-full ${
                      i < activeStep ? "bg-green-500" : i === activeStep ? "bg-yellow-400 animate-pulse" : "bg-green-500/20"
                    }`} />
                    {i < STEPS.length - 1 && <div className="w-6 h-px bg-green-500/20" />}
                  </div>
                ))}
              </div>

              {/* Agent desks */}
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="absolute transition-all duration-1000"
                  style={{
                    left: `${(agent.desk.col - 1) * 32 + 4}%`,
                    top: agent.desk.row === 1 ? "12%" : "62%",
                  }}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    {/* Desk */}
                    <div className={`w-[72px] h-[56px] rounded-md border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                      agent.status === "working" ? "border-yellow-400/60 bg-yellow-400/5 shadow-[0_0_12px_rgba(250,204,21,0.15)]"
                      : agent.status === "error" ? "border-red-500/60 bg-red-500/5 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                      : agent.status === "done" ? "border-green-500/30 bg-green-500/5"
                      : "border-green-500/10 bg-transparent"
                    }`} style={{ imageRendering: "pixelated" }}>
                      {/* Agent */}
                      <span className={`text-2xl leading-none ${agent.status === "working" ? "animate-bounce" : ""}`}
                        style={{ animationDuration: "1.5s", filter: "drop-shadow(2px 2px 0 rgba(0,0,0,0.3))" }}>
                        {agent.emoji}
                      </span>
                      {/* Desk tool */}
                      <div className={`w-8 h-1 rounded-full ${agent.status === "working" ? "bg-yellow-400/40" : "bg-green-500/15"}`} />
                    </div>
                    {/* Label */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-mono font-bold tracking-wider" style={{ color: agent.status === "error" ? "#ef4444" : "#39ff14", opacity: agent.status === "idle" ? 0.4 : 1 }}>
                        {agent.name}
                      </span>
                      <span className={`text-[7px] font-mono ${agent.status === "working" ? "text-yellow-400 animate-pulse" : agent.status === "error" ? "text-red-400" : ""}`}
                        style={{ color: agent.status === "idle" ? "rgba(57,255,20,0.3)" : undefined, opacity: agent.status === "idle" ? 0.5 : 1 }}>
                        {agent.task}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Item flowing on conveyor */}
              {genCount > 0 && (
                <div className="absolute top-[42%] animate-[slide_8s_linear_infinite]" style={{ animationName: "slide", animationDuration: "8s" }}>
                  <div className="flex items-center gap-1">
                    <span className="text-lg">📦</span>
                    <span className="text-[8px] font-mono text-green-500/50">{totalAssets} items</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Terminal Panel */}
        <Card className="flex flex-col" style={{ background: "#0a0a0a", borderColor: "rgba(57,255,20,0.15)" }}>
          <CardHeader className="pb-2" style={{ borderBottom: "1px solid rgba(57,255,20,0.1)" }}>
            <CardTitle className="text-sm font-mono flex items-center gap-2" style={{ color: "#39ff14" }}>
              <Terminal className="size-4" />SYS.LOG
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 font-mono text-[10px] overflow-y-auto max-h-[340px] space-y-1.5">
            <p className="opacity-40" style={{ color: "#39ff14" }}>█ FORGE STATION v2.0</p>
            <p className="opacity-40" style={{ color: "#39ff14" }}>─────────────────────</p>
            {stuckStep && (
              <p style={{ color: "#ef4444" }}>⚠ Pipeline stuck at: {stuckStep}</p>
            )}
            {STEPS.map((step, i) => (
              <p key={step} style={{ color: i < activeStep ? "#22c55e" : i === activeStep ? "#facc15" : "rgba(57,255,20,0.3)" }}>
                {i < activeStep ? "✓" : i === activeStep ? "▶" : "○"} {step}
                {i < activeStep ? " — DONE" : i === activeStep ? " — RUNNING" : ""}
              </p>
            ))}
            <p className="opacity-40 pt-2" style={{ color: "#39ff14" }}>─────────────────────</p>
            <p className="opacity-40" style={{ color: "#39ff14" }}>Budget: ${budget?.monthlyUsed.toFixed(2) ?? "0.00"} / ${budget?.monthlyCap.toFixed(2) ?? "10"}</p>
            <p className="opacity-40" style={{ color: "#39ff14" }}>Assets: {totalAssets} | Packs: {readyPacks} | Active: {activeWorkflows}</p>
            <p className="opacity-40" style={{ color: "#39ff14" }}>Stuck: {stuckStep ? `YES — ${stuckStep}` : "NONE"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Card style={{ background: "#0a0a0a", borderColor: "rgba(57,255,20,0.1)" }}>
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="size-4 opacity-50" style={{ color: "#39ff14" }} />
            <span className="font-mono text-[10px] opacity-40" style={{ color: "#39ff14" }}>
              {stuckStep ? "Pipeline awaiting resume — go to Dashboard and click Resume Forge" : "All systems nominal — pipeline flowing"}
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px]" style={{ color: "#39ff14", opacity: 0.3 }}>
            <span>V2.0</span><span>6 AGENTS</span><span>{totalAssets} ITEMS</span>
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
