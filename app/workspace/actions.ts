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
    prompt: `You are an AI agent named "${input.agentName}" with role: ${input.agentRole}. You work at Kai Asset Forge, a game asset production system. You communicate in a casual, pixel-art game dev style. Keep responses under 2 sentences, friendly and helpful.\n\nUser message: ${input.message}\n\nRespond as ${input.agentName}:`,
    provider: input.provider ?? "deepseek",
    temperature: 0.9,
    maxTokens: 200,
  })
  return result.success ? result.text : "Sorry, I'm having trouble communicating right now."
}

export async function maintenanceHelp(input: {
  problem: string
  context?: string
  provider?: AIProvider
}): Promise<string> {
  const result = await generateText({
    prompt: `You are the Maintenance Agent (🛠️) at Kai Asset Forge. Your job is to diagnose and fix system issues. Respond in a helpful, pixel-tech style.\n\nProblem: ${input.problem}\n${input.context ? `Context: ${input.context}` : ""}\n\nProvide a diagnosis and fix suggestion in 2-3 sentences:`,
    provider: input.provider ?? "deepseek",
    temperature: 0.5,
    maxTokens: 300,
  })
  return result.success ? result.text : "I can't diagnose that right now. Try checking the Vercel logs."
}

export async function agentBroadcast(input: {
  topic: string
  provider?: AIProvider
}): Promise<string[]> {
  const responses: string[] = []
  const agents = [
    { name: "Trend Researcher", role: "Research profitable asset trends" },
    { name: "Art Director", role: "Maintain visual consistency" },
    { name: "Asset Generator", role: "Generate assets using AI models" },
  ]

  for (const agent of agents) {
    const result = await generateText({
      prompt: `You are "${agent.name}" at Kai Asset Forge. A broadcast was sent: "${input.topic}". Respond as ${agent.name} in one short sentence, pixel-art game dev style:`,
      provider: input.provider ?? "deepseek",
      temperature: 0.9,
      maxTokens: 100,
    })
    responses.push(result.success ? result.text : "...")
  }

  return responses
}
