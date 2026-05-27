import { execSync } from 'child_process'
import { NextResponse } from 'next/server'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { agentId, message } = await request.json()
    if (!agentId || !message) {
      return NextResponse.json({ error: 'agentId and message required' }, { status: 400 })
    }

    // Pass through to Hermes agent chat
    const prompt = `[You are ${agentId.toUpperCase()} from the Kai Asset Forge factory. Respond in character. Be concise, direct, and stay in your role.\n\nUser: ${message}]`

    try {
      const out = execSync(`hermes chat "${prompt.replace(/"/g, '\\"')}" 2>&1`, {
        encoding: 'utf-8',
        timeout: 30000,
      })
      return NextResponse.json({ success: true, agentId, response: out.trim() })
    } catch (e: any) {
      // Fallback: canned response if Hermes isn't running
      const fallbacks: Record<string, string> = {
        popo: "🦀 *scuttles over* POPO here! I'm the factory director. What's on your mind, boss?",
        scout: "🔍 SCOUT HUB online! I'm scanning trends and hunting for asset inspiration. Need me to research something?",
        artist: "🎨 PIXEL STUDIO ready! Give me a theme and I'll forge you some pixels. Want a character, tile, or item?",
        webgen: "💻 WEB GENERATOR standing by! I build landing pages and components. What should I code up?",
        qc: "🔬 QC CHAMBER active! I validate every asset against 0x72 standards. Want me to review something?",
        pkg: "📦 PACKAGING BAY online! I bundle approved assets into export-ready packs. Ready to ship?",
      }
      return NextResponse.json({
        success: true,
        agentId,
        response: fallbacks[agentId] || `${agentId.toUpperCase()} here. (Hermes backend offline — canned response)`,
        fallback: true,
      })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
