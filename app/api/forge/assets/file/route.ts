import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { existsSync } from "fs"

export const dynamic = "force-dynamic"

/**
 * GET /api/forge/assets/file?path=enhanced/dwarf_spritesheet.png
 * Serves forge-output files directly (security: only forge-output/)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get("path")

    if (!filePath) {
      return NextResponse.json({ error: "No path specified" }, { status: 400 })
    }

    // Security: only allow forge-output/
    const normalized = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "")
    if (!normalized.startsWith("enhanced") && !normalized.startsWith("aseprite")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const fullPath = path.join(process.cwd(), "forge-output", normalized)

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const buffer = await fs.readFile(fullPath)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
