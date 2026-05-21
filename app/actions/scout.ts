"use server"

import { generateText } from "@/lib/ai/client"
import { getRecentEntries } from "@/lib/firebase/ledger"
import { getPrompt } from "@/lib/firebase/prompts"
import { guardTextGen, logTextCost } from "@/app/actions/budget-guard"
import type { AIProvider } from "@/lib/ai/types"
import type { AssetType, AssetStyle } from "@/lib/types"

export interface ScoutProposal {
  theme: string
  assetType: AssetType
  style: AssetStyle
  count: number
  styleAnchor: string
  targetPrice: number
  rationale: string
  trendingScore: number
}

function extractJson(text: string): any {
  // Try direct parse first
  try { return JSON.parse(text) } catch {}
  // Try extracting from markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) {
    try { return JSON.parse(match[1].trim()) } catch {}
  }
  // Try finding first { ... } that parses
  const braceStart = text.indexOf("{")
  const braceEnd = text.lastIndexOf("}")
  if (braceStart >= 0 && braceEnd > braceStart) {
    try { return JSON.parse(text.slice(braceStart, braceEnd + 1)) } catch {}
  }
  throw new Error("Could not extract JSON from response")
}

export async function scoutTrends(input: {
  theme?: string
  provider?: AIProvider
}): Promise<{ success: boolean; proposal?: ScoutProposal; error?: string }> {
  const provider = input.provider ?? "deepseek"
  const guard = await guardTextGen(provider, 2000)
  if (!guard.allowed) return { success: false, error: guard.error }

  const ledgerEntries = await getRecentEntries(20).catch(() => [])
  const pastThemes = ledgerEntries
    .filter((e) => e.operation === "image_gen")
    .map((e) => e.metadata?.assetType)
    .filter(Boolean)

  const pastThemesStr = pastThemes.length > 0
    ? `Previously generated types: ${[...new Set(pastThemes)].join(", ")}. Avoid repeating.`
    : "No prior generation data."

  // Read evolved prompt from Firestore (updated by Reflection)
  const scoutPrompt = await getPrompt("scout")

  const result = await generateText({
    prompt: `${scoutPrompt}

Theme: "${input.theme ?? "fantasy creatures"}"
${pastThemesStr}

Return JSON with: theme, assetType, style, count (2-8), styleAnchor, targetPrice (2-8 USD), rationale (1 sentence), trendingScore (1-10).
Return ONLY valid JSON, no markdown:`,
    provider,
    model: "deepseek-v4-flash",
    temperature: 0.8,
    maxTokens: 600,
  })

  logTextCost(provider, "scout", result.success ? result.text : "", "").catch(() => {})

  if (!result.success) return { success: false, error: result.error }

  try {
    const parsed = extractJson(result.text)
    return { success: true, proposal: parsed as ScoutProposal }
  } catch {
    return { success: false, error: "Failed to parse Scout output" }
  }
}
