"use server"

import { generateText } from "@/lib/ai/client"
import { generateImage } from "@/lib/ai/client"
import { createAsset, updateAssetStatus } from "@/lib/firebase/assets"
import { createGeneration } from "@/lib/firebase/generations"
import { createPack } from "@/lib/firebase/packs"
import { uploadAssetBuffer } from "@/lib/firebase/storage"
import { scoutTrends } from "@/app/actions/scout"
import { curatorScore } from "@/app/actions/curator"
import { publishPack } from "@/app/actions/marketplace"
import { runReflection } from "@/app/actions/reflection"
import type { AssetType, AssetStyle, AssetPack } from "@/lib/types"
import type { AIProvider } from "@/lib/ai/types"

interface StepResult {
  step: string
  status: "completed" | "failed"
  summary: string
  data?: Record<string, unknown>
  error?: string
}

// ── Step 1: Trend Research ──
export async function forgeStepTrend(input: {
  theme: string
  textProvider?: AIProvider
}): Promise<StepResult> {
  const provider = input.textProvider ?? "deepseek"
  try {
    const result = await generateText({
      prompt: `Research trending "${input.theme}" game asset types. List top 3 subtypes and why they're popular. Be concise.`,
      provider,
      temperature: 0.7,
      maxTokens: 200,
    })
    if (!result.success) return { step: "Trend Research", status: "failed", summary: "Text generation failed", error: result.error }
    return { step: "Trend Research", status: "completed", summary: result.text.slice(0, 120), data: { trends: result.text } }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    return { step: "Trend Research", status: "failed", summary: msg, error: msg }
  }
}

// ── Step 2: Art Direction ──
export async function forgeStepArtDirection(input: {
  theme: string
  trends: string
  textProvider?: AIProvider
}): Promise<StepResult> {
  const provider = input.textProvider ?? "deepseek"
  try {
    const result = await generateText({
      prompt: `Based on these trends: ${input.trends}\n\nCreate a one-paragraph art direction brief for "${input.theme}" game assets. Include style, color palette, and key features. Be specific.`,
      provider,
      temperature: 0.8,
      maxTokens: 200,
    })
    if (!result.success) return { step: "Art Direction", status: "failed", summary: "Text generation failed", error: result.error }
    return { step: "Art Direction", status: "completed", summary: result.text.slice(0, 120), data: { artDirection: result.text } }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    return { step: "Art Direction", status: "failed", summary: msg, error: msg }
  }
}

// ── Step 3: Asset Generation ──
export async function forgeStepGenerate(input: {
  artDirection: string
  assetType: AssetType
  style: AssetStyle
  imageProvider?: AIProvider
}): Promise<StepResult> {
  const provider = input.imageProvider ?? "openai"
  try {
    const prompt = `Art direction: ${input.artDirection}\n\nGenerate a ${input.assetType} game asset following this art direction. Game-ready, detailed, pixel art style.`
    const imgResult = await generateImage({ prompt, provider, n: 1, size: "1024x1024", quality: "auto" })

    if (!imgResult.success || imgResult.images.length === 0) {
      return { step: "Asset Generation", status: "failed", summary: "Image generation returned no results", error: imgResult.error }
    }

    const img = imgResult.images[0]
    const name = `${input.assetType}-forge-${Date.now()}`

    // Upload to Firebase Storage — data URLs are too large for Firestore
    let storageUrl = ""
    try {
      const rawBuffer = img.buffer ?? Buffer.from(await (await fetch(img.url)).arrayBuffer())
      const path = `assets/${input.assetType}/forge-${Date.now()}.png`
      storageUrl = await uploadAssetBuffer(rawBuffer, path, "image/png")
    } catch (uploadErr) {
      console.error("Pipeline storage upload failed:", uploadErr)
      return { step: "Asset Generation", status: "failed", summary: "Storage upload failed — check Firebase Storage rules", error: String(uploadErr) }
    }

    if (!storageUrl) {
      return { step: "Asset Generation", status: "failed", summary: "No storage URL", error: "Storage upload returned empty URL" }
    }

    const asset = await createAsset({
      name,
      type: input.assetType,
      style: input.style,
      previewUrl: storageUrl,
      thumbnailUrl: storageUrl,
      status: "review",
      tags: [input.assetType, input.style, "auto-forge"],
      dimensions: { width: img.width, height: img.height },
      isTransparent: false,
      qualityScore: 0,
    })
    await createGeneration({
      assetId: asset.id,
      agentName: "asset-generator",
      promptId: "",
      generationTime: "1",
      qualityScore: 0,
      outputUrl: storageUrl,
    })

    return { step: "Asset Generation", status: "completed", summary: `Generated ${name}`, data: { assetId: asset.id } }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed"
    return { step: "Asset Generation", status: "failed", summary: msg, error: msg }
  }
}

// ── Step 4: Finalize (approve, pack, listing, marketing) ──
export async function forgeStepFinalize(input: {
  assetIds: string[]
  theme: string
  textProvider?: AIProvider
}): Promise<StepResult> {
  const provider = input.textProvider ?? "deepseek"
  try {
    // Approve
    for (const id of input.assetIds) {
      await updateAssetStatus(id, "approved").catch(() => {})
    }

    // Create pack
    const packTitle = `${input.theme.charAt(0).toUpperCase() + input.theme.slice(1)} Forge Pack`
    const pack = await createPack({
      title: packTitle,
      description: `Auto-forged ${input.theme} asset pack with ${input.assetIds.length} game-ready assets.`,
      assets: input.assetIds,
      price: 3.99,
      status: "review",
      previewUrl: "",
    })

    // Generate listing
    const listingResult = await generateText({
      prompt: `Generate a quick store title and 4 tags for a game asset pack: "${packTitle}", ${input.assetIds.length} ${input.theme} assets, $${pack.price}. Return JSON: {"title":"...","tags":["..."]}. No markdown.`,
      provider,
      temperature: 0.8,
      maxTokens: 150,
    })

    // Auto-publish to marketplace
    let publishSummary = ""
    try {
      const pubResults = await publishPack(pack)
      const published = pubResults.filter((r) => r.success)
      if (published.length > 0) {
        publishSummary = ` | Published to ${published.map((r) => r.platform).join(", ")}`
      }
    } catch { /* marketplace optional */ }

    return {
      step: "Finalize",
      status: "completed",
      summary: `Pack "${packTitle}" ready — ${input.assetIds.length} assets, $${pack.price}${publishSummary}`,
      data: {
        packId: pack.id,
        packTitle,
        listing: listingResult.success ? listingResult.text : "",
        published: publishSummary.length > 0,
      },
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Finalize failed"
    return { step: "Finalize", status: "failed", summary: msg, error: msg }
  }
}

// ── Step 5: Scout (research trends for next batch) ──
export async function forgeStepScout(input: {
  theme: string
  textProvider?: AIProvider
}): Promise<StepResult> {
  try {
    const result = await scoutTrends({ theme: input.theme, provider: input.textProvider })
    if (!result.success || !result.proposal) return { step: "Scout", status: "failed", summary: "Trend research failed", error: result.error }
    return {
      step: "Scout",
      status: "completed",
      summary: `${result.proposal.theme} — ${result.proposal.rationale}`,
      data: { proposal: result.proposal },
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Scout failed"
    return { step: "Scout", status: "failed", summary: msg, error: msg }
  }
}

// ── Step 6: Curator (quality scoring) ──
export async function forgeStepCurate(input: {
  assetName: string
  assetType: string
  assetStyle: string
  prompt: string
  textProvider?: AIProvider
}): Promise<StepResult> {
  try {
    const result = await curatorScore({
      assetName: input.assetName,
      assetType: input.assetType,
      assetStyle: input.assetStyle,
      prompt: input.prompt,
      provider: input.textProvider,
    })
    if (!result.success || !result.score) return { step: "Curator", status: "failed", summary: "Quality scoring failed", error: result.error }
    return {
      step: "Curator",
      status: "completed",
      summary: `${result.score.verdict.toUpperCase()} — ${result.score.overall}/10 — ${result.score.reasoning}`,
      data: { score: result.score },
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Curator failed"
    return { step: "Curator", status: "failed", summary: msg, error: msg }
  }
}

// ── Step 7: Reflection (analyze ledger, update prompts) ──
export async function forgeStepReflect(input?: {
  textProvider?: AIProvider
}): Promise<StepResult> {
  try {
    const result = await runReflection({ provider: input?.textProvider })
    if (!result.success || !result.output) return { step: "Reflection", status: "failed", summary: "Reflection failed", error: result.error }
    return {
      step: "Reflection",
      status: "completed",
      summary: result.output.summary.slice(0, 150),
      data: { reflection: result.output },
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Reflection failed"
    return { step: "Reflection", status: "failed", summary: msg, error: msg }
  }
}
