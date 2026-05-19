"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageSquare, Sparkles, Loader2, AlertCircle, X } from "lucide-react"
import { ChatBubble } from "@/components/hermes-chat/chat-bubble"
import { ChatInput } from "@/components/hermes-chat/chat-input"
import { ConversationList, AgentSelectorGrid } from "@/components/hermes-chat/conversation-list"
import { CHAT_AGENTS, type ChatAgentId } from "@/lib/agents/chat-personas"
import type { Conversation, ChatMessage } from "@/lib/firebase/conversations"
import {
  createChatConversation,
  listConversations,
  loadConversation,
  sendMessage,
  removeConversation,
} from "@/app/actions/chat"

export default function HermesChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<ChatAgentId>("orchestrator")
  const [provider, setProvider] = useState<"deepseek" | "claude">("deepseek")
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listConversations().then((convs) => {
      setConversations(convs)
      setInitialLoading(false)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleNewChat = useCallback(
    async (agentId: ChatAgentId) => {
      setLoading(true)
      try {
        const id = await createChatConversation(agentId, provider)
        setConversations((prev) => [
          {
            id,
            agentId,
            title: "New Chat",
            provider,
            messageCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          ...prev,
        ])
        setActiveConversationId(id)
        setMessages([])
        setSelectedAgentId(agentId)
      } finally {
        setLoading(false)
      }
    },
    [provider],
  )

  const handleSelectConversation = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const { conversation, messages: msgs } = await loadConversation(id)
      if (conversation) {
        setActiveConversationId(id)
        setMessages(msgs)
        setSelectedAgentId(conversation.agentId)
        setProvider(conversation.provider)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await removeConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
      }
    },
    [activeConversationId],
  )

  const handleSend = useCallback(
    async (message: string) => {
      setError(null)
      let convId = activeConversationId
      let convProvider = provider

      if (convId) {
        const storedConv = conversations.find((c) => c.id === convId)
        if (storedConv) convProvider = storedConv.provider
      } else {
        convId = await createChatConversation(selectedAgentId, provider)
        setConversations((prev) => [
          {
            id: convId!,
            agentId: selectedAgentId,
            title: "New Chat",
            provider,
            messageCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          ...prev,
        ])
        setActiveConversationId(convId)
      }

      const existingMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const optimisticUserMsg: ChatMessage = {
        id: "optimistic-" + Date.now(),
        role: "user",
        content: message,
        createdAt: Date.now(),
      }
      setMessages((prev) => [...prev, optimisticUserMsg])
      setLoading(true)

      try {
        const { agentMessage, title } = await sendMessage(
          convId,
          selectedAgentId,
          convProvider,
          message,
          existingMessages,
        )

        setMessages((prev) =>
          prev
            .filter((m) => m.id !== optimisticUserMsg.id)
            .concat([
              { ...optimisticUserMsg, id: "u-" + Date.now() },
              agentMessage,
            ]),
        )

        if (title) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? { ...c, title, messageCount: (c.messageCount || 0) + 2, updatedAt: Date.now() }
                : c,
            ),
          )
        } else {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? { ...c, messageCount: (c.messageCount || 0) + 2, updatedAt: Date.now() }
                : c,
            ),
          )
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id))
        setError(err instanceof Error ? err.message : "Failed to send message. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [activeConversationId, selectedAgentId, provider, messages, conversations],
  )

  const activeAgent = CHAT_AGENTS.find((a) => a.id === selectedAgentId)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -mt-6 -mx-8">
      <div className="w-72 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
          onNewChat={handleNewChat}
          selectedAgentId={selectedAgentId}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {!activeConversationId && !initialLoading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-md">
              <div className="text-center mb-8">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="size-8 text-primary" />
                </div>
                <h1 className="text-xl font-bold mb-1">Hermes Agent Chat</h1>
                <p className="text-sm text-muted-foreground">
                  Brainstorm, plan, and strategize with your AI agent team
                </p>
              </div>

              <p className="text-xs font-medium text-muted-foreground mb-3 px-1">
                Choose an agent to chat with
              </p>
              <AgentSelectorGrid
                selectedAgentId={selectedAgentId}
                onSelect={(id) => {
                  setSelectedAgentId(id)
                  handleNewChat(id)
                }}
              />

              <div className="mt-6 p-4 rounded-xl bg-secondary/50 border border-border/50">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Tip:</span>{" "}
                  Switch agents anytime using the avatar button in the chat input. Each agent
                  has a unique personality and expertise — try brainstorming with{" "}
                  <span className="text-primary font-medium">Scout</span> for market trends,{" "}
                  <span className="text-primary font-medium">Orchestrator</span> for
                  production strategy, or <span className="text-primary font-medium">Forge</span>{" "}
                  for creative asset ideas.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
              {activeAgent && (
                <>
                  <div
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeAgent.color }}
                  />
                  <span className="text-sm font-medium">
                    {activeAgent.emoji} {activeAgent.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{activeAgent.role}</span>
                </>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground/50">
                {provider === "deepseek" ? "DeepSeek" : "Claude"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && !loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="size-10 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">
                      Start the conversation with {activeAgent?.name ?? "the agent"}
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      Ask questions, brainstorm ideas, or plan your next asset pack
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  agentId={selectedAgentId}
                />
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <div className="size-8 rounded-sm bg-secondary animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-secondary border border-border/50">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-2 mx-4 mb-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="shrink-0 p-0.5 rounded hover:bg-destructive/20 transition-colors">
                  <X className="size-3" />
                </button>
              </div>
            )}

            <ChatInput
              selectedAgentId={selectedAgentId}
              onAgentChange={(id) => setSelectedAgentId(id)}
              provider={provider}
              onProviderChange={setProvider}
              onSend={handleSend}
              disabled={loading}
            />
          </>
        )}

        {initialLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
