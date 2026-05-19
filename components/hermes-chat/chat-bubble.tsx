"use client"

import { cn } from "@/lib/utils"
import { AgentSprite, AgentName } from "./agent-utils"
import type { ChatMessage } from "@/lib/firebase/conversations"

interface ChatBubbleProps {
  message: ChatMessage
  agentId: string
}

export function ChatBubble({ message, agentId }: ChatBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && (
        <div className="shrink-0 mt-0.5">
          <AgentSprite agentId={agentId} size={32} className="border border-border" />
        </div>
      )}

      <div className={cn("flex flex-col gap-1 max-w-[75%]", isUser ? "items-end" : "items-start")}>
        {!isUser && (
          <span className="text-[11px] text-muted-foreground px-1">
            <AgentName agentId={agentId} />
          </span>
        )}

        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : "bg-secondary text-secondary-foreground rounded-tl-md border border-border/50",
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        <span className="text-[10px] text-muted-foreground px-1 tabular-nums">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {isUser && (
        <div className="shrink-0 mt-0.5">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold border border-border/50">
            K
          </div>
        </div>
      )}
    </div>
  )
}
