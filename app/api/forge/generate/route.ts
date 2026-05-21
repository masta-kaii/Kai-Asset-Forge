import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"

// ComfyUI runs locally on :8188
const COMFY_UI_BASE = "http://127.0.0.1:8188"

// Generated assets are stored here
const OUTPUT_DIR = path.join(process.cwd(), "public", "generated-assets")

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * POST /api/forge/generate
 *
 * Accepts: { prompt: string, style?: string }
 * Calls ComfyUI at 127.0.0.1:8188, waits for generation,
 * downloads the result to public/generated-assets/{id}.png,
 * returns { url: string, assetId: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse request body
    const body = await req.json().catch(() => ({}))
    const { prompt, style } = body as { prompt?: string; style?: string }

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing required field: prompt (string)" },
        { status: 400 }
      )
    }

    // 2. Read the workflow template
    const workflowPath = path.join(process.cwd(), "forge-workflow.json")
    let workflow: Record<string, any>
    try {
      const raw = await fs.readFile(workflowPath, "utf-8")
      workflow = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: "Workflow template not found at forge-workflow.json" },
        { status: 500 }
      )
    }

    // 3. Inject the user prompt into the CLIPTextEncode node (node "2")
    const pixelArtPrompt = `pixel art sprite of ${prompt}, 0x72 Dungeon Tileset style, bold pixel outlines, limited color palette, retro game pixel art, fantasy pixel asset, game-ready sprite, 64x64 final size, pure white background`
    if (style) {
      workflow["2"].inputs.text = `${pixelArtPrompt}, ${style}`
    } else {
      workflow["2"].inputs.text = pixelArtPrompt
    }

    // 4. Set a random seed on the KSampler (node "5")
    workflow["5"].inputs.seed = Math.floor(Math.random() * 2 ** 32)

    // 5. Generate a unique asset ID
    const assetId = crypto.randomUUID()
    const clientId = crypto.randomUUID()

    // 6. Submit the prompt to ComfyUI
    const promptResponse = await fetch(`${COMFY_UI_BASE}/api/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: workflow,
        client_id: clientId,
      }),
    })

    if (!promptResponse.ok) {
      const errorBody = await promptResponse.text()
      return NextResponse.json(
        { error: `ComfyUI rejected prompt: ${errorBody}` },
        { status: 502 }
      )
    }

    const promptData = await promptResponse.json()
    const promptId: string = promptData.prompt_id
    console.log(`[forge/generate] Submitted prompt ${promptId}, waiting for completion...`)

    // 7. Poll ComfyUI history until the prompt completes
    const maxRetries = 180 // ~3 minutes at 1s intervals
    let historyData: any = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      try {
        const historyResponse = await fetch(
          `${COMFY_UI_BASE}/history/${promptId}`
        )
        if (!historyResponse.ok) continue

        historyData = await historyResponse.json()
        // historyData is keyed by prompt_id
        if (historyData[promptId] && historyData[promptId].status?.status_str === "success") {
          console.log(`[forge/generate] Prompt ${promptId} completed`)
          break
        }
        // Check if it errored
        if (historyData[promptId]?.status?.status_str === "error") {
          const errorMsg = historyData[promptId]?.status?.error_message || "Unknown error"
          return NextResponse.json(
            { error: `ComfyUI generation failed: ${errorMsg}` },
            { status: 502 }
          )
        }
      } catch {
        // Transient network error, keep polling
        continue
      }

      historyData = null
    }

    if (!historyData || !historyData[promptId]) {
      return NextResponse.json(
        { error: "ComfyUI did not complete generation within timeout" },
        { status: 504 }
      )
    }

    // 8. Extract the output image filename from the SaveImage node (node "8")
    const outputs = historyData[promptId].outputs
    const saveImageOutput = outputs?.["8"]
    if (!saveImageOutput?.images?.[0]) {
      return NextResponse.json(
        { error: "No output images found in ComfyUI response" },
        { status: 502 }
      )
    }

    const imageInfo = saveImageOutput.images[0]
    const { filename, subfolder, type } = imageInfo

    // 9. Download the image from ComfyUI
    const viewUrl = new URL(`${COMFY_UI_BASE}/view`)
    viewUrl.searchParams.set("filename", filename)
    if (subfolder) viewUrl.searchParams.set("subfolder", subfolder)
    viewUrl.searchParams.set("type", type || "output")
    // Prevent caching
    viewUrl.searchParams.set("rand", String(Math.random()))

    const imageResponse = await fetch(viewUrl.toString())
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to download generated image: ${imageResponse.statusText}` },
        { status: 502 }
      )
    }

    // 10. Save to public/generated-assets/{assetId}.png
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    const outputPath = path.join(OUTPUT_DIR, `${assetId}.png`)

    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true })
    await fs.writeFile(outputPath, imageBuffer)

    const assetUrl = `/generated-assets/${assetId}.png`

    console.log(`[forge/generate] Saved asset ${assetId}.png (${imageBuffer.length} bytes)`)

    // 11. Return success response
    return NextResponse.json({
      url: assetUrl,
      assetId,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error"
    console.error("[forge/generate] Error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
