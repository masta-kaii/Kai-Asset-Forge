"use server"

import { generateText } from "@/lib/ai/client"
import { guardTextGen, logTextCost } from "@/app/actions/budget-guard"
import type { AIProvider } from "@/lib/ai/types"

export interface CuratorScore {
  technicalQuality: number
  styleConsistency: number
  commercialAppeal: number
  originality: number
  overall: number
  verdict: "pass" | "fail"
  reasoning: string
  tags: string[]
}

function extractJson(text: string): any {
  try { return JSON.parse(text) } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) {
    try { return JSON.parse(match[1].trim()) } catch {}
  }
  const braceStart = text.indexOf("{")
  const braceEnd = text.lastIndexOf("}")
  if (braceStart >= 0 && braceEnd > braceStart) {
    try { return JSON.parse(text.slice(braceStart, braceEnd + 1)) } catch {}
  }
  throw new Error("Could not extract JSON from response")
}

export async function curatorScore(input: {
  assetName: string
  assetType: string
  assetStyle: string
  prompt: string
  provider?: AIProvider
}): Promise<{ success: boolean; score?: CuratorScore; error?: string }> {
  const provider = input.provider ?? "deepseek"
  const guard = await guardTextGen(provider, 1500)
  if (!guard.allowed) return { success: false, error: guard.error }

  const result = await generateText({
    prompt: `You are Curator, a quality-control AI for a pixel-art game asset store. Score this asset:

Name: ${input.assetName}
Type: ${input.assetType}
Style: ${input.assetStyle}
Generation Prompt: ${input.prompt}

Return JSON with:
- "technicalQuality": 1-10 (resolution, palette, transparency)
- "styleConsistency": 1-10 (matches intended style)
- "commercialAppeal": 1-10 (would an indie dev buy this?)
- "originality": 1-10 (not generic AI-looking)
- "overall": 1-10 (weighted average)
- "verdict": "pass" if overall >= 6, else "fail"
- "reasoning": 1-2 sentence explanation
- "tags": array of 3-5 descriptive tags

Return ONLY valid JSON, no markdown:`,
    provider,
    model: "deepseek-v4-flash",
    temperature: 0.4,
    maxTokens: 300,
  })

  logTextCost(provider, "curator", result.text, "").catch(() => {})

  if (!result.success) return { success: false, error: result.error }

  try {
    const parsed = extractJson(result.text)
    return { success: true, score: parsed as CuratorScore }
  } catch {
    return { success: false, error: "Failed to parse Curator output" }
  }
}
