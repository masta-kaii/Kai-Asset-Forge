import { NextRequest, NextResponse } from "next/server";
import { checkPushSecret } from "@/lib/apiAuth";
import {
  createRun,
  listRuns,
  type RunSource,
  type RunStatus,
  type RunStage,
} from "@/lib/runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "cache-control": "no-store" };

// GET /api/runs?limit=25&status=running&source=hermes
export async function GET(req: NextRequest): Promise<NextResponse> {
  const sp = req.nextUrl.searchParams;
  const limit = sp.get("limit") ? parseInt(sp.get("limit")!, 10) : undefined;
  const status = (sp.get("status") as RunStatus | null) || undefined;
  const source = (sp.get("source") as RunSource | null) || undefined;
  try {
    const runs = await listRuns({ limit, status, source });
    return NextResponse.json({ runs }, { headers: NO_STORE });
  } catch (e) {
    console.error("runs GET error:", e);
    return NextResponse.json({ runs: [] }, { headers: NO_STORE });
  }
}

// POST /api/runs  → create a run (used by the fleet / monitor)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = checkPushSecret(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const source = body.source as RunSource | undefined;
  const kind = body.kind as string | undefined;
  if (source !== "vercel" && source !== "hermes") {
    return NextResponse.json({ error: "source must be vercel|hermes" }, { status: 400 });
  }
  if (!kind || typeof kind !== "string") {
    return NextResponse.json({ error: "kind required" }, { status: 400 });
  }

  try {
    const id = await createRun({
      source,
      kind,
      theme: typeof body.theme === "string" ? body.theme : undefined,
      status: body.status as RunStatus | undefined,
      stage: typeof body.stage === "string" ? (body.stage as RunStage) : undefined,
      meta: (body.meta as Record<string, unknown>) || undefined,
      id: typeof body.id === "string" ? body.id : undefined,
    });
    return NextResponse.json({ id }, { headers: NO_STORE });
  } catch (e) {
    console.error("runs POST error:", e);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}
