"use client"

import { cn } from "@/lib/utils"
import { MessageSquare, Trash2, Plus } from "lucide-react"
import { CHAT_AGENTS, type ChatAgentId } from "@/lib/agents/chat-personas"
import { AgentSprite, AgentName } from "./agent-utils"
import type { Conversation } from "@/lib/firebase/conversations"

interface ConversationListProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNewChat: (agentId: ChatAgentId) => void
  selectedAgentId: ChatAgentId
}

const PROVIDER_LABELS: Record<string, string> = { deepseek: "DS", claude: "CL" }

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNewChat,
  selectedAgentId,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          Hermes Chat
        </h2>
        <button
          onClick={() => onNewChat(selectedAgentId)}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          title="New chat"
        >
          <Plus className="size-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="size-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              Start a new chat to begin
            </p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div key={conv.id} className="group relative">
              <button
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-colors",
                  activeId === conv.id
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                <AgentSprite agentId={conv.agentId} size={24} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{conv.title}</p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {CHAT_AGENTS.find((a) => a.id === conv.agentId)?.name ?? conv.agentId}
                    {" · "}
                    {PROVIDER_LABELS[conv.provider] ?? conv.provider}
                    {" · "}
                    {conv.messageCount} msgs
                  </p>
                </div>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(conv.id)
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                title="Delete conversation"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface AgentSelectorGridProps {
  selectedAgentId: ChatAgentId
  onSelect: (id: ChatAgentId) => void
}

export function AgentSelectorGrid({ selectedAgentId, onSelect }: AgentSelectorGridProps) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {CHAT_AGENTS.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelect(agent.id)}
          className={cn(
            "flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left",
            selectedAgentId === agent.id
              ? "border-primary/40 bg-primary/5 shadow-sm"
              : "border-border bg-background hover:border-primary/20 hover:bg-secondary/50",
          )}
        >
          <AgentSprite agentId={agent.id} size={36} />
          <div>
            <div className="text-sm font-medium">
              <AgentName agentId={agent.id} />
            </div>
            <div className="text-[11px] text-muted-foreground">{agent.role}</div>
          </div>
          <div
            className="ml-auto size-2 rounded-full shrink-0"
            style={{ backgroundColor: agent.color }}
          />
        </button>
      ))}
    </div>
  )
}
