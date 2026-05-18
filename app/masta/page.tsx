"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Send, Crown, Wrench, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth/auth-context"
import { sendToMasta, type MastaToolEvent } from "@/app/actions/masta"
import {
  appendMessage,
  clearMessages,
  loadMessages,
  type StoredMastaMessage,
} from "@/lib/firebase/masta-chat"

interface UIMessage extends StoredMastaMessage {
  toolEventsFull?: MastaToolEvent[]
}

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Status", prompt: "What's our status right now?" },
  { label: "What's ready to ship?", prompt: "Show me packs that are ready to upload." },
  { label: "Scout a niche", prompt: "Scout a new pixel-art game asset niche that's trending on itch.io." },
  { label: "Run a pack", prompt: "Run a new forge pack on cozy farming creatures, 3 assets." },
  { label: "Resume stuck run", prompt: "Resume any stuck orchestrator run." },
  { label: "How can we do better?", prompt: "Reflect on recent runs and tell me what to improve." },
]

export default function MastaPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    loadMessages(user.uid)
      .then((m) => setMessages(m))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load chat"))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, sending])

  const send = async () => {
    if (!user || !input.trim() || sending) return
    const userText = input.trim()
    setInput("")
    setSending(true)

    const optimisticUser: UIMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: userText,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])

    try {
      await appendMessage(user.uid, { role: "user", content: userText })
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const res = await sendToMasta({ history, userMessage: userText })

      if (res.error) {
        toast.error(res.error)
      }

      const assistantText = res.reply || res.error || "(no response)"
      const toolSummary = res.toolEvents.map((t) => ({ name: t.name, ms: t.ms }))

      await appendMessage(user.uid, {
        role: "assistant",
        content: assistantText,
        toolEvents: toolSummary,
      })

      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-a-${Date.now()}`,
          role: "assistant",
          content: assistantText,
          toolEvents: toolSummary,
          toolEventsFull: res.toolEvents,
          createdAt: new Date().toISOString(),
        },
      ])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed")
    } finally {
      setSending(false)
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleClear = async () => {
    if (!user) return
    if (!confirm("Clear this conversation? This cannot be undone.")) return
    try {
      await clearMessages(user.uid)
      setMessages([])
      toast.success("Conversation cleared")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clear failed")
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6 lg:-m-8">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Crown className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold tracking-tight">Masta</h1>
            <p className="text-xs text-muted-foreground">
              Master agent — delegates to Scout, Forge, Curator, Reflection.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClear} className="gap-2">
          <Trash2 className="size-3.5" />
          Clear
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center text-muted-foreground text-sm gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading conversation...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center space-y-4 max-w-md mx-auto">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Crown className="size-6 text-primary" />
              </div>
              <div>
                <p className="text-base font-medium">Masta is your master agent</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Tell me what you want done. I'll delegate to Scout, the orchestrator,
                  the curator, or kick off a new pack — and report back.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                {QUICK_ACTIONS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => setInput(q.prompt)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-accent hover:border-primary/30 transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] space-y-2`}>
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.content}
              </div>
              {m.role === "assistant" && m.toolEvents && m.toolEvents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.toolEvents.map((t, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-[10px] font-mono gap-1"
                    >
                      <Wrench className="size-2.5" />
                      {t.name} · {t.ms}ms
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 text-sm bg-muted text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              Masta is thinking...
            </div>
          </div>
        )}
      </div>

      <Separator />
      <div className="px-6 py-4 shrink-0 space-y-2">
        {messages.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {QUICK_ACTIONS.map((q) => (
              <button
                key={q.label}
                onClick={() => setInput(q.prompt)}
                className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-background hover:bg-accent hover:border-primary/30 transition-colors whitespace-nowrap shrink-0"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Tell Masta what to do..."
            rows={2}
            disabled={sending}
            className="resize-none"
          />
          <Button onClick={send} disabled={sending || !input.trim()} className="h-auto py-3 gap-2">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}
