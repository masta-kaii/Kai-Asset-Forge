import { NextRequest, NextResponse } from "next/server";
import { checkPushSecret } from "@/lib/apiAuth";
import { appendEvent, listEvents, type EventLevel, type RunStage } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "cache-control": "no-store" };

type Ctx = { params: Promise<{ id: string }> };

// GET /api/runs/:id/events?afterSeq=12&limit=200  → activity log (incremental)
export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const limit = sp.get("limit") ? parseInt(sp.get("limit")!, 10) : undefined;
  const afterSeq = sp.get("afterSeq") ? parseInt(sp.get("afterSeq")!, 10) : undefined;
  try {
    const events = await listEvents(id, { limit, afterSeq });
    return NextResponse.json({ events }, { headers: NO_STORE });
  } catch (e) {
    console.error("events GET error:", e);
    return NextResponse.json({ events: [] }, { headers: NO_STORE });
  }
}

// POST /api/runs/:id/events  → append an activity event (fleet / agents)
export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const denied = checkPushSecret(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  try {
    const seq = await appendEvent(id, {
      message: body.message,
      level: body.level as EventLevel | undefined,
      stage: body.stage as RunStage | undefined,
      agent: typeof body.agent === "string" ? body.agent : undefined,
      data: (body.data as Record<string, unknown>) || undefined,
    });
    return NextResponse.json({ seq }, { headers: NO_STORE });
  } catch (e) {
    console.error("events POST error:", e);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}
