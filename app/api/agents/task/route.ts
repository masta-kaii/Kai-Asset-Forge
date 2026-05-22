import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { theme, count, platform } = body
    
    if (!theme) {
      return NextResponse.json({ error: "Missing theme" }, { status: 400 })
    }

    const taskId = `task-${Date.now()}`
    const taskContent = `# ${theme}
- **Asset Count**: ${count || 2}
- **Platform**: ${platform || "itch.io"}
- **Run ID**: ${taskId}
`
    const inboxPath = path.join(process.cwd(), ".memory/agent-bus/orchestrator/inbox")
    await fs.mkdir(inboxPath, { recursive: true })
    
    await fs.writeFile(path.join(inboxPath, `${taskId}.task.md`), taskContent, "utf-8")
    
    return NextResponse.json({ success: true, taskId })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
