import { NextRequest, NextResponse } from "next/server"
import { scoutTrends } from "@/app/actions/scout"
import { curatorScore } from "@/app/actions/curator"
import { generateAssets } from "@/app/actions/generate"
import { generateListing } from "@/app/actions/listings"
import { runOrchestrator } from "@/app/actions/orchestrator"
import { autonomousTick } from "@/app/actions/autonomous-agent"
import { getDashboardData } from "@/app/actions/dashboard"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  const expected = process.env.AGENT_API_TOKEN
  if (!expected) return false
  return token === expected
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
): Promise<NextResponse> {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const action = (await params).action.join("/")
  const body = await req.json().catch(() => ({}))

  try {
    switch (action) {
      case "scout": {
        const result = await scoutTrends(body)
        return NextResponse.json(result)
      }
      case "curator": {
        const result = await curatorScore(body)
        return NextResponse.json(result)
      }
      case "generate": {
        const result = await generateAssets(body)
        return NextResponse.json(result)
      }
      case "listing": {
        const result = await generateListing(body)
        return NextResponse.json(result)
      }
      case "orchestrator": {
        const result = await runOrchestrator(body)
        return NextResponse.json(result)
      }
      case "health": {
        const result = await autonomousTick()
        return NextResponse.json(result)
      }
      case "dashboard": {
        const result = await getDashboardData()
        return NextResponse.json(result)
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
): Promise<NextResponse> {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const action = (await params).action.join("/")
  if (action === "health") {
    const result = await getDashboardData()
    return NextResponse.json(result)
  }
  return NextResponse.json({ error: "GET not supported for this action" }, { status: 405 })
}
