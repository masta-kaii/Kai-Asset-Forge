import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const outboxPath = path.join(process.cwd(), ".memory/agent-bus/orchestrator/outbox")
    const inboxPath = path.join(process.cwd(), ".memory/agent-bus/orchestrator/inbox")
    
    await fs.mkdir(outboxPath, { recursive: true })
    await fs.mkdir(inboxPath, { recursive: true })

    const outboxFiles = await fs.readdir(outboxPath).catch(() => [])
    const inboxFiles = await fs.readdir(inboxPath).catch(() => [])
    
    const results = []
    
    // Parse results
    for (const file of outboxFiles) {
      if (file.endsWith(".result.json")) {
        const content = await fs.readFile(path.join(outboxPath, file), "utf-8")
        try {
          results.push(JSON.parse(content))
        } catch(e) {}
      }
    }

    // Determine current pipeline status
    const isBusy = inboxFiles.some(f => f.endsWith(".task.md"))
    
    let statusMd = ""
    try {
      statusMd = await fs.readFile(path.join(outboxPath, "status.md"), "utf-8")
    } catch(e) {}

    return NextResponse.json({ 
      success: true, 
      isBusy,
      pendingTasks: inboxFiles.filter(f => f.endsWith(".task.md")),
      results,
      statusMd
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
