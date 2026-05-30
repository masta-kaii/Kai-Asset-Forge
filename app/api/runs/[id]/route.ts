import { NextRequest, NextResponse } from "next/server";
import { checkPushSecret } from "@/lib/apiAuth";
import { getRun, patchRun, type RunPatch } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "cache-control": "no-store" };

type Ctx = { params: Promise<{ id: string }> };

// GET /api/runs/:id  → run detail
export async function GET(_req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const run = await getRun(id);
    if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ run }, { headers: NO_STORE });
  } catch (e) {
    console.error("run GET error:", e);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}

// PATCH /api/runs/:id  → update run state (fleet / pipeline)
export async function PATCH(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const denied = checkPushSecret(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const { id } = await ctx.params;
  let body: RunPatch;
  try {
    body = (await req.json()) as RunPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await patchRun(id, body);
    const run = await getRun(id);
    return NextResponse.json({ run }, { headers: NO_STORE });
  } catch (e) {
    console.error("run PATCH error:", e);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}
