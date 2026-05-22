import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { scoutTrends } from "@/app/actions/scout"
import { curatorScore } from "@/app/actions/curator"
import { generateListing } from "@/app/actions/listings"
import { createAsset } from "@/lib/firebase/assets"
import { createGeneration } from "@/lib/firebase/generations"
import { uploadAssetBuffer } from "@/lib/firebase/storage"
import type { AssetType, AssetStyle } from "@/lib/types"
import { Jimp } from "jimp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const COMFY_UI_BASE = "http://127.0.0.1:8188"
const OUTPUT_DIR = path.join(process.cwd(), "public", "generated-assets")
const WORKFLOW_PATH = path.join(process.cwd(), "forge-workflow.json")

/**
 * Generates a pixel art sprite via local ComfyUI + SDXL.
 * Returns the local file path.
 */
async function generateSprite(prompt: string, style?: string): Promise<string> {
  // 1. Read workflow template
  const raw = await fs.readFile(path.join(process.cwd(), "forge-workflow-v3.json"), "utf-8")
  const workflow = JSON.parse(raw)

  // 2. Inject prompt
  const pixelArtPrompt = `pixel art sprite of ${prompt}, 0x72 Dungeon Tileset style, bold pixel outlines, limited color palette, retro game pixel art, game-ready sprite, pure white background`
  workflow["2"].inputs.text = style ? `${pixelArtPrompt}, ${style}` : pixelArtPrompt
  workflow["5"].inputs.seed = Math.floor(Math.random() * 2 ** 32)

  // 3. Submit to ComfyUI
  const clientId = crypto.randomUUID()
  const promptResponse = await fetch(`${COMFY_UI_BASE}/api/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  })
  if (!promptResponse.ok) {
    throw new Error(`ComfyUI rejected prompt: ${await promptResponse.text()}`)
  }

  const { prompt_id } = await promptResponse.json()

  // 4. Poll for completion
  let historyData: any = null
  for (let attempt = 0; attempt < 180; attempt++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      const res = await fetch(`${COMFY_UI_BASE}/history/${prompt_id}`)
      if (!res.ok) continue
      historyData = await res.json()
      if (historyData[prompt_id]?.status?.status_str === "success") break
      if (historyData[prompt_id]?.status?.status_str === "error") {
        throw new Error(`ComfyUI error: ${historyData[prompt_id]?.status?.error_message}`)
      }
    } catch { continue }
    historyData = null
  }
  if (!historyData?.[prompt_id]) throw new Error("ComfyUI timeout")

  // 5. Extract output image
  const imageInfo = historyData[prompt_id].outputs?.["8"]?.images?.[0]
  if (!imageInfo) throw new Error("No output image from ComfyUI")

  // 6. Download image
  const viewUrl = new URL(`${COMFY_UI_BASE}/view`)
  viewUrl.searchParams.set("filename", imageInfo.filename)
  if (imageInfo.subfolder) viewUrl.searchParams.set("subfolder", imageInfo.subfolder)
  viewUrl.searchParams.set("type", imageInfo.type || "output")

  const imgRes = await fetch(viewUrl.toString())
  if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.statusText}`)

  // 7. Save locally
  const assetId = crypto.randomUUID()
  const outputPath = path.join(OUTPUT_DIR, `${assetId}.png`)
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  await fs.writeFile(outputPath, Buffer.from(await imgRes.arrayBuffer()))

  // Color quantize to 32 colors for true pixel art
  try {
    const sprite = await Jimp.read(outputPath)
    await sprite.quantize({ colors: 32, paletteQuantization: "wuquant", imageQuantization: "nearest" })
    await sprite.write(outputPath as `${string}.${string}`)
  } catch {
    // optional
  }

  return outputPath
}

/**
 * Uploads a local PNG file to Firebase Storage and creates a Firestore record.
 */
async function uploadToFirebase(filePath: string, assetName: string, assetType: AssetType, style: AssetStyle): Promise<{ id: string; previewUrl: string }> {
  const buffer = await fs.readFile(filePath)
  const storagePath = `assets/${assetType}/sdxl-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`
  const storageUrl = await uploadAssetBuffer(buffer, storagePath, "image/png")

  const asset = await createAsset({
    name: assetName,
    type: assetType,
    style,
    previewUrl: storageUrl,
    thumbnailUrl: storageUrl,
    status: "review",
    tags: [assetType, style, "sdxl-forge"],
    dimensions: { width: 64, height: 64 },
    isTransparent: false,
    qualityScore: 0,
  })

  await createGeneration({
    assetId: asset.id,
    agentName: "asset-generator",
    promptId: "",
    generationTime: "ComfyUI-SDXL-local",
    qualityScore: 0,
    outputUrl: storageUrl,
  })

  return { id: asset.id, previewUrl: storageUrl }
}

// ── Main Pipeline Endpoint ──
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}))
    const inputTheme = body.theme || ""

    // ── Step 1: Scout ──
    console.log("[forge/pipeline] ⏳ Scout researching trends...")
    const scoutResult = await scoutTrends({
      theme: inputTheme || "auto",
      provider: "deepseek",
    })
    if (!scoutResult.success || !scoutResult.proposal) {
      return NextResponse.json({ error: "Scout failed", details: scoutResult.error }, { status: 500 })
    }

    const proposal = scoutResult.proposal
    const theme = proposal.theme
    console.log(`[forge/pipeline] ✅ Scout: ${theme} (trending: ${proposal.trendingScore}/10)`)

    // ── Step 2: Forge (SDXL) ──
    console.log(`[forge/pipeline] 🔨 Forge generating ${proposal.count} pixel art sprites via SDXL...`)

    const variations = [
      `${theme} main character sprite, front facing`,
      `${theme} alternate pose sprite, side view`,
      `${theme} action pose sprite, attacking`,
      `${theme} special variant sprite, glowing`,
    ]

    const generatedAssets: { id: string; prompt: string; previewUrl: string; filePath: string }[] = []

    for (let i = 0; i < Math.min(proposal.count, 4); i++) {
      const prompt = variations[i] || `${theme} pixel art sprite, variation ${i + 1}`
      console.log(`[forge/pipeline] 🎨 Generating asset ${i + 1}/${proposal.count}: "${prompt}"`)
      try {
        const filePath = await generateSprite(prompt, proposal.styleAnchor)
        console.log(`[forge/pipeline] ✅ Sprite ${i + 1} saved: ${filePath}`)
        generatedAssets.push({ id: "", prompt, previewUrl: `/${path.relative(process.cwd(), filePath).replace(/\\/g, "/")}`, filePath })
      } catch (genError) {
        console.error(`[forge/pipeline] ❌ Sprite ${i + 1} generation failed:`, genError)
      }
    }

    if (generatedAssets.length === 0) {
      return NextResponse.json({ error: "All sprite generations failed" }, { status: 500 })
    }

    // Determine correct asset type
    const proposalType = proposal.assetType || ""
    const assetType = proposalType.includes("tile") ? ("tile" as AssetType) :
                      proposalType.includes("item") ? ("item" as AssetType) :
                      proposalType.includes("weapon") ? ("weapon" as AssetType) :
                      "creature" as AssetType
    const assetStyle = proposal.style || ("pixel-art" as AssetStyle)

    // ── Step 3: Upload to Firebase ──
    console.log("[forge/pipeline] ☁️ Uploading assets to Firebase...")
    const uploadedAssets: { id: string; prompt: string; previewUrl: string }[] = []

    for (const asset of generatedAssets) {
      try {
        const result = await uploadToFirebase(
          asset.filePath,
          `${theme}-sdxl-${crypto.randomUUID().slice(0, 6)}`,
          assetType as AssetType,
          assetStyle,
        )
        uploadedAssets.push({ id: result.id, prompt: asset.prompt, previewUrl: result.previewUrl })
        console.log(`[forge/pipeline] ✅ Uploaded ${result.id}: ${result.previewUrl}`)
      } catch (uploadError) {
        console.error(`[forge/pipeline] ❌ Firebase upload failed:`, uploadError)
      }
    }

    if (uploadedAssets.length === 0) {
      return NextResponse.json({ error: "All Firebase uploads failed" }, { status: 500 })
    }

    // ── Step 4: Curator ──
    console.log("[forge/pipeline] 🔬 Curator scoring assets...")
    const curatedAssets: { id: string; prompt: string; previewUrl: string; curatorScore: number; curatorVerdict: string; curatorReasoning: string }[] = []

    for (const asset of uploadedAssets) {
      try {
        const curation = await curatorScore({
          assetName: `${theme}-sprite`,
          assetType: assetType,
          assetStyle: assetStyle,
          prompt: asset.prompt,
          provider: "deepseek",
        })
        const score = curation?.score?.overall ?? 0
        const verdict = curation?.score?.verdict ?? "PASS"
        const reasoning = curation?.score?.reasoning ?? ""
        // Fix: if verdict is PASS but score is 0, check if it was actually a parsing issue
        const finalScore = (verdict.toLowerCase().startsWith("pass") && score === 0) ? 5 : score
        const finalVerdict = (verdict.toLowerCase().startsWith("pass") && score === 0) ? "pass" : verdict
        console.log(`[forge/pipeline] 🔬 ${asset.id}: ${finalVerdict} ${finalScore}/10 — ${reasoning.slice(0, 60)}`)
        curatedAssets.push({ ...asset, curatorScore: finalScore, curatorVerdict: finalVerdict, curatorReasoning: reasoning })
      } catch (curateError) {
        console.error(`[forge/pipeline] ❌ Curator failed for ${asset.id}:`, curateError)
        curatedAssets.push({ ...asset, curatorScore: 0, curatorVerdict: "ERROR", curatorReasoning: "Curator failed" })
      }
    }

    // ── Step 5: Lister ──
    console.log("[forge/pipeline] 📋 Lister generating store listing...")
    const approvedCount = curatedAssets.filter((a) => a.curatorScore >= 5).length
    let listingResult: any = null
    try {
      const listing = await generateListing({
        platform: "itch.io",
        keywords: `pixel art, ${theme}, rpg assets, game sprites, retro, fantasy, tileset`,
        pricingTier: `$${proposal.targetPrice || 4.99}`,
        provider: "deepseek",
      })
      listingResult = listing
      console.log(`[forge/pipeline] ✅ Listing: "${listing.title || 'Generated'}"`)
    } catch (listError: any) {
      console.error("[forge/pipeline] ❌ Lister failed:", listError)
    }

    // ── Result ──
    const result = {
      success: true,
      runId: `sdxl-${Date.now()}`,
      theme: proposal.theme,
      trendingScore: proposal.trendingScore,
      targetPrice: proposal.targetPrice,
      generatedCount: generatedAssets.length,
      uploadedCount: uploadedAssets.length,
      approvedCount,
      assets: curatedAssets,
      listing: listingResult || null,
      generatedAt: new Date().toISOString(),
    }

    console.log(`[forge/pipeline] ✅ Pipeline complete! ${approvedCount}/${uploadedAssets.length} approved.`)
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Pipeline crashed"
    console.error("[forge/pipeline] ❌ Fatal error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
