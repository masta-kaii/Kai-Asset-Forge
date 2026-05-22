import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { existsSync } from "fs"

export const dynamic = "force-dynamic"

interface AssetEntry {
  name: string
  category: string
  type: "spritesheet" | "frame" | "item"
  filename: string
  url: string
  width?: number
  height?: number
  siblingFrames?: { name: string; url: string }[]
}

/**
 * GET /api/forge/assets?category=characters|tiles|furniture|weapons|props|ui|creative|all
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || "all"
    const source = searchParams.get("source") || "enhanced" // or "aseprite"

    // Read from public/sprites/ so Vercel can serve them too
    const forgeDir = path.resolve(process.cwd(), "public", "sprites", source)
    
    // Debug: log what we're scanning  
    console.log(`[assets] Scanning: ${forgeDir}, exists: ${existsSync(forgeDir)}`)

    if (!existsSync(forgeDir)) {
      return NextResponse.json({ error: "No assets found", assets: [] })
    }

    // Categories mapping (flat files vs subdirs)
    const categories: Record<string, { dir?: string; pattern: string; label: string; icon: string }> = {
      characters: { pattern: "*spritesheet*", label: "Characters", icon: "🧟" },
      tiles: { dir: "tiles", pattern: "*.png", label: "Tiles", icon: "🧱" },
      furniture: { dir: "furniture", pattern: "*.png", label: "Furniture", icon: "🪑" },
      weapons: { dir: "weapons", pattern: "*.png", label: "Weapons & Gear", icon: "⚔️" },
      props: { dir: "props", pattern: "*.png", label: "Dungeon Props", icon: "🏚️" },
      ui: { dir: "ui", pattern: "*.png", label: "UI Elements", icon: "🖥️" },
      creative: { dir: "creative", pattern: "*.png", label: "Creative Art", icon: "✨" },
    }

    const assets: Record<string, AssetEntry[]> = {}
    let totalAssets = 0

    const catsToScan = category === "all" ? Object.keys(categories) : [category]

    for (const cat of catsToScan) {
      const catDef = categories[cat]
      if (!catDef) continue

      const scanDir = catDef.dir ? path.join(forgeDir, catDef.dir) : forgeDir
      if (!existsSync(scanDir)) continue

      const files = await fs.readdir(scanDir)
      
      // Filter by pattern
      const pattern = catDef.pattern.replace(/\*/g, ".*").replace(/\?/g, ".")
      const regex = new RegExp(`^${pattern}$`)
      
      const matching = files.filter(f => regex.test(f) && !f.startsWith("_"))
      assets[cat] = []

      // Group character spritesheets from flat files
      if (cat === "characters") {
        for (const file of matching) {
          const charName = file.replace("_spritesheet.png", "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
          const baseName = file.replace("_spritesheet.png", "")
          assets[cat].push({
            name: charName,
            category: cat,
            type: "spritesheet",
            filename: file,
            url: `/api/forge/assets/file?path=${encodeURIComponent(source + "/" + file)}`,
            siblingFrames: [
              { name: "Idle", url: `/api/forge/assets/file?path=${encodeURIComponent(source + "/" + baseName + "_idle_f0.png")}` },
              { name: "Walk", url: `/api/forge/assets/file?path=${encodeURIComponent(source + "/" + baseName + "_walk_f0.png")}` },
              { name: "Hit", url: `/api/forge/assets/file?path=${encodeURIComponent(source + "/" + baseName + "_hit_f0.png")}` },
            ],
          })
          totalAssets++
        }
      } else {
        // Subdir assets
        for (const file of matching) {
          const name = file.replace(".png", "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
          assets[cat].push({
            name,
            category: cat,
            type: "item",
            filename: file,
            url: `/api/forge/assets/file?path=${encodeURIComponent(source + "/" + catDef.dir + "/" + file)}`,
          })
          totalAssets++
        }
      }
    }

    return NextResponse.json({
      totalAssets,
      categories: Object.entries(categories).map(([id, def]) => ({
        id,
        label: def.label,
        icon: def.icon,
        count: (assets[id] || []).length,
      })),
      assets,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, assets: {} })
  }
}
