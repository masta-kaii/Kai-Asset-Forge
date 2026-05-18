"use server"

import { generateText } from "@/lib/ai/client"
import { getRecentEntries } from "@/lib/firebase/ledger"
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

export async function scoutTrends(input: {
  theme?: string
  provider?: AIProvider
}): Promise<{ success: boolean; proposal?: ScoutProposal; error?: string }> {
  const provider = input.provider ?? "deepseek"
  const guard = guardTextGen(provider, 2000)
  if (!guard.allowed) return { success: false, error: guard.error }

  const ledgerEntries = await getRecentEntries(20).catch(() => [])
  const pastThemes = ledgerEntries
    .filter((e) => e.operation === "image_gen")
    .map((e) => e.metadata?.assetType)
    .filter(Boolean)

  const pastThemesStr = pastThemes.length > 0
    ? `Previously generated types: ${[...new Set(pastThemes)].join(", ")}. Avoid repeating.`
    : "No prior generation data."

  const result = await generateText({
    prompt: `You are Scout, a market analyst for a pixel-art game asset store on itch.io. Research trending game asset types for "${input.theme ?? "fantasy creatures"}".

${pastThemesStr}

Return JSON with:
- "theme": concrete visual theme (e.g., "haunted forest enemies")
- "assetType": one of creature, accessory, item, weapon, food, material, animation, ui-icon
- "style": one of pixel-art, cute-retro, pastel-cyber-fantasy, tamagotchi
- "count": number between 2-8
- "styleAnchor": keyword string for generation (e.g., "gritty 32px dark outline limited palette")
- "targetPrice": price in USD between 2-8
- "rationale": 1 sentence why this will sell
- "trendingScore": 1-10 estimate

Return ONLY valid JSON, no markdown:`,
    provider,
    temperature: 0.8,
    maxTokens: 400,
  })

  logTextCost(provider, "scout", result.success ? result.text : "", "").catch(() => {})

  if (!result.success) return { success: false, error: result.error }

  try {
    const parsed = JSON.parse(result.text)
    return { success: true, proposal: parsed as ScoutProposal }
  } catch {
    return { success: false, error: "Failed to parse Scout output" }
  }
}
