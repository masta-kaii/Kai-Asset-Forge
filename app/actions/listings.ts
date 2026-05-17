"use server"

import { generateText } from "@/lib/ai/client"
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
    provider: provider ?? "deepseek",
    model: provider === "deepseek" ? "deepseek-chat" : "gpt-4o",
    temperature: 0.8,
    maxTokens: 1024,
  })

  if (!result.success) {
    return { success: false, title: "", description: "", tags: [], error: result.error ?? "Generation failed" }
  }

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
