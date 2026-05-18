"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  Sparkles, Package, Activity, TrendingUp, CheckCircle2, Clock, AlertTriangle,
  Play, Pause, RotateCcw, Zap, Loader2, Brain, PauseCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AGENTS } from "@/lib/agents/agent-types"
import { usePipeline } from "@/hooks/use-pipeline"
import { runOrchestrator, findIncompleteRun } from "@/app/actions/orchestrator"
import { getDashboardData } from "@/app/actions/dashboard"
import { pause as pauseKill, resume as resumeKill } from "@/lib/budget/kill-switch"
import { autonomousTick, type AutonomousStatus } from "@/app/actions/autonomous-agent"
import { toast } from "sonner"
import type { BudgetStatus } from "@/lib/budget/types"
import type { Asset } from "@/lib/types"

export default function DashboardPage() {
  const { steps, activeStep, isRunning, startPipeline, pausePipeline, resetPipeline } = usePipeline()
  const [totalCount, setTotalCount] = useState(0)
  const [recentGens, setRecentGens] = useState<{ action: string; time: string }[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [budget, setBudget] = useState<BudgetStatus | null>(null)
  const [forgeRunning, setForgeRunning] = useState(false)
  const [forgeSteps, setForgeSteps] = useState<{ step: string; status: string; summary: string }[]>([])
  const [forgeError, setForgeError] = useState<string | null>(null)
  const [resumeRunId, setResumeRunId] = useState<string | null>(null)
  const [forgePaused, setForgePaused] = useState(false)
  const [status, setStatus] = useState<AutonomousStatus | null>(null)

  const handleKillSwitch = async () => {
    if (forgePaused) { await resumeKill(); setForgePaused(false); toast.success("Forge resumed") }
    else { await pauseKill(); setForgePaused(true); toast.warning("Forge paused") }
  }

  useEffect(() => {
    findIncompleteRun().then((run) => { if (run) { setResumeRunId(run.runId); toast.info(`Incomplete run found. ${run.completedSteps.length}/8 done.`, { duration: 8000 }) } }).catch(() => {})
    const autoStart = async () => {
      const tick = await autonomousTick().catch(() => null)
      if (tick?.shouldForge && tick.action !== "blocked") {
        setForgeRunning(true); toast.info("Forge auto-started")
        const result = await runOrchestrator({ maxAssets: 1 }).catch(() => null)
        if (result) { setForgeSteps(result.steps.map((s) => ({ step: s.step, status: s.status, summary: s.summary }))); if (result.status === "completed") toast.success("Product forged!"); else if (result.error) setForgeError(result.error) }
        setForgeRunning(false)
      }
    }
    autoStart()
  }, [])

  const handleOrchestrator = async () => {
    if (forgeRunning) return; setForgeRunning(true); setForgeError(null); setForgeSteps([])
    toast.info("Orchestrator running...")
    try {
      const result = await runOrchestrator({ theme: "fantasy creatures", maxAssets: 2, resumeRunId: resumeRunId ?? undefined })
      if (result.isResume) setResumeRunId(result.runId)
      if (result.steps.length > 0) setForgeSteps(result.steps.map((s) => ({ step: s.step, status: s.status, summary: s.summary })))
      if (result.status === "completed") toast.success("Orchestrator complete!")
      else { setForgeError(result.error ?? "Orchestrator failed"); toast.error(result.error ?? "Orchestrator failed") }
    } catch (err) { setForgeError(err instanceof Error ? err.message : "Crashed"); toast.error("Orchestrator crashed") }
    finally { setForgeRunning(false) }
  }

  useEffect(() => {
    getDashboardData().then((data) => {
      setTotalCount(data.totalAssets); setAssets(data.recentAssets); setBudget(data.budget); setForgePaused(data.isPaused)
      setRecentGens(data.recentGenerations.map((g) => ({ action: `Asset ${g.assetId.slice(0, 8)}...`, time: new Date(g.createdAt).toLocaleTimeString() })))
    }).catch((e) => console.error("Dashboard load error:", e))
    autonomousTick().then(setStatus).catch(() => {})
  }, [])

  const approvedCount = assets.filter((a) => a.status === "approved").length

  const STATS = [
    { label: "Total Assets", value: totalCount, icon: Sparkles, trend: `${assets.length} recent` },
    { label: "Approved", value: approvedCount, icon: Package, trend: `${assets.filter(a => a.status === "review").length} pending` },
    { label: "Budget Used", value: budget ? `$${budget.monthlyUsed.toFixed(2)}` : "--", icon: Activity, trend: budget ? `$${budget.monthlyRemaining.toFixed(2)} left` : "--" },
    { label: "Completed Today", value: recentGens.length, icon: CheckCircle2, trend: `${recentGens.length} generations` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-heading font-bold tracking-tight">Dashboard</h1><p className="text-muted-foreground mt-1">Welcome to your AI game asset forge.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className={forgePaused ? "border-red-500/30 bg-red-500/5" : ""} onClick={handleKillSwitch} title={forgePaused ? "Resume" : "Pause"}>
            {forgePaused ? <Play className="size-4 text-green-500" /> : <PauseCircle className="size-4 text-red-500" />}
          </Button>
          <Button className="gap-2" onClick={handleOrchestrator} disabled={forgeRunning || forgePaused}>
            {forgeRunning ? <Loader2 className="size-4 animate-spin" /> : <Brain className="size-4" />}
            {forgeRunning ? "Running..." : resumeRunId ? "Resume" : "Launch"}
          </Button>
        </div>
      </div>

      <Separator />

      {status && (
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <Badge variant="outline" className={`gap-1.5 ${status.providers.openai === "healthy" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}>
            <span className={`size-1.5 rounded-full ${status.providers.openai === "healthy" ? "bg-green-500" : "bg-red-500"}`} />OpenAI
          </Badge>
          <Badge variant="outline" className={`gap-1.5 ${status.providers.deepseek === "healthy" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}>
            <span className={`size-1.5 rounded-full ${status.providers.deepseek === "healthy" ? "bg-green-500" : "bg-red-500"}`} />DeepSeek
          </Badge>
          <span className="text-muted-foreground">Budget: <span className="font-mono font-bold">${status.budget.used.toFixed(2)}/${status.budget.cap}</span></span>
          <div className="w-12 h-1 bg-muted rounded-full"><div className={`h-full rounded-full ${status.budget.used / status.budget.cap > 0.8 ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, (status.budget.used / status.budget.cap) * 100)}%` }} /></div>
          <span className="text-muted-foreground">Backlog: {status.backlog.unlistedAssets + status.backlog.stuckRuns + status.backlog.packsToPublish}</span>
        </div>
      )}

      {(forgeSteps.length > 0 || forgeRunning) && (
        <Card className={forgeRunning ? "border-primary/30" : ""}>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2">{forgeRunning ? <Loader2 className="size-5 animate-spin text-primary" /> : <Zap className="size-5 text-primary" />}Orchestrator {forgeRunning ? "Running" : forgeError ? "Failed" : "Complete"}</CardTitle></CardHeader>
          <CardContent>
            {forgeError && <div className="flex items-center gap-2 text-sm text-red-500 mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20"><AlertTriangle className="size-4" />{forgeError}</div>}
            <div className="space-y-3">
              {forgeSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${s.status === "completed" ? "bg-green-500/20 text-green-500" : s.status === "running" ? "bg-blue-500/20 text-blue-500" : "bg-red-500/20 text-red-500"}`}>{s.status === "completed" ? <CheckCircle2 className="size-3.5" /> : s.status === "running" ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium">{s.step}</p><p className="text-xs text-muted-foreground truncate">{s.summary}</p></div>
                  <Badge variant={s.status === "completed" ? "default" : "destructive"} className="text-xs shrink-0">{s.status}</Badge>
                </div>
              ))}
              {forgeRunning && forgeSteps.length === 0 && <div className="flex items-center gap-3 py-4"><Loader2 className="size-5 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Running on server...</p></div>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <Card key={stat.label}><CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0"><CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle><stat.icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stat.value}</div><p className="text-xs text-muted-foreground mt-1">{stat.trend}</p></CardContent></Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-lg flex items-center gap-2"><Activity className="size-5" />Pipeline Status</CardTitle><div className="flex gap-1">{!isRunning ? <Button variant="outline" size="sm" className="gap-1" onClick={startPipeline}><Play className="size-3" />Start</Button> : <Button variant="outline" size="sm" className="gap-1" onClick={pausePipeline}><Pause className="size-3" />Pause</Button>}<Button variant="ghost" size="sm" className="gap-1" onClick={resetPipeline}><RotateCcw className="size-3" /></Button></div></div></CardHeader>
          <CardContent className="space-y-4">{steps.map((step, i) => (<div key={step.key} className="space-y-1.5"><div className="flex items-center justify-between text-sm"><span className="font-medium">{step.label}</span><span className="text-muted-foreground text-xs">{i === activeStep && isRunning ? "Running..." : step.progress}%</span></div><Progress value={step.progress} className={`h-1.5 ${i === activeStep && isRunning ? "[&>div]:animate-pulse" : ""}`} /></div>))}</CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="size-5" />Agent Fleet</CardTitle></CardHeader><CardContent className="space-y-3">{AGENTS.map((agent) => (<div key={agent.name} className="flex items-center gap-3"><span className="text-lg">{agent.emoji}</span><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{agent.label}</p><p className="text-xs text-muted-foreground truncate">{agent.role}</p></div><Badge variant={isRunning && agent.name === "asset-generator" ? "default" : "secondary"} className="text-xs shrink-0">{isRunning && agent.name === "asset-generator" ? "Running" : "Idle"}</Badge></div>))}</CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clock className="size-5" />Recent Activity</CardTitle></CardHeader><CardContent>{recentGens.length === 0 ? <div className="flex flex-col items-center justify-center py-8 text-center"><AlertTriangle className="size-8 text-muted-foreground/50 mb-2" /><p className="text-sm text-muted-foreground">No activity yet.</p></div> : <div className="space-y-2">{recentGens.map((item, i) => (<div key={i} className="flex items-center justify-between text-sm py-1"><span>{item.action}</span><span className="text-muted-foreground text-xs">{item.time}</span></div>))}</div>}</CardContent></Card>
    </div>
  )
}
