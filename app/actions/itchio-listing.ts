"use server"

import { generateText } from "@/lib/ai/client"
import { getAssetById } from "@/lib/firebase/assets"
import { getPackById, updatePackDeliverable } from "@/lib/firebase/packs"
import { guardTextGen, logTextCost } from "@/app/actions/budget-guard"
import type { AIProvider } from "@/lib/ai/types"
import type { AssetPack } from "@/lib/types"

export interface ItchListingResult {
  success: boolean
  listing?: AssetPack["listing"]
  packId: string
  error?: string
}

const ITCHIO_TAG_TAXONOMY = [
  "2d",
  "pixel-art",
  "sprites",
  "game-assets",
  "asset-pack",
  "16-bit",
  "8-bit",
  "retro",
  "tilemap",
  "rpg",
  "platformer",
  "characters",
  "creatures",
  "items",
  "icons",
  "ui",
  "fantasy",
  "sci-fi",
  "cute",
  "dark",
  "cozy",
  "indie",
]

export async function generatePackItchListing(
  packId: string,
  provider: AIProvider = "deepseek",
): Promise<ItchListingResult> {
  const pack = await getPackById(packId)
  if (!pack) return { success: false, packId, error: "Pack not found" }

  const guard = guardTextGen(provider, 2000)
  if (!guard.allowed) {
    return { success: false, packId, error: guard.error }
  }

  // Pull a few asset records so the AI knows what's actually inside.
  const sample = await Promise.all(pack.assets.slice(0, 6).map((id) => getAssetById(id)))
  const present = sample.filter((a): a is NonNullable<typeof a> => a !== null)
  const typeCounts = new Map<string, number>()
  for (const a of present) typeCounts.set(a.type, (typeCounts.get(a.type) ?? 0) + 1)
  const contents = [...typeCounts.entries()].map(([t, n]) => `${n} ${t}`).join(", ")
  const pixelSize = present[0]?.pixelSize ?? 64
  const style = present[0]?.style ?? "pixel-art"

  const prompt = `Generate an itch.io marketplace listing for a pixel-art game-asset pack. Return ONLY valid JSON, no markdown.

Pack: "${pack.title}"
Contents: ${pack.assets.length} sprites (${contents || "mixed asset types"})
Style: ${style}, ${pixelSize}px pixel art, transparent PNG, AI-assisted then post-processed
Description hint: ${pack.description}

JSON schema:
{
  "title": "<= 60 chars. Catchy, descriptive, includes the asset type and a hook. No emojis. No 'AI'. No 'best ever'.",
  "description": "Multi-paragraph plain-text description, suitable for the itch.io listing body. Open with a one-line hook. Then a 'What's inside' section with a bullet list (use '- ' prefix). Then a 'Specs' section (pixel size, transparent PNG, license summary). Close with an AI disclosure line.",
  "tags": ["<= 10 short lowercase tags. Pick from itch.io's common tags. Examples: pixel-art, sprites, asset-pack, 2d, rpg, characters, cute, retro, fantasy. NO spaces inside a tag; use hyphens. The first tag MUST be 'pixel-art'."],
  "suggestedPrice": <USD number, between 1.99 and 9.99, ending in .99>
}

Known good itch.io tag examples: ${ITCHIO_TAG_TAXONOMY.slice(0, 16).join(", ")}.`

  const result = await generateText({
    prompt,
    provider,
    temperature: 0.6,
    maxTokens: 1200,
  })

  logTextCost(provider, "itchio-listing", prompt, result.success ? result.text : "").catch(() => {})

  if (!result.success) {
    return { success: false, packId, error: result.error ?? "AI listing generation failed" }
  }

  // Strip any accidental markdown fences before parsing.
  const cleaned = result.text
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")

  let parsed: Partial<NonNullable<AssetPack["listing"]>>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return { success: false, packId, error: "AI returned non-JSON listing — try again" }
  }

  const listing: NonNullable<AssetPack["listing"]> = {
    title: typeof parsed.title === "string" ? parsed.title.slice(0, 80) : pack.title,
    description: typeof parsed.description === "string" ? parsed.description : pack.description,
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === "string").slice(0, 10)
      : ["pixel-art", "asset-pack", "sprites", "2d"],
    suggestedPrice:
      typeof parsed.suggestedPrice === "number" && parsed.suggestedPrice > 0
        ? Math.min(Math.max(parsed.suggestedPrice, 1.99), 19.99)
        : pack.price,
  }

  if (!listing.tags.includes("pixel-art")) {
    listing.tags = ["pixel-art", ...listing.tags].slice(0, 10)
  }

  await updatePackDeliverable(packId, { listing })

  return { success: true, packId, listing }
}

export async function markPackUploaded(packId: string, storeUrl: string): Promise<{ success: boolean; error?: string }> {
  if (!storeUrl || !/^https?:\/\//.test(storeUrl)) {
    return { success: false, error: "storeUrl must be an http(s) URL" }
  }
  await updatePackDeliverable(packId, { storeUrl, status: "approved" })
  return { success: true }
}
