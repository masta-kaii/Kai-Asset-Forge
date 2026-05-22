import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * POST /api/forge/dispatch
 * Triggers the full Scout→Forge→Curator→Packager→Lister pipeline
 * Body: { theme?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const theme = body.theme || "dungeon pixel art"

    const commands = [
      // Scout: Research trends
      `hermes kanban create --assignee scout --title "Scout: Research trending ${theme} themes" --profile scout`,
      // Forge: Generate assets (parent links to scout task)
      `sleep 2 && hermes kanban create --assignee forge --title "Forge: Create ${theme} sprites and tilesets" --profile forge`,
      // Curator: QC check
      `sleep 4 && hermes kanban create --assignee curator --title "Curator: QC review ${theme} assets" --profile curator`,
      // Packager: Bundle
      `sleep 6 && hermes kanban create --assignee packager --title "Packager: Bundle approved ${theme} assets into packs" --profile packager`,
      // Lister: Marketplace listing
      `sleep 8 && hermes kanban create --assignee lister --title "Lister: Create marketplace listings for ${theme} packs" --profile lister`,
    ]

    // Run all commands in background
    for (const cmd of commands) {
      execAsync(cmd, { timeout: 30000 }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      theme,
      pipeline: ["scout", "forge", "curator", "packager", "lister"],
      message: `Pipeline dispatched for "${theme}". Agents will pick up tasks automatically.`,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
