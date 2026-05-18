import { COST_RATES, type CostEntry } from "@/lib/budget/types"
import type { AIProvider } from "@/lib/ai/types"

export function calculateImageCost(provider: AIProvider, count: number): number {
  switch (provider) {
    case "gemini":
      return count * COST_RATES.gemini.imagen_generate_1k
    case "openai":
      return count * COST_RATES.openai.gpt_image_1k
    default:
      return count * 0.003
  }
}

export function calculateTextCost(
  provider: AIProvider,
  inputTokens: number,
  outputTokens: number
): number {
  switch (provider) {
    case "openai":
      return (
        inputTokens * COST_RATES.openai.gpt4o_prompt +
        outputTokens * COST_RATES.openai.gpt4o_completion
      )
    case "deepseek":
      return (
        inputTokens * COST_RATES.deepseek.chat_prompt +
        outputTokens * COST_RATES.deepseek.chat_completion
      )
    default:
      return (inputTokens + outputTokens) * 0.000001
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}
