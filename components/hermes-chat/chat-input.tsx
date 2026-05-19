"use client"

import { useState, useRef, useEffect } from "react"
import { Send, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { CHAT_AGENTS, type ChatAgentId } from "@/lib/agents/chat-personas"
import { AgentSprite } from "./agent-utils"

interface ChatInputProps {
  selectedAgentId: ChatAgentId
  onAgentChange: (id: ChatAgentId) => void
  provider: "deepseek" | "claude"
  onProviderChange: (p: "deepseek" | "claude") => void
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({
  selectedAgentId,
  onAgentChange,
  provider,
  onProviderChange,
  onSend,
  disabled,
}: ChatInputProps) {
  const [input, setInput] = useState("")
  const [agentMenuOpen, setAgentMenuOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [selectedAgentId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAgentMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const currentAgent = CHAT_AGENTS.find((a) => a.id === selectedAgentId)

  return (
    <div className="border-t border-border bg-background p-3">
      <div className="flex items-end gap-2">
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setAgentMenuOpen(!agentMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors border border-border/50"
            title="Switch agent"
          >
            <AgentSprite agentId={selectedAgentId} size={24} />
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>

          {agentMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-52 bg-popover border border-border rounded-xl shadow-lg p-1 z-50">
              {CHAT_AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    onAgentChange(agent.id)
                    setAgentMenuOpen(false)
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm transition-colors",
                    selectedAgentId === agent.id
                      ? "bg-primary/10 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <AgentSprite agentId={agent.id} size={24} />
                  <div className="text-left">
                    <div className="text-xs font-medium">{agent.emoji} {agent.name}</div>
                    <div className="text-[10px] text-muted-foreground">{agent.role}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Chat with ${currentAgent?.name ?? "Hermes"}...`}
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-50"
            style={{ minHeight: "40px", maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = "auto"
              el.style.height = Math.min(el.scrollHeight, 120) + "px"
            }}
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center rounded-lg bg-secondary border border-border/50 p-0.5">
            <button
              onClick={() => onProviderChange("deepseek")}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                provider === "deepseek"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              DS
            </button>
            <button
              onClick={() => onProviderChange("claude")}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                provider === "claude"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              CL
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2 px-1">
        <span className="text-[10px] text-muted-foreground">
          {currentAgent?.emoji} <span className="font-medium">{currentAgent?.name}</span>
          <span className="text-muted-foreground/50"> — {currentAgent?.role}</span>
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          {provider === "deepseek" ? "DeepSeek" : "Claude"}
        </span>
        <span className="text-[10px] text-muted-foreground/50 ml-auto">
          Enter to send · Shift+Enter for new line
        </span>
      </div>
    </div>
  )
}
