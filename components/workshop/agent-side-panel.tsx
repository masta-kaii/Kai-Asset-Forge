"use client"

import Link from "next/link"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AgentSprite, type SpriteVariant } from "@/components/workshop/agent-sprite"
import { Crown, MessageCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import type { WorkshopStep } from "@/app/actions/workshop-activity"

interface AgentSidePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: {
    id: SpriteVariant
    name: string
    role: string
    description: string
  } | null
  history: WorkshopStep[]
  onAskMasta: (prompt: string) => void
}

const STATUS_ICON = {
  completed: <CheckCircle2 className="size-3.5 text-emerald-500" />,
  running: <Loader2 className="size-3.5 text-blue-500 animate-spin" />,
  failed: <AlertTriangle className="size-3.5 text-red-500" />,
  pending: <span className="size-2 rounded-full bg-muted-foreground inline-block" />,
  skipped: <span className="size-2 rounded-full bg-muted-foreground/40 inline-block" />,
} as const

const STATUS_TINT: Record<WorkshopStep["status"], string> = {
  completed: "text-emerald-500",
  running: "text-blue-500",
  failed: "text-red-500",
  pending: "text-muted-foreground",
  skipped: "text-muted-foreground/60",
}

export function AgentSidePanel({ open, onOpenChange, agent, history, onAskMasta }: AgentSidePanelProps) {
  if (!agent) return null
  const lastRunning = history.find((h) => h.status === "running")
  const lastCompleted = history.find((h) => h.status === "completed")
  const status = lastRunning ? "Working now" : lastCompleted ? "Idle — last finished" : "Idle"
  const isMasta = agent.id === "masta"

  const askPrompts: { label: string; prompt: string }[] = isMasta
    ? [
        { label: "What's our status?", prompt: "What's our status right now?" },
        { label: "What's ready to ship?", prompt: "Which packs are ready to upload?" },
        { label: "Should we run another batch?", prompt: "Should we run another forge batch? Check budget and backlog first." },
      ]
    : [
        { label: `What is ${agent.name} doing?`, prompt: `What is the ${agent.name} agent doing right now and why?` },
        { label: `Run ${agent.name}`, prompt: `Trigger the ${agent.name} agent for the next available task.` },
        { label: `How is ${agent.name} performing?`, prompt: `Reflect on the ${agent.name} agent's recent performance and propose improvements.` },
      ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start gap-4">
            <div
              className={`shrink-0 size-16 rounded-xl flex items-center justify-center ${
                isMasta ? "bg-amber-500/10 ring-2 ring-amber-500/30" : "bg-muted ring-1 ring-border"
              }`}
            >
              <AgentSprite variant={agent.id} size={56} />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-heading font-bold tracking-tight flex items-center gap-2">
                {agent.name}
                {isMasta && <Crown className="size-4 text-amber-500" />}
              </SheetTitle>
              <SheetDescription className="text-xs">{agent.role}</SheetDescription>
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className={
                    lastRunning
                      ? "text-[10px] gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20"
                      : "text-[10px] bg-muted text-muted-foreground border-border"
                  }
                >
                  {lastRunning && <Loader2 className="size-2.5 animate-spin" />}
                  {status}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <section>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
              About
            </p>
            <p className="text-sm text-foreground leading-relaxed">{agent.description}</p>
          </section>

          <Separator />

          <section>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
              Recent activity
            </p>
            {history.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No activity yet for this run.</div>
            ) : (
              <ul className="space-y-2">
                {history.slice(0, 8).map((h, i) => (
                  <li key={`${h.step}-${i}`} className="flex items-start gap-2.5">
                    <div className="pt-0.5 shrink-0">{STATUS_ICON[h.status]}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-tight">{h.step}</p>
                      <p className={`text-[11px] mt-0.5 truncate ${STATUS_TINT[h.status]}`}>
                        {h.summary || h.status}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Separator />

          <section>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
              Ask Masta about {isMasta ? "the org" : agent.name}
            </p>
            <div className="space-y-2">
              {askPrompts.map((q) => (
                <Button
                  key={q.label}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 h-auto py-2 text-xs font-normal"
                  onClick={() => onAskMasta(q.prompt)}
                >
                  <MessageCircle className="size-3.5 text-muted-foreground" />
                  <span className="text-left">{q.label}</span>
                </Button>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-border p-4">
          <Button asChild className="w-full gap-2">
            <Link href="/masta">
              <Crown className="size-4" />
              Open Masta chat
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
