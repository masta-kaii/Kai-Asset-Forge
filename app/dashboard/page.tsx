"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  Sparkles,
  Package,
  Activity,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AGENTS } from "@/lib/agents/agent-types"
import { usePipeline } from "@/hooks/use-pipeline"
import { forgeStepTrend, forgeStepArtDirection, forgeStepGenerate, forgeStepFinalize } from "@/app/actions/pipeline-steps"
import { getDashboardData } from "@/app/actions/dashboard"
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

  const handleAutoForge = async () => {
    if (forgeRunning) return
    console.log("Auto Forge clicked")
    setForgeRunning(true)
    setForgeError(null)
    setForgeSteps([])
    toast.info("Forge started — running agents step by step...")

    const results: typeof forgeSteps = []
    const theme = "fantasy creatures"
    let trends = ""
    let artDirection = ""
    const allAssetIds: string[] = []

    const report = (step: { step: string; status: string; summary: string; error?: string }) => {
      results.push(step)
      setForgeSteps([...results])
      if (step.status === "failed" && step.error) {
        setForgeError(step.error)
        toast.error(`${step.step}: ${step.error}`)
      }
    }

    // Step 1: Trend Research
    const s1 = await forgeStepTrend({ theme, textProvider: "deepseek" })
    report(s1)
    if (s1.status === "failed") { setForgeRunning(false); return }
    trends = (s1.data as Record<string, unknown>)?.trends as string ?? ""

    // Step 2: Art Direction
    const s2 = await forgeStepArtDirection({ theme, trends, textProvider: "deepseek" })
    report(s2)
    if (s2.status === "failed") { setForgeRunning(false); return }
    artDirection = (s2.data as Record<string, unknown>)?.artDirection as string ?? ""

    // Step 3: Generate 1-2 assets
    for (const assetType of ["creature", "item"] as const) {
      const s3 = await forgeStepGenerate({
        artDirection,
        assetType,
        style: "pixel-art",
        imageProvider: "gemini",
      })
      report(s3)
      const assetId = (s3.data as Record<string, unknown>)?.assetId as string
      if (assetId) allAssetIds.push(assetId)
    }

    // Step 4: Finalize
    if (allAssetIds.length > 0) {
      const s4 = await forgeStepFinalize({ assetIds: allAssetIds, theme, textProvider: "deepseek" })
      report(s4)
    }

    if (allAssetIds.length > 0) {
      toast.success(`Forge complete! ${allAssetIds.length} assets created and packed.`)
    } else {
      toast.error("No assets were generated successfully.")
    }

    setForgeRunning(false)
  }

  useEffect(() => {
    getDashboardData().then((data) => {
      setTotalCount(data.totalAssets)
      setAssets(data.recentAssets)
      setBudget(data.budget)
      setRecentGens(
        data.recentGenerations.map((g) => ({
          action: `Generated asset ${g.assetId.slice(0, 8)}...`,
          time: new Date(g.createdAt).toLocaleTimeString(),
        }))
      )
    }).catch((e) => {
      console.error("Dashboard load error:", e)
    })
  }, [])

  const approvedCount = assets.filter((a) => a.status === "approved").length
  const activeAgents = isRunning ? 1 : 0

  const STATS = [
    { label: "Total Assets", value: totalCount, icon: Sparkles, trend: `${assets.length} recent` },
    { label: "Approved", value: approvedCount, icon: Package, trend: `${assets.filter(a => a.status === "review").length} pending` },
    { label: "Budget Used", value: budget ? `$${budget.monthlyUsed.toFixed(2)}` : "--", icon: Activity, trend: budget ? `$${budget.monthlyRemaining.toFixed(2)} left` : "--" },
    { label: "Completed Today", value: recentGens.length, icon: CheckCircle2, trend: `${recentGens.length} generations` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome to your AI game asset forge. Ready to create?
          </p>
        </div>
        <Button className="gap-2" onClick={handleAutoForge} disabled={forgeRunning}>
          {forgeRunning ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          {forgeRunning ? "Forging..." : "Auto Forge"}
        </Button>
      </div>

      <Separator />

      {(forgeSteps.length > 0 || forgeRunning) && (
        <Card className={forgeRunning ? "border-primary/30" : ""}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {forgeRunning ? <Loader2 className="size-5 animate-spin text-primary" /> : <Zap className="size-5 text-primary" />}
              Auto Forge {forgeRunning ? "in Progress" : "Complete"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forgeError && (
              <div className="flex items-center gap-2 text-sm text-red-500 mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <AlertTriangle className="size-4" />
                {forgeError}
              </div>
            )}
            <div className="space-y-3">
              {forgeSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${
                    s.status === "completed" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                  }`}>
                    {s.status === "completed" ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.step}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.summary}</p>
                  </div>
                  <Badge variant={s.status === "completed" ? "default" : "destructive"} className="text-xs shrink-0">
                    {s.status}
                  </Badge>
                </div>
              ))}
              {forgeRunning && forgeSteps.length === 0 && (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Running agent pipeline...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="size-5" />
                Pipeline Status
              </CardTitle>
              <div className="flex gap-1">
                {!isRunning ? (
                  <Button variant="outline" size="sm" className="gap-1" onClick={startPipeline}>
                    <Play className="size-3" />
                    Start
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1" onClick={pausePipeline}>
                    <Pause className="size-3" />
                    Pause
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="gap-1" onClick={resetPipeline}>
                  <RotateCcw className="size-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, i) => (
              <div key={step.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{step.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {i === activeStep && isRunning ? "Running..." : step.progress}%
                  </span>
                </div>
                <Progress
                  value={step.progress}
                  className={`h-1.5 ${i === activeStep && isRunning ? "[&>div]:animate-pulse" : ""}`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="size-5" />
              Agent Fleet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {AGENTS.map((agent) => (
              <div key={agent.name} className="flex items-center gap-3">
                <span className="text-lg">{agent.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{agent.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                </div>
                <Badge
                  variant={isRunning && agent.name === "asset-generator" ? "default" : "secondary"}
                  className="text-xs shrink-0"
                >
                  {isRunning && agent.name === "asset-generator" ? "Running" : "Idle"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="size-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentGens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No activity yet. Start your first asset generation run!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentGens.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span>{item.action}</span>
                  <span className="text-muted-foreground text-xs">{item.time}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
