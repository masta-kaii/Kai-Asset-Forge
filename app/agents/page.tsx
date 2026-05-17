import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Activity,
  Play,
  Pause,
  RotateCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react"
import { AGENTS, PIPELINE_STEPS } from "@/lib/agents/agent-types"

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            Agent Monitor
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and control your AI agent fleet
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Pause className="size-3.5" />
            Pause All
          </Button>
          <Button size="sm" className="gap-2">
            <Play className="size-3.5" />
            Start Pipeline
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((agent) => (
          <Card key={agent.name} className="hover:border-primary/30 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{agent.emoji}</span>
                  <CardTitle className="text-base">{agent.label}</CardTitle>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs"
                >
                  Idle
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {agent.role}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Completed</span>
                <span className="font-mono">0 tasks</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Success Rate</span>
                <span className="font-mono">100%</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Last Active</span>
                <span className="font-mono flex items-center gap-1">
                  <Clock className="size-3" />
                  Never
                </span>
              </div>
              <div className="flex gap-1.5 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1">
                  <Play className="size-3" />
                  Run
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs gap-1">
                  <RotateCw className="size-3" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="size-5" />
            Workflow Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 border-l-2 border-border space-y-6">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step} className="relative">
                <div className="absolute -left-[25px] top-1 size-3 rounded-full border-2 border-border bg-background" />
                <p className="text-sm font-medium">{step}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Waiting to start
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
