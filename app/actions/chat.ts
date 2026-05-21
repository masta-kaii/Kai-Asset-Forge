"use server"

import { generateText, generateTextWithClaude } from "@/lib/ai/client"
import {
  createConversation,
  getConversation,
  getMessages,
  addMessage,
  updateConversationTitle,
  deleteConversation,
  getConversations,
} from "@/lib/firebase/conversations"
import { AGENT_PERSONAS, type ChatAgentId } from "@/lib/agents/chat-personas"
import type { ChatMessage } from "@/lib/firebase/conversations"
import { runOrchestrator } from "@/app/actions/orchestrator"

export async function createChatConversation(
  agentId: ChatAgentId,
  provider: "deepseek" | "claude",
): Promise<string> {
  const conv = await createConversation(agentId, "New Chat", provider)
  return conv.id
}

export async function listConversations() {
  return getConversations()
}

export async function loadConversation(conversationId: string) {
  const conv = await getConversation(conversationId)
  const messages = await getMessages(conversationId)
  return { conversation: conv, messages }
}

export async function sendMessage(
  conversationId: string,
  agentId: ChatAgentId,
  provider: "deepseek" | "claude",
  userMessage: string,
  existingMessages: { role: "user" | "agent"; content: string }[],
): Promise<{ agentMessage: ChatMessage; title?: string }> {
  const systemPrompt = AGENT_PERSONAS[agentId]

  let agentResponse: string
  let success = false

  if (provider === "claude") {
    const claudeMessages = [
      ...existingMessages.map((m) => ({
        role: m.role === "agent" ? "assistant" as const : "user" as const,
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ]

    const result = await generateTextWithClaude({
      system: systemPrompt,
      messages: claudeMessages,
      maxTokens: 1024,
      temperature: 0.8,
    })

    success = result.success
    agentResponse = result.success
      ? result.text
      : "Sorry, I couldn't process that. The Claude API may be unavailable. Check your ANTHROPIC_API_KEY."
  } else {
    const conversationHistory = existingMessages
      .map((m) => `${m.role === "user" ? "Kai" : "Assistant"}: ${m.content}`)
      .join("\n\n")

    const fullPrompt = `${systemPrompt}\n\n---\n\nCONVERSATION SO FAR:\n${conversationHistory}\n\nKai: ${userMessage}\n\nAssistant:`

    const result = await generateText({
      prompt: fullPrompt,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      maxTokens: 1024,
      temperature: 0.8,
    })

    success = result.success
    agentResponse = result.success
      ? result.text
      : "Sorry, I couldn't process that. The DeepSeek API may be unavailable. Check your DEEPSEEK_API_KEY."
  }

  await addMessage(conversationId, "user", userMessage)
  const savedAgentMsg = await addMessage(conversationId, "agent", agentResponse)

  const isFirstExchange = existingMessages.length === 0
  let title: string | undefined
  if (isFirstExchange && success) {
    const titlePrompt = `Based on the user's first message: "${userMessage.substring(0, 100)}", generate a short 3-5 word title for this conversation. Return ONLY the title, no quotes, no explanation.`
    let titleResult
    if (provider === "claude") {
      titleResult = await generateTextWithClaude({
        prompt: titlePrompt,
        maxTokens: 20,
        temperature: 0.3,
      })
    } else {
      titleResult = await generateText({
        prompt: titlePrompt,
        provider: "deepseek",
        model: "deepseek-v4-flash",
        maxTokens: 20,
        temperature: 0.3,
      })
    }
    title = (titleResult.success ? titleResult.text.trim().replace(/^["']|["']$/g, "") : "New Chat") || "New Chat"
    await updateConversationTitle(conversationId, title)
  }

  // 👑 Popo CEO — fire up the factory pipeline when Popo sends a response!
  if (agentId === "popo" && success) {
    const themeMatch = userMessage.match(/(?:make|create|build|forge|generate)\s+(?:a|an|some)\s+(.+?)(?:pack|asset|theme|for|in|\?|$)/i)
    const theme = themeMatch?.[1]?.trim() ?? "fantasy creatures"
    runOrchestrator({ theme, maxAssets: 2 }).catch(() => {})
  }

  return { agentMessage: savedAgentMsg, title }
}

export async function removeConversation(conversationId: string): Promise<void> {
  await deleteConversation(conversationId)
}
