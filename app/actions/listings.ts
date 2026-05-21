"use server"

import { generateText } from "@/lib/ai/client"
import { guardTextGen, logTextCost } from "@/app/actions/budget-guard"
import type { AIProvider } from "@/lib/ai/types"

export interface ListingInput {
  platform: string
  keywords: string
  pricingTier: string
  provider?: AIProvider
}

export interface ListingResult {
  success: boolean
  title: string
  description: string
  tags: string[]
  error?: string
}

export async function generateListing(input: ListingInput): Promise<ListingResult> {
  const { platform, keywords, pricingTier, provider } = input

  const textProvider = provider ?? "deepseek"
  const guard = await guardTextGen(textProvider, 1500)
  if (!guard.allowed) {
    return { success: false, title: "", description: "", tags: [], error: guard.error }
  }

  const prompt = `You are a marketplace listing expert. Generate a store listing for the following product details. Respond ONLY with valid JSON — no markdown, no backticks.

Platform: ${platform}
Keywords: ${keywords}
Pricing Tier: ${pricingTier}

The JSON must have exactly these keys:
- "title": A compelling, SEO-friendly product title (max 80 chars)
- "description": A persuasive product description highlighting features and benefits (2-3 paragraphs)
- "tags": An array of 5-10 relevant search tags as lowercase strings`

  const result = await generateText({
    prompt,
    provider: textProvider,
    model: textProvider === "deepseek" ? "deepseek-v4-flash" : "gpt-4o",
    temperature: 0.8,
    maxTokens: 1024,
  })

  if (!result.success) {
    return { success: false, title: "", description: "", tags: [], error: result.error ?? "Generation failed" }
  }

  logTextCost(textProvider, textProvider === "deepseek" ? "deepseek-v4-flash" : "gpt-4o", prompt, result.text).catch(() => {})

  try {
    const parsed = JSON.parse(result.text)
    return {
      success: true,
      title: parsed.title ?? "",
      description: parsed.description ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    }
  } catch {
    return { success: false, title: "", description: "", tags: [], error: "Failed to parse generated listing" }
  }
}
