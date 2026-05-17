"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { agentChat, agentConversation, maintenanceHelp, getAgentThoughts, brainstormProduct } from "./actions"
import { Monitor, Send, Wrench, Terminal, MessageCircle, Lightbulb, Sparkles } from "lucide-react"

interface AgentData {
  id: string
  name: string
  emoji: string
  role: string
  x: number
  y: number
  targetX: number
  targetY: number
  thought: string
}

interface ChatMessage {
  speaker: string
  emoji: string
  message: string
  isUser: boolean
  timestamp: number
}

interface ConsoleEntry {
  type: "user" | "maintenance"
  message: string
}

interface ProductIdea {
  name: string
  description: string
  agent: string
  emoji: string
}

const INITIAL_AGENTS: AgentData[] = [
  { id: "trend-researcher", name: "Trend Researcher", emoji: "🔍", role: "Research trends", x: 12, y: 20, targetX: 12, targetY: 20, thought: "" },
  { id: "art-director", name: "Art Director", emoji: "🎨", role: "Visual direction", x: 35, y: 18, targetX: 35, targetY: 18, thought: "" },
  { id: "asset-generator", name: "Asset Generator", emoji: "⚡", role: "Generate assets", x: 58, y: 22, targetX: 58, targetY: 22, thought: "" },
  { id: "quality-controller", name: "Quality Controller", emoji: "✅", role: "Review quality", x: 18, y: 52, targetX: 18, targetY: 52, thought: "" },
  { id: "packager", name: "Packager", emoji: "📦", role: "Bundle packs", x: 45, y: 50, targetX: 45, targetY: 50, thought: "" },
  { id: "store-lister", name: "Store Lister", emoji: "🏪", role: "Store listings", x: 72, y: 48, targetX: 72, targetY: 48, thought: "" },
  { id: "marketer", name: "Marketer", emoji: "📢", role: "Promote products", x: 85, y: 20, targetX: 85, targetY: 20, thought: "" },
]

export default function WorkspacePage() {
  const [agents, setAgents] = useState<AgentData[]>(INITIAL_AGENTS)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const [productIdeas, setProductIdeas] = useState<ProductIdea[]>([])
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [userInput, setUserInput] = useState("")
  const [consoleInput, setConsoleInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [maintenanceTyping, setMaintenanceTyping] = useState(false)
  const [autoChatting, setAutoChatting] = useState(false)
  const consoleRef = useRef<HTMLDivElement>(null)
  const agentsRef = useRef(agents)
  agentsRef.current = agents

  // ── Animate agents wandering ──
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((a) => {
          const dx = (Math.random() - 0.5) * 16
          const dy = (Math.random() - 0.5) * 14
          const tx = Math.max(4, Math.min(92, a.x + dx))
          const ty = Math.max(8, Math.min(68, a.y + dy))
          return { ...a, targetX: tx, targetY: ty }
        })
      )
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Lerp positions toward targets
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((a) => {
          const nx = a.x + (a.targetX - a.x) * 0.08
          const ny = a.y + (a.targetY - a.y) * 0.08
          return { ...a, x: nx, y: ny }
        })
      )
    }, 60)
    return () => clearInterval(interval)
  }, [])

  // ── Load thoughts and product ideas ──
  useEffect(() => {
    getAgentThoughts().then((thoughts) => {
      setAgents((prev) => prev.map((a, i) => ({ ...a, thought: thoughts[i] ?? "" })))
    })
    brainstormProduct().then((idea) => setProductIdeas((prev) => [idea, ...prev].slice(0, 4)))
  }, [])

  // ── Auto agent conversations every 18 seconds ──
  useEffect(() => {
    const runConversation = async () => {
      const currentAgents = agentsRef.current
      const idx1 = Math.floor(Math.random() * currentAgents.length)
      let idx2 = Math.floor(Math.random() * currentAgents.length)
      if (idx2 === idx1) idx2 = (idx1 + 1) % currentAgents.length
      const a1 = currentAgents[idx1]
      const a2 = currentAgents[idx2]

      setAutoChatting(true)
      const convo = await agentConversation({
        agent1: { name: a1.name, role: a1.role, emoji: a1.emoji },
        agent2: { name: a2.name, role: a2.role, emoji: a2.emoji },
      })
      if (convo.length > 0) {
        let delay = 0
        for (const m of convo) {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              { speaker: m.speaker, emoji: m.emoji, message: m.message, isUser: false, timestamp: Date.now() },
            ])
          }, delay)
          delay += 2500
        }
        setTimeout(() => setAutoChatting(false), delay)
      } else {
        setAutoChatting(false)
      }

      // Refresh thoughts
      getAgentThoughts().then((thoughts) => {
        setAgents((prev) => prev.map((a, i) => ({ ...a, thought: thoughts[i] ?? a.thought })))
      })
    }

    runConversation()
    const interval = setInterval(runConversation, 18000)
    return () => clearInterval(interval)
  }, [])

  // ── Brainstorm product every 45 seconds ──
  useEffect(() => {
    const interval = setInterval(async () => {
      const idea = await brainstormProduct()
      setProductIdeas((prev) => [idea, ...prev].slice(0, 4))
    }, 45000)
    return () => clearInterval(interval)
  }, [])

  // ── Auto-scroll console ──
  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight
  }, [consoleEntries])

  // ── Send message to active agent ──
  const handleSendMessage = async () => {
    if (!userInput.trim() || !activeAgentId) return
    const agent = agents.find((a) => a.id === activeAgentId)
    if (!agent) return

    const msg = userInput.trim()
    setUserInput("")
    setTyping(true)
    setMessages((prev) => [...prev, { speaker: "You", emoji: "💬", message: msg, isUser: true, timestamp: Date.now() }])

    try {
      const response = await agentChat({ agentName: agent.name, agentRole: agent.role, message: msg })
      setMessages((prev) => [...prev, { speaker: agent.name, emoji: agent.emoji, message: response, isUser: false, timestamp: Date.now() }])
    } catch {
      setMessages((prev) => [...prev, { speaker: agent.name, emoji: agent.emoji, message: "Signal lost... try again?", isUser: false, timestamp: Date.now() }])
    } finally {
      setTyping(false)
    }
  }

  // ── Console command ──
  const handleConsoleSend = async () => {
    if (!consoleInput.trim()) return
    const input = consoleInput.trim()
    setConsoleInput("")
    setMaintenanceTyping(true)
    setConsoleEntries((prev) => [...prev, { type: "user", message: input }])
    try {
      const response = await maintenanceHelp({ problem: input })
      setConsoleEntries((prev) => [...prev, { type: "maintenance", message: response }])
    } catch {
      setConsoleEntries((prev) => [...prev, { type: "maintenance", message: "Diagnostics offline." }])
    } finally {
      setMaintenanceTyping(false)
    }
  }

  const filteredMessages = activeAgentId
    ? messages.filter((m) => m.speaker === agents.find((a) => a.id === activeAgentId)?.name || m.speaker === "You")
        .slice(-20)
    : messages.slice(-20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Pixel Forge</h1>
          <p className="text-muted-foreground mt-1">
            {autoChatting ? "Agents are talking..." : "Live AI workshop — agents brainstorm, chat, and build together"}
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2 bg-green-500" />
          </span>
          Live
        </Badge>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="size-5" />
              Workshop Floor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div
              className="relative w-full rounded-b-lg overflow-hidden"
              style={{
                background: `
                  linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px),
                  linear-gradient(180deg, hsl(var(--muted)/0.3), hsl(var(--background)))
                `,
                backgroundSize: "32px 32px, 32px 32px, 100% 100%",
                height: "420px",
              }}
            >
              {/* Connection lines between active agents */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }}>
                {agents.map((a, i) =>
                  agents.slice(i + 1).map((b, j) => {
                    const dx = Math.abs(a.x - b.x)
                    const dy = Math.abs(a.y - b.y)
                    if (dx > 50 || dy > 40) return null
                    return (
                      <line
                        key={`${i}-${j}`}
                        x1={`${a.x}%`}
                        y1={`${a.y}%`}
                        x2={`${b.x}%`}
                        y2={`${b.y}%`}
                        stroke="currentColor"
                        strokeWidth="0.5"
                        className="text-primary"
                        strokeDasharray="4 4"
                      />
                    )
                  })
                )}
              </svg>

              {/* Agents */}
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="absolute transition-all duration-[4000ms] ease-linear"
                  style={{
                    left: `${agent.x}%`,
                    top: `${agent.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <button
                    onClick={() => setActiveAgentId((prev) => (prev === agent.id ? null : agent.id))}
                    className="flex flex-col items-center gap-1 group"
                  >
                    {/* Thought bubble */}
                    {agent.thought && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-background border rounded-md px-2 py-1 shadow-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <p className="text-[10px] font-mono text-muted-foreground">{agent.thought}</p>
                      </div>
                    )}

                    {/* Agent body */}
                    <div
                      className={`relative p-2.5 rounded-xl border-2 transition-all ${
                        activeAgentId === agent.id
                          ? "border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-110"
                          : "border-transparent hover:border-primary/40 hover:bg-muted/50 hover:scale-105"
                      }`}
                    >
                      <span
                        className="text-3xl leading-none block animate-bounce"
                        style={{ animationDuration: `${2.5 + Math.random() * 2}s`, filter: "drop-shadow(2px 2px 0px rgba(0,0,0,0.25))" }}
                      >
                        {agent.emoji}
                      </span>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary/20 rounded-full blur-[1px]" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-center leading-tight max-w-[72px] truncate">
                      {agent.name.split(" ")[0]}
                    </span>
                  </button>
                </div>
              ))}

              {/* Maintenance station */}
              <div
                className="absolute flex items-center gap-1.5 px-2.5 py-2 rounded-xl border-2 border-amber-500/20 bg-amber-500/5 backdrop-blur-sm"
                style={{ right: "3%", top: "65%", transform: "translateY(-50%)" }}
              >
                <span className="text-2xl animate-pulse" style={{ animationDuration: "3s" }}>🛠️</span>
                <span className="text-[10px] font-mono font-bold text-amber-500">MAINT</span>
              </div>

              {/* Floor labels */}
              <div className="absolute bottom-3 left-4 text-[9px] font-mono text-muted-foreground/40">
                WORKSHOP FLOOR — {agents.length} AGENTS ACTIVE
              </div>
              <div className="absolute bottom-3 right-4 text-[9px] font-mono text-muted-foreground/40">
                TILE: 32×32px
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat Panel */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="size-5" />
              {activeAgentId
                ? `${agents.find((a) => a.id === activeAgentId)?.emoji ?? ""} ${agents.find((a) => a.id === activeAgentId)?.name ?? "Chat"}`
                : "Workshop Chat"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[340px] pr-1 mb-3">
              {autoChatting && (
                <div className="text-center py-1">
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Sparkles className="size-2.5" />
                    Agents chatting...
                  </Badge>
                </div>
              )}
              {filteredMessages.map((m, i) => (
                <div key={`${m.timestamp}-${i}`} className={`flex gap-1.5 ${m.isUser ? "justify-end" : ""}`}>
                  {!m.isUser && <span className="text-sm shrink-0 mt-1">{m.emoji}</span>}
                  <div className={`rounded-lg px-2.5 py-1.5 text-xs max-w-[82%] ${
                    m.isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <p className="text-[9px] font-semibold mb-0.5 opacity-60">{m.speaker}</p>
                    <p className="leading-relaxed">{m.message}</p>
                  </div>
                  {m.isUser && <span className="text-sm shrink-0 mt-1">💬</span>}
                </div>
              ))}
              {typing && (
                <div className="flex gap-1.5">
                  <span className="text-sm shrink-0">{agents.find((a) => a.id === activeAgentId)?.emoji ?? "🤖"}</span>
                  <div className="bg-muted rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] animate-pulse">typing...</p>
                  </div>
                </div>
              )}
              {filteredMessages.length === 0 && !autoChatting && (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 py-10">
                  <MessageCircle className="size-10 text-muted-foreground/25" />
                  <p className="text-xs text-muted-foreground">Agents will chat here automatically</p>
                  <p className="text-[10px] text-muted-foreground">or click an agent to start a conversation</p>
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder={activeAgentId ? `Talk to ${agents.find((a) => a.id === activeAgentId)?.name ?? "agent"}...` : "Click an agent first"}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="font-mono text-xs h-8"
                disabled={!activeAgentId}
              />
              <Button size="icon" className="h-8 w-8" onClick={handleSendMessage} disabled={typing || !userInput.trim() || !activeAgentId}>
                <Send className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Brainstorm + Console row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="size-5" />
              Brainstorm Board
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productIdeas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Waiting for agent ideas...</p>
            ) : (
              <div className="space-y-3">
                {productIdeas.map((idea, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-xl shrink-0 mt-0.5">{idea.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{idea.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{idea.description}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">suggested by {idea.agent}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] shrink-0">New</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="size-5" />
              Maintenance Console
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div
              ref={consoleRef}
              className="bg-black/90 rounded-lg p-3 font-mono text-[11px] space-y-1.5 max-h-[140px] overflow-y-auto mb-3"
            >
              <p className="text-green-500">KAI FORGE CONSOLE v2.0</p>
              <p className="text-green-600">🛠️ Maintenance Agent online. Describe your issue.</p>
              <p className="text-green-600/70">──────────────────────────────</p>
              {consoleEntries.map((entry, i) => (
                <p key={i} className={entry.type === "user" ? "text-cyan-400" : "text-green-400"}>
                  <span className="text-green-600">{entry.type === "user" ? "you@forge:~$" : "maint@forge:~$"}</span>{" "}
                  {entry.message}
                </p>
              ))}
              {maintenanceTyping && (
                <p className="text-green-400 animate-pulse">maint@forge:~$ analyzing...</p>
              )}
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder="Describe problem (e.g. 'generation keeps failing')"
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConsoleSend()}
                className="font-mono text-xs h-8"
              />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleConsoleSend} disabled={maintenanceTyping || !consoleInput.trim()}>
                <Wrench className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
