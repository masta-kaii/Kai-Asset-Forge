"use client"

import { cn } from "@/lib/utils"
import Image from "next/image"
import { CHAT_AGENTS } from "@/lib/agents/chat-personas"

interface AgentSpriteProps {
  agentId: string
  size?: number
  className?: string
}

export function AgentSprite({ agentId, size = 32, className }: AgentSpriteProps) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-sm bg-background/50", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={`/sprites/agents/${agentId}/idle_f0.png`}
        alt={agentId}
        width={size}
        height={size}
        className="object-contain"
        unoptimized
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  )
}

export function AgentName({ agentId }: { agentId: string }) {
  const agent = CHAT_AGENTS.find((a) => a.id === agentId)
  if (!agent) return null
  return (
    <span className="flex items-center gap-1.5">
      <span>{agent.emoji}</span>
      <span className="font-medium">{agent.name}</span>
    </span>
  )
}

export function AgentColor({ agentId }: { agentId: string }) {
  return CHAT_AGENTS.find((a) => a.id === agentId)?.color ?? "#a78bfa"
}
