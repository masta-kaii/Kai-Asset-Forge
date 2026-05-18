import { canProceed as checkBudget, recordCost as trackCost } from "@/lib/budget/budget"
import { isPaused } from "@/lib/budget/kill-switch"
import { calculateImageCost, calculateTextCost, estimateTokens } from "@/lib/ai/cost"
import { writeEntry } from "@/lib/firebase/ledger"
import type { AIProvider } from "@/lib/ai/types"

export async function guardImageGen(provider: AIProvider, count: number): Promise<{ allowed: boolean; error?: string }> {
  if (await isPaused()) return { allowed: false, error: "Forge is paused. Resume from Dashboard." }
  const cost = calculateImageCost(provider, count)
  const result = await checkBudget(cost)
  if (!result.allowed) return { allowed: false, error: result.reason }
  return { allowed: true }
}

export async function guardTextGen(provider: AIProvider, estimatedInputLength: number): Promise<{ allowed: boolean; error?: string }> {
  if (await isPaused()) return { allowed: false, error: "Forge is paused. Resume from Dashboard." }
  const inputTokens = estimateTokens(estimatedInputLength > 0 ? String(estimatedInputLength) : "")
  const cost = calculateTextCost(provider, inputTokens, inputTokens)
  const result = await checkBudget(cost)
  if (!result.allowed) return { allowed: false, error: result.reason }
  return { allowed: true }
}

export async function logImageCost(provider: AIProvider, model: string, count: number, size: string, metadata: Record<string, string> = {}) {
  const cost = calculateImageCost(provider, count)
  await trackCost(cost)
  await writeEntry({
    provider,
    model,
    operation: "image_gen",
    imageCount: count,
    imageSize: size,
    cost: Math.round(cost * 10000) / 10000,
    currency: "USD",
    metadata,
  })
}

export async function logTextCost(
  provider: AIProvider,
  model: string,
  promptText: string,
  responseText: string,
  metadata: Record<string, string> = {}
) {
  const inputTokens = estimateTokens(promptText)
  const outputTokens = estimateTokens(responseText)
  const cost = calculateTextCost(provider, inputTokens, outputTokens)
  await trackCost(cost)
  await writeEntry({
    provider,
    model,
    operation: "text_gen",
    inputTokens,
    outputTokens,
    cost: Math.round(cost * 10000) / 10000,
    currency: "USD",
    metadata,
  })
}
