"use server"

import { generateText } from "@/lib/ai/client"
import { getEntriesSince } from "@/lib/firebase/ledger"
import { guardTextGen, logTextCost } from "@/app/actions/budget-guard"
import type { AIProvider } from "@/lib/ai/types"

export interface ReflectionOutput {
  summary: string
  winningPatterns: string[]
  losingPatterns: string[]
  promptDeltas: {
    scout: string | null
    forge: string | null
    lister: string | null
  }
  recommendedPause: boolean
  budgetRecommendation: string | null
  generatedAt: string
}

export async function runReflection(input?: {
  provider?: AIProvider
}): Promise<{ success: boolean; output?: ReflectionOutput; error?: string }> {
  const provider = input?.provider ?? "deepseek"
  const guard = await guardTextGen(provider, 3000)
  if (!guard.allowed) return { success: false, error: guard.error }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const entries = await getEntriesSince(since).catch(() => [])

  const summary = entries
    .map((e) => `[${e.createdAt}] ${e.operation}: ${e.provider}/${e.model} — $${e.cost.toFixed(4)} — ${JSON.stringify(e.metadata)}`)
    .join("\n")

  const totalCost = entries.reduce((sum, e) => sum + e.cost, 0)

  const result = await generateText({
    prompt: `You are Reflection, an AI that analyzes a sales ledger and updates system prompts for better output.

LEDGER (last 7 days, ${entries.length} entries, total cost: $${totalCost.toFixed(4)}):
${summary || "(no entries)"}

Analyze the ledger and return JSON:
- "summary": 2-3 sentence overview
- "winningPatterns": array of concrete observations that worked well
- "losingPatterns": array of observations that didn't work
- "promptDeltas": {"scout": suggestion or null, "forge": suggestion or null, "lister": suggestion or null}
- "recommendedPause": true if data suggests stopping
- "budgetRecommendation": suggestion for budget allocation or null

Return ONLY valid JSON, no markdown:`,
    provider,
    temperature: 0.5,
    maxTokens: 500,
  })

  logTextCost(provider, "reflection", result.text, "").catch(() => {})

  if (!result.success) return { success: false, error: result.error }

  try {
    const parsed = JSON.parse(result.text)
    return {
      success: true,
      output: {
        ...parsed,
        generatedAt: new Date().toISOString(),
      } as ReflectionOutput,
    }
  } catch {
    return { success: false, error: "Failed to parse Reflection output" }
  }
}
