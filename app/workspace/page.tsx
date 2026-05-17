"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { agentChat, maintenanceHelp } from "./actions"
import {
  Monitor,
  Send,
  Wrench,
  Terminal,
  Users,
  MessageCircle,
} from "lucide-react"

interface ChatBubble {
  agentId: string
  agentName: string
  emoji: string
  message: string
  timestamp: number
}

interface ConsoleEntry {
  type: "user" | "maintenance"
  message: string
  timestamp: number
}

const AGENTS = [
  { id: "trend-researcher", name: "Trend Researcher", emoji: "🔍", role: "Research profitable asset trends", x: 10, y: 15 },
  { id: "art-director", name: "Art Director", emoji: "🎨", role: "Maintain visual consistency", x: 35, y: 15 },
  { id: "asset-generator", name: "Asset Generator", emoji: "⚡", role: "Generate assets using AI models", x: 60, y: 15 },
  { id: "quality-controller", name: "Quality Controller", emoji: "✅", role: "Review generation quality", x: 15, y: 50 },
  { id: "packager", name: "Packager", emoji: "📦", role: "Prepare assets for selling", x: 42, y: 50 },
  { id: "store-lister", name: "Store Lister", emoji: "🏪", role: "Generate marketplace listings", x: 68, y: 50 },
  { id: "marketer", name: "Marketer", emoji: "📢", role: "Generate promotional content", x: 85, y: 15 },
]

export default function WorkspacePage() {
  const [bubbles, setBubbles] = useState<ChatBubble[]>([])
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const [userMessage, setUserMessage] = useState("")
  const [consoleInput, setConsoleInput] = useState("")
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [maintenanceTyping, setMaintenanceTyping] = useState(false)
  const consoleRef = useRef<HTMLDivElement>(null)

  const handleAgentClick = (agentId: string) => {
    setActiveAgent((prev) => (prev === agentId ? null : agentId))
  }

  const handleSendMessage = async () => {
    if (!userMessage.trim() || !activeAgent) return
    const agent = AGENTS.find((a) => a.id === activeAgent)
    if (!agent) return

    const msg = userMessage.trim()
    setUserMessage("")
    setTyping(true)

    const userBubble: ChatBubble = {
      agentId: agent.id,
      agentName: "You",
      emoji: "💬",
      message: msg,
      timestamp: Date.now(),
    }
    setBubbles((prev) => [...prev, userBubble])

    try {
      const response = await agentChat({
        agentName: agent.name,
        agentRole: agent.role,
        message: msg,
      })
      const agentBubble: ChatBubble = {
        agentId: agent.id,
        agentName: agent.name,
        emoji: agent.emoji,
        message: response,
        timestamp: Date.now(),
      }
      setBubbles((prev) => [...prev, agentBubble])
    } catch {
      setBubbles((prev) => [
        ...prev,
        { agentId: agent.id, agentName: agent.name, emoji: agent.emoji, message: "Hmm, I can't respond right now...", timestamp: Date.now() },
      ])
    } finally {
      setTyping(false)
    }
  }

  const handleConsoleSend = async () => {
    if (!consoleInput.trim()) return
    const input = consoleInput.trim()
    setConsoleInput("")
    setMaintenanceTyping(true)

    setConsoleEntries((prev) => [...prev, { type: "user", message: input, timestamp: Date.now() }])

    try {
      const response = await maintenanceHelp({ problem: input })
      setConsoleEntries((prev) => [...prev, { type: "maintenance", message: response, timestamp: Date.now() }])
    } catch {
      setConsoleEntries((prev) => [...prev, { type: "maintenance", message: "Diagnostics offline. Check system logs.", timestamp: Date.now() }])
    } finally {
      setMaintenanceTyping(false)
    }
  }

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [consoleEntries])

  const filteredBubbles = activeAgent ? bubbles.filter((b) => b.agentId === activeAgent) : bubbles

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          Pixel Workspace
        </h1>
        <p className="text-muted-foreground mt-1">
          2D pixel forge — click an agent to chat, use console for maintenance
        </p>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="size-5" />
              Agent Workstations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="relative w-full rounded-lg border-2 border-border overflow-hidden"
              style={{
                background: "repeating-linear-gradient(0deg, transparent, transparent 31px, hsl(var(--border)/0.15) 31px, hsl(var(--border)/0.15) 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, hsl(var(--border)/0.15) 31px, hsl(var(--border)/0.15) 32px), linear-gradient(135deg, hsl(var(--background)), hsl(var(--muted)))",
                minHeight: "320px",
                imageRendering: "pixelated",
              }}
            >
              {AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAgentClick(agent.id)}
                  className="absolute transition-all hover:scale-110"
                  style={{
                    left: `${agent.x}%`,
                    top: `${agent.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  title={`${agent.name} — ${agent.role}\nClick to chat`}
                >
                  <div
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${
                      activeAgent === agent.id
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                        : "border-transparent hover:border-primary/30 hover:bg-muted/50"
                    }`}
                    style={{ imageRendering: "pixelated" }}
                  >
                    <span className="text-3xl leading-none" style={{ filter: "drop-shadow(2px 2px 0px rgba(0,0,0,0.3))" }}>
                      {agent.emoji}
                    </span>
                    <span className="text-[10px] font-mono font-bold leading-tight text-center max-w-[80px] truncate">
                      {agent.name.split(" ")[0]}
                    </span>
                  </div>

                  {bubbles.some((b) => b.agentId === agent.id) && (
                    <div
                      className="absolute -top-6 left-1/2 -translate-x-1/2 bg-background border border-border rounded-md px-1.5 py-0.5"
                      style={{ imageRendering: "pixelated" }}
                    >
                      <MessageCircle className="size-3 text-primary" />
                    </div>
                  )}
                </button>
              ))}

              <div
                className="absolute flex items-center gap-2 p-2 rounded-lg border-2 border-amber-500/30 bg-amber-500/5"
                style={{ left: "88%", top: "50%", transform: "translate(-50%, -50%)" }}
                title="Maintenance Agent — Click the console to get help"
              >
                <span className="text-2xl" style={{ filter: "drop-shadow(2px 2px 0px rgba(0,0,0,0.3))" }}>
                  🛠️
                </span>
                <span className="text-[10px] font-mono font-bold">MAINT</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="size-5" />
              {activeAgent
                ? `Chat with ${AGENTS.find((a) => a.id === activeAgent)?.name ?? "Agent"}`
                : "Agent Chat"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {!activeAgent ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                <Users className="size-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Click an agent to start chatting</p>
                <p className="text-xs text-muted-foreground">Agents respond with AI-powered messages</p>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px] pr-2 mb-3">
                  {filteredBubbles.map((b, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 ${b.agentName === "You" ? "justify-end" : ""}`}
                    >
                      {b.agentName !== "You" && (
                        <span className="text-lg shrink-0 mt-0.5">{b.emoji}</span>
                      )}
                      <div
                        className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                          b.agentName === "You"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                        style={{ imageRendering: "pixelated" }}
                      >
                        <p className="text-[10px] font-semibold mb-0.5 opacity-70">{b.agentName}</p>
                        <p>{b.message}</p>
                      </div>
                      {b.agentName === "You" && (
                        <span className="text-lg shrink-0 mt-0.5">💬</span>
                      )}
                    </div>
                  ))}
                  {typing && (
                    <div className="flex gap-2">
                      <span className="text-lg shrink-0">{AGENTS.find((a) => a.id === activeAgent)?.emoji}</span>
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <p className="text-xs animate-pulse">typing...</p>
                      </div>
                    </div>
                  )}
                  {filteredBubbles.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-xs text-muted-foreground">Send a message to start the conversation</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={`Ask ${AGENTS.find((a) => a.id === activeAgent)?.name} something...`}
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="font-mono text-xs"
                  />
                  <Button size="icon" onClick={handleSendMessage} disabled={typing || !userMessage.trim()}>
                    <Send className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="size-5" />
            Maintenance Console
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={consoleRef}
            className="bg-black/90 rounded-lg p-4 font-mono text-xs space-y-2 max-h-[200px] overflow-y-auto mb-3"
            style={{ imageRendering: "pixelated" }}
          >
            <p className="text-green-500">
              ███╗ <span className="text-green-400">KAI ASSET FORGE</span> <span className="text-green-500">███╗</span>
            </p>
            <p className="text-green-600">Maintenance Agent v1.0 online. Type a problem description for diagnosis.</p>
            <p className="text-green-600">Available commands: status, logs, restart, repair [component]</p>
            <p className="text-green-600">─────────────────────────────────────</p>
            {consoleEntries.map((entry, i) => (
              <p key={i} className={entry.type === "user" ? "text-cyan-400" : "text-green-400"}>
                <span className="text-green-600">{entry.type === "user" ? "user@forge:~$" : "🛠️ maint@forge:~$"}</span>{" "}
                {entry.message}
              </p>
            ))}
            {maintenanceTyping && (
              <p className="text-green-400 animate-pulse">🛠️ maint@forge:~$ <span className="text-green-600">diagnosing...</span></p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Describe the problem (e.g., 'Asset generation keeps failing')"
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConsoleSend()}
              className="font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={handleConsoleSend} disabled={maintenanceTyping || !consoleInput.trim()}>
              <Wrench className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
