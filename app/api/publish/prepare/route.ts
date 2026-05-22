import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { execSync } from "child_process"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * POST /api/publish/prepare
 *
 * Prepares a pack for publishing:
 * - Reads the pack JSON from the pipeline output
 * - Generates preview images
 * - Creates the release bundle (zip)
 * - Generates the listing description
 *
 * Accepts: { assetIds: string[], packName: string, type: "small_pack"|"tile_set"|"animated_pack", theme: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { assetIds, packName, type = "small_pack", theme } = body

    if (!assetIds?.length || !packName) {
      return NextResponse.json(
        { error: "Missing required: assetIds (array) and packName" },
        { status: 400 }
      )
    }

    const assetsDir = path.join(process.cwd(), "public", "generated-assets")
    const outputDir = path.join(process.cwd(), "public", "publish-ready", crypto.randomUUID())

    // Ensure directories exist
    await fs.mkdir(outputDir, { recursive: true })
    await fs.mkdir(path.join(outputDir, "sprites"), { recursive: true })
    await fs.mkdir(path.join(outputDir, "preview"), { recursive: true })

    // Copy all asset files into the pack
    const copiedAssets = []
    for (const assetId of assetIds) {
      const assetPath = path.join(assetsDir, `${assetId}.png`)
      try {
        await fs.access(assetPath)
        const destPath = path.join(outputDir, "sprites", `${assetId}.png`)
        await fs.copyFile(assetPath, destPath)
        copiedAssets.push({ id: assetId, path: `sprites/${assetId}.png` })
      } catch {
        console.warn(`[publish/prepare] Asset not found: ${assetId}`)
      }
    }

    if (copiedAssets.length === 0) {
      return NextResponse.json({ error: "No valid assets found to pack" }, { status: 404 })
    }

    // Create sprite sheet preview (using Python PIL)
    const spriteSheetPath = path.join(outputDir, "preview", "spritesheet.png")
    try {
      execSync(
        `python -c "
from PIL import Image
import sys, os, glob

sprite_dir = '${path.join(outputDir, "sprites").replace(/\\/g, "/")}'
output = '${spriteSheetPath.replace(/\\/g, "/")}'
# Get all png files
files = sorted([f for f in os.listdir(sprite_dir) if f.endswith('.png')])
if not files:
    sys.exit(0)
# Load first to get dimensions
first = Image.open(os.path.join(sprite_dir, files[0]))
sw, sh = first.size
cols = min(len(files), 8)
rows = (len(files) + cols - 1) // cols
canvas = Image.new('RGBA', (sw * cols + (cols - 1) * 4, sh * rows + (rows - 1) * 4), (50, 50, 50, 255))
for i, f in enumerate(files):
    img = Image.open(os.path.join(sprite_dir, f))
    x = (i % cols) * (sw + 4)
    y = (i // cols) * (sh + 4)
    canvas.paste(img, (x, y), img)
canvas.save(output)
" 2>&1`,
        { timeout: 30000 }
      )
    } catch (err) {
      console.warn("[publish/prepare] Sprite sheet generation skipped:", String(err))
    }

    // Generate listing description
    const publishConfig = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "publish-config.json"), "utf-8")
    )
    const template = publishConfig.description_templates[type] || publishConfig.description_templates.small_pack
    const description = template
      .replace(/\{count\}/g, String(copiedAssets.length))
      .replace(/\{theme\}/g, theme || packName)

    // Create metadata
    const metadata = {
      name: packName,
      type,
      assets: copiedAssets.length,
      spriteSheet: "preview/spritesheet.png",
      description,
      tags: publishConfig.default_tags,
      license: publishConfig.default_license,
      pricing: publishConfig.pricing[type] || 3.99,
      platforms: ["itch.io", "gumroad"],
      createdAt: new Date().toISOString(),
    }

    await fs.writeFile(
      path.join(outputDir, "pack.json"),
      JSON.stringify(metadata, null, 2)
    )

    console.log(`[publish/prepare] Pack '${packName}' ready at ${outputDir}`)
    console.log(`[publish/prepare] ${copiedAssets.length} assets bundled`)

    return NextResponse.json({
      success: true,
      packPath: outputDir.replace(path.join(process.cwd(), "public"), ""),
      metadata,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error"
    console.error("[publish/prepare] Error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
