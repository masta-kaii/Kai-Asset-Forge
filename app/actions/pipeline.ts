"use server"

import { generateText } from "@/lib/ai/client"
import { generateImage } from "@/lib/ai/client"
import { createAsset, updateAssetStatus } from "@/lib/firebase/assets"
import { createGeneration } from "@/lib/firebase/generations"
import { createPack } from "@/lib/firebase/packs"
import { createWorkflow, updateWorkflowStatus } from "@/lib/firebase/workflows"
import { uploadAssetBuffer } from "@/lib/firebase/storage"
import type { AssetType, AssetStyle } from "@/lib/types"
import type { AIProvider } from "@/lib/ai/types"

interface PipelineResult {
  success: boolean
  steps: { step: string; status: "completed" | "failed"; summary: string }[]
  assetIds: string[]
  packId?: string
  error?: string
}

export async function runAutoForge(input: {
  theme?: string
  textProvider?: AIProvider
  imageProvider?: AIProvider
}): Promise<PipelineResult> {
  const steps: PipelineResult["steps"] = []
  const assetIds: string[] = []
  const textProvider = input.textProvider ?? "deepseek"
  const imageProvider = input.imageProvider ?? "gemini"
  const theme = input.theme ?? "fantasy creatures"

  try {
    // ── Step 1: Trend Research ──
    const trendWf = await createWorkflow({
      workflowType: "trend-research",
      status: "running",
      assignedAgent: "trend-researcher",
      input: { theme },
    })

    const trendText = await generateText({
      prompt: `Research trending game asset types in the "${theme}" category. List the top 3 most popular asset subtypes (e.g., dragons, slimes, goblins) and briefly explain why each is trending. Be concise.`,
      provider: textProvider,
      temperature: 0.7,
      maxTokens: 500,
    })

    if (!trendText.success) {
      await updateWorkflowStatus(trendWf.id, "failed")
      return { success: false, steps, assetIds, error: `Trend Research failed: ${trendText.error}` }
    }

    await updateWorkflowStatus(trendWf.id, "completed", new Date().toISOString())
    steps.push({ step: "Trend Research", status: "completed", summary: trendText.text.slice(0, 150) })

    // ── Step 2: Art Direction ──
    const artWf = await createWorkflow({
      workflowType: "art-direction",
      status: "running",
      assignedAgent: "art-director",
      input: { theme, trends: trendText.text },
    })

    const artText = await generateText({
      prompt: `Based on these trending asset types:\n${trendText.text}\n\nCreate an art direction brief for generating game assets. Specify: 1) Visual style (e.g. pixel art, cute retro), 2) Color palette, 3) Key features for each asset type, 4) Aspect ratio and composition. Be concise but specific.`,
      provider: textProvider,
      temperature: 0.8,
      maxTokens: 600,
    })

    if (!artText.success) {
      await updateWorkflowStatus(artWf.id, "failed")
      return { success: false, steps, assetIds, error: `Art Direction failed: ${artText.error}` }
    }

    await updateWorkflowStatus(artWf.id, "completed", new Date().toISOString())
    steps.push({ step: "Art Direction", status: "completed", summary: artText.text.slice(0, 150) })

    // ── Step 3: Asset Generation ──
    const genWf = await createWorkflow({
      workflowType: "asset-generation",
      status: "running",
      assignedAgent: "asset-generator",
      input: { theme, artDirection: artText.text },
    })

    const assetTypes: AssetType[] = ["creature", "item", "accessory"]
    const style: AssetStyle = theme.toLowerCase().includes("pixel") ? "pixel-art" : "pastel-cyber-fantasy"

    for (const assetType of assetTypes) {
      const prompt = `Based on this art direction:\n${artText.text}\n\nGenerate a ${assetType} asset in a consistent style. Make it game-ready, detailed, and visually appealing.`
      const imgResult = await generateImage({
        prompt,
        provider: imageProvider,
        n: 1,
        size: "1024x1024",
        quality: "auto",
      })

      if (!imgResult.success || imgResult.images.length === 0) continue

      for (const img of imgResult.images) {
        const name = `${assetType}-auto-${Date.now()}`
        let storageUrl = img.url
        try {
          const arrayBuffer = img.buffer ?? Buffer.from(
            await (await fetch(img.url)).arrayBuffer()
          )
          const path = `assets/${assetType}/auto-${Date.now()}.png`
          storageUrl = await uploadAssetBuffer(arrayBuffer, path, "image/png")
        } catch {
          // fallback to direct URL
        }

        const asset = await createAsset({
          name,
          type: assetType,
          style,
          previewUrl: storageUrl,
          thumbnailUrl: storageUrl,
          status: "review",
          tags: [assetType, style, "auto-forge"],
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

        assetIds.push(asset.id)
      }
    }

    await updateWorkflowStatus(genWf.id, "completed", new Date().toISOString())
    steps.push({ step: "Asset Generation", status: "completed", summary: `Generated ${assetIds.length} assets` })

    // ── Step 4: Quality Review ──
    const qaWf = await createWorkflow({
      workflowType: "quality-review",
      status: "running",
      assignedAgent: "quality-controller",
      input: { assetIds },
    })

    const qaText = await generateText({
      prompt: `Review ${assetIds.length} generated ${theme} game assets. Grade them A/B/C and suggest which 3 are market-ready. Be concise.`,
      provider: textProvider,
      temperature: 0.4,
      maxTokens: 400,
    })

    await updateWorkflowStatus(qaWf.id, "completed", new Date().toISOString())
    steps.push({ step: "Quality Review", status: "completed", summary: qaText.success ? qaText.text.slice(0, 120) : "Review skipped" })

    // Approve the generated assets
    for (const id of assetIds) {
      await updateAssetStatus(id, "approved").catch(() => {})
    }

    // ── Step 5: Packaging ──
    const packWf = await createWorkflow({
      workflowType: "packaging",
      status: "running",
      assignedAgent: "packager",
      input: { assetIds, theme },
    })

    const pack = await createPack({
      title: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Auto Pack`,
      description: `Auto-generated ${theme} asset pack featuring ${assetIds.length} game-ready assets.`,
      assets: assetIds,
      price: 4.99,
      status: "review",
      previewUrl: "",
    })

    await updateWorkflowStatus(packWf.id, "completed", new Date().toISOString())
    steps.push({ step: "Packaging", status: "completed", summary: `Pack "${pack.title}" created` })

    // ── Step 6: Store Listing ──
    const listingWf = await createWorkflow({
      workflowType: "store-listing",
      status: "running",
      assignedAgent: "store-lister",
      input: { packId: pack.id, theme },
    })

    const listingText = await generateText({
      prompt: `Generate a store listing for a game asset pack titled "${pack.title}". It contains ${assetIds.length} ${theme} assets priced at $${pack.price}. Return JSON: {"title":"...","description":"...","tags":["tag1","tag2"]}.`,
      provider: textProvider,
      temperature: 0.8,
      maxTokens: 500,
    })

    await updateWorkflowStatus(listingWf.id, "completed", new Date().toISOString())
    steps.push({
      step: "Store Listing",
      status: "completed",
      summary: listingText.success ? listingText.text.slice(0, 120) : "Listing skipped",
    })

    // ── Step 7: Marketing ──
    const marketingWf = await createWorkflow({
      workflowType: "marketing",
      status: "running",
      assignedAgent: "marketer",
      input: { packId: pack.id, theme },
    })

    const marketingText = await generateText({
      prompt: `Write 3 short social media posts promoting a game asset pack called "${pack.title}" with ${assetIds.length} ${theme} assets for $${pack.price}. Make each post engaging and platform-appropriate.`,
      provider: textProvider,
      temperature: 0.9,
      maxTokens: 500,
    })

    await updateWorkflowStatus(marketingWf.id, "completed", new Date().toISOString())
    steps.push({
      step: "Marketing",
      status: "completed",
      summary: marketingText.success ? marketingText.text.slice(0, 120) : "Marketing skipped",
    })

    return { success: true, steps, assetIds, packId: pack.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("AutoForge error:", message)
    return { success: false, steps, assetIds, error: message }
  }
}
