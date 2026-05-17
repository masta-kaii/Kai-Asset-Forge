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
} from "lucide-react"
import { AGENTS } from "@/lib/agents/agent-types"

const STATS = [
  { label: "Total Assets", value: 0, icon: Sparkles, trend: "+0 this week" },
  { label: "Ready Packs", value: 0, icon: Package, trend: "0 published" },
  { label: "Active Agents", value: "0/7", icon: Activity, trend: "All idle" },
  { label: "Completed Today", value: 0, icon: CheckCircle2, trend: "No runs yet" },
]

const RECENT_ACTIVITY: { action: string; time: string }[] = []

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome to your AI game asset forge. Ready to create?
        </p>
      </div>

      <Separator />

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
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="size-5" />
              Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { step: "Trend Research", progress: 0, agent: "trend-researcher" },
              { step: "Art Direction", progress: 0, agent: "art-director" },
              { step: "Asset Generation", progress: 0, agent: "asset-generator" },
              { step: "Quality Review", progress: 0, agent: "quality-controller" },
              { step: "Packaging", progress: 0, agent: "packager" },
              { step: "Store Listing", progress: 0, agent: "store-lister" },
              { step: "Marketing", progress: 0, agent: "marketer" },
            ].map((pipeline, i) => (
              <div key={pipeline.step} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{pipeline.step}</span>
                  <span className="text-muted-foreground text-xs">
                    {pipeline.progress}%
                  </span>
                </div>
                <Progress value={pipeline.progress} className="h-1.5" />
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
                  <p className="text-xs text-muted-foreground truncate">
                    {agent.role}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  Idle
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
          {RECENT_ACTIVITY.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No activity yet. Start your first asset generation run!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {RECENT_ACTIVITY.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span>{item.action}</span>
                  <span className="text-muted-foreground text-xs">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
