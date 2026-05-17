"use server"

import { generateText } from "@/lib/ai/client"
import type { AIProvider } from "@/lib/ai/types"

export async function agentChat(input: {
  agentName: string
  agentRole: string
  message: string
  provider?: AIProvider
}): Promise<string> {
  const result = await generateText({
    prompt: `You are "${input.agentName}" — ${input.agentRole} at Kai Asset Forge, a game asset production studio. Respond in character — casual, pixel-art game dev vibe. Keep it 1-2 sentences. Be creative and collaborative.\n\nUser: ${input.message}\n\n${input.agentName}:`,
    provider: input.provider ?? "deepseek",
    temperature: 0.9,
    maxTokens: 150,
  })
  return result.success ? result.text : "Connection lost... *static*"
}

export async function agentConversation(input: {
  agent1: { name: string; role: string; emoji: string }
  agent2: { name: string; role: string; emoji: string }
  topic?: string
  provider?: AIProvider
}): Promise<{ speaker: string; emoji: string; message: string }[]> {
  const topic = input.topic ?? "what game asset pack we should create next"
  const result = await generateText({
    prompt: `Two AI agents at Kai Asset Forge are chatting about "${topic}". Generate a short 3-round conversation (each says something, then the other responds, alternating). Format as JSON array: [{"speaker":"name","message":"text"},...]. Keep each message 1 sentence, casual pixel-art game dev style.\n\nAgent 1: ${input.agent1.emoji} ${input.agent1.name} (${input.agent1.role})\nAgent 2: ${input.agent2.emoji} ${input.agent2.name} (${input.agent2.role})\n\nReturn ONLY the JSON array, no markdown, no explanation:`,
    provider: input.provider ?? "deepseek",
    temperature: 1.0,
    maxTokens: 400,
  })

  if (!result.success) return []
  try {
    const parsed = JSON.parse(result.text)
    if (!Array.isArray(parsed)) return []
    return parsed.map((m: { speaker: string; message: string }) => ({
      speaker: m.speaker,
      emoji: m.speaker === input.agent1.name ? input.agent1.emoji : input.agent2.emoji,
      message: m.message,
    }))
  } catch {
    return []
  }
}

export async function maintenanceHelp(input: {
  problem: string
  provider?: AIProvider
}): Promise<string> {
  const result = await generateText({
    prompt: `You are the Maintenance Agent (🛠️) at Kai Asset Forge. Diagnose and fix issues. Respond in pixel-tech style, 2-3 sentences.\n\nProblem: ${input.problem}\n\nDiagnosis:`,
    provider: input.provider ?? "deepseek",
    temperature: 0.5,
    maxTokens: 250,
  })
  return result.success ? result.text : "Diagnostics offline. Check Vercel logs."
}

const AGENT_THOUGHTS = [
  "Scanning market trends...",
  "Analyzing competitor assets...",
  "Generating color palettes...",
  "Reviewing style consistency...",
  "Optimizing sprite sheets...",
  "Calculating price points...",
  "Drafting store descriptions...",
  "Checking Firestore quotas...",
  "Validating asset dimensions...",
  "Preparing export pipeline...",
  "Running quality checks...",
  "Updating metadata...",
]

export async function getAgentThoughts(): Promise<string[]> {
  const shuffled = [...AGENT_THOUGHTS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 7)
}

export async function brainstormProduct(): Promise<{
  name: string
  description: string
  agent: string
  emoji: string
}> {
  const agents = [
    { name: "Trend Researcher", emoji: "🔍" },
    { name: "Art Director", emoji: "🎨" },
    { name: "Marketer", emoji: "📢" },
  ]
  const agent = agents[Math.floor(Math.random() * agents.length)]
  const result = await generateText({
    prompt: `You are ${agent.name} at Kai Asset Forge. Brainstorm ONE game asset pack idea. Return JSON: {"name":"Pack Name","description":"One-sentence pitch"}. Be creative, pixel-art game dev style. Return ONLY JSON:`,
    provider: "deepseek",
    temperature: 1.0,
    maxTokens: 150,
  })
  if (!result.success) return { name: "Fantasy Pack", description: "A new asset collection.", agent: agent.name, emoji: agent.emoji }
  try {
    const parsed = JSON.parse(result.text)
    return { name: parsed.name, description: parsed.description, agent: agent.name, emoji: agent.emoji }
  } catch {
    return { name: "Mystery Pack", description: "Something brewing in the forge...", agent: agent.name, emoji: agent.emoji }
  }
}
