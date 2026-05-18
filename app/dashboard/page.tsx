"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  Package,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Brain,
  ArrowUpRight,
  Crown,
  Pause,
  Play,
  Wrench,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { runOrchestrator } from "@/app/actions/orchestrator"
import { getCockpitData, type CockpitData } from "@/app/actions/dashboard"
import { toast } from "sonner"

const ACTION_LABEL: Record<string, { label: string; color: string; icon: typeof Play }> = {
  scanning: { label: "Scanning", color: "text-blue-500 bg-blue-500/10 border-blue-500/20", icon: Activity },
  forging: { label: "Forging", color: "text-violet-500 bg-violet-500/10 border-violet-500/20", icon: Wrench },
  packaging: { label: "Packaging", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: Package },
  publishing: { label: "Publishing", color: "text-teal-500 bg-teal-500/10 border-teal-500/20", icon: ArrowUpRight },
  blocked: { label: "Blocked", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: AlertTriangle },
  paused: { label: "Paused", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: Pause },
  idle: { label: "Idle", color: "text-muted-foreground bg-muted border-border", icon: Play },
}

export default function DashboardPage() {
  const [data, setData] = useState<CockpitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [forging, setForging] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await getCockpitData()
      setData(d)
    } catch (e) {
      console.error("Cockpit load:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  const runForge = async (resumeRunId?: string) => {
    if (forging) return
    setForging(true)
    toast.info(resumeRunId ? "Resuming forge run..." : "Launching forge run...")
    try {
      const r = await runOrchestrator({ theme: "fantasy creatures", maxAssets: 2, resumeRunId })
      if (r.status === "completed") {
        toast.success("Forge run complete")
      } else {
        toast.error(r.error ?? "Forge stopped — see Agents page")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Forge crashed")
    } finally {
      setForging(false)
      load()
    }
  }

  const action = data ? ACTION_LABEL[data.autonomous.action] ?? ACTION_LABEL.idle : ACTION_LABEL.idle
  const ActionIcon = action.icon

  const monthlyPct = data?.budget.monthlyPercent ?? 0
  const budgetTint = monthlyPct >= 90 ? "text-red-500" : monthlyPct >= 70 ? "text-amber-500" : "text-emerald-500"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Cockpit</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            What the org is doing, what needs you, what to ship next.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/masta">
              <Crown className="size-4" />
              Ask Masta
            </Link>
          </Button>
          <Button onClick={() => runForge()} disabled={forging || data?.budget.isExceeded} className="gap-2">
            {forging ? <Loader2 className="size-4 animate-spin" /> : <Brain className="size-4" />}
            {forging ? "Running..." : "New forge run"}
          </Button>
        </div>
      </div>

      <Separator />

      {/* What needs your attention */}
      {data && (data.packsReadyToUpload.length > 0 || data.stuckRunId) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.stuckRunId && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="size-8 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Stuck run waiting to resume</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.stuckRunStepsDone}/8 steps done · resume to continue
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() => runForge(data.stuckRunId!)}
                  disabled={forging}
                >
                  {forging ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                  Resume
                </Button>
              </CardContent>
            </Card>
          )}
          {data.packsReadyToUpload.slice(0, 2).map((pack) => (
            <Card key={pack.id} className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-10 rounded-md bg-muted overflow-hidden shrink-0 relative">
                  {pack.previewUrl ? (
                    <Image src={pack.previewUrl} alt={pack.title} fill className="object-cover" sizes="40px" />
                  ) : (
                    <Package className="size-4 text-muted-foreground m-auto" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pack.title}</p>
                  <p className="text-xs text-muted-foreground">Ready to upload — {pack.assets.length} assets</p>
                </div>
                <Button asChild size="sm" className="gap-1.5 shrink-0">
                  <Link href={`/products/upload/${pack.id}`}>
                    Prepare
                    <ArrowUpRight className="size-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total assets"
          value={data?.totalAssets ?? 0}
          sub={`${data?.pendingReview ?? 0} pending review`}
          icon={Sparkles}
          loading={loading}
        />
        <StatCard
          label="Ready to upload"
          value={data?.packsReadyToUpload.length ?? 0}
          sub={`${data?.packsInProgress.length ?? 0} in progress`}
          icon={Package}
          loading={loading}
          highlight={data && data.packsReadyToUpload.length > 0}
        />
        <StatCard
          label="Live on store"
          value={data?.packsLive.length ?? 0}
          sub="Uploaded to itch.io"
          icon={CheckCircle2}
          loading={loading}
        />
        <StatCard
          label="Monthly spend"
          value={data ? `$${data.budget.monthlyUsed.toFixed(2)}` : "$0.00"}
          sub={data ? `$${data.budget.monthlyRemaining.toFixed(2)} left` : "--"}
          icon={Wallet}
          loading={loading}
          tint={budgetTint}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Autonomous status */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" />
              Org status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data ? (
              <>
                <div className="flex items-center gap-3">
                  <div className={`px-2.5 py-1 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 ${action.color}`}>
                    <ActionIcon className="size-3" />
                    {action.label}
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{data.autonomous.detail}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <ProviderStatus label="OpenAI" status={data.autonomous.providers.openai} />
                  <ProviderStatus label="DeepSeek" status={data.autonomous.providers.deepseek} />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Backlog</p>
                    <p className="text-sm font-medium">
                      {data.autonomous.backlog.unlistedAssets + data.autonomous.backlog.packsToPublish} items
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Monthly budget</span>
                    <span className={`font-mono ${budgetTint}`}>
                      ${data.budget.monthlyUsed.toFixed(2)} / ${data.budget.monthlyCap.toFixed(2)}
                    </span>
                  </div>
                  <Progress value={monthlyPct} className="h-1.5" />
                </div>
              </>
            ) : (
              <div className="h-24 flex items-center justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live packs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4" />
              Shipped
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data || data.packsLive.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Nothing live yet. Ship your first pack.
              </div>
            ) : (
              <ul className="space-y-2">
                {data.packsLive.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-3 text-green-500 shrink-0" />
                    <a
                      href={p.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:underline"
                    >
                      {p.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent assets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4" />
            Recent assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.recentAssets.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              No assets yet. Click "New forge run" to start.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
              {data.recentAssets.map((a) => (
                <div
                  key={a.id}
                  className="aspect-square pixel-bg rounded-md overflow-hidden relative group ring-1 ring-border"
                  title={`${a.name} · ${a.pixelSize ?? ""}${a.pixelSize ? "px" : ""}${a.paletteSize ? ` · ${a.paletteSize} colors` : ""}`}
                >
                  {a.previewUrl && (
                    <Image
                      src={a.previewUrl}
                      alt={a.name}
                      fill
                      className="object-contain pixel-img"
                      sizes="10vw"
                      unoptimized
                    />
                  )}
                  {a.status === "review" && (
                    <div className="absolute top-1 right-1 size-2 rounded-full bg-amber-500 ring-2 ring-background" />
                  )}
                  {a.status === "approved" && (
                    <div className="absolute top-1 right-1 size-2 rounded-full bg-green-500 ring-2 ring-background" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
  highlight,
  tint,
}: {
  label: string
  value: string | number
  sub: string
  icon: typeof Sparkles
  loading: boolean
  highlight?: boolean
  tint?: string
}) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tint ?? ""}`}>{loading ? "—" : value}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

function ProviderStatus({ label, status }: { label: string; status: string }) {
  const ok = status === "healthy"
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        <div className={`size-1.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
        <span className="text-sm font-medium capitalize">{status}</span>
      </div>
    </div>
  )
}
