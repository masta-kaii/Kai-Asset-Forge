import { NextRequest, NextResponse } from "next/server";
import { checkPushSecret } from "@/lib/apiAuth";
import { budgetSummary, recordSpend, type SpendReport } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "cache-control": "no-store" };

// GET /api/budget — month spend vs cap + today's throughput, for the HUD gauge.
export async function GET(): Promise<NextResponse> {
  try {
    const summary = await budgetSummary();
    return NextResponse.json(summary, { headers: NO_STORE });
  } catch (e) {
    console.error("budget GET error:", e);
    // Degrade gracefully — the HUD should still render with zeros.
    return NextResponse.json(
      {
        month: { usd: 0, tokens: 0, runs: 0, since: new Date().toISOString() },
        today: { total: 0, passed: 0, failed: 0 },
        cap: 10,
        pct: 0,
      },
      { headers: NO_STORE },
    );
  }
}

// POST /api/budget — report real spend into the monthly ledger. Push-secret
// gated. The home-PC Hermes agent reports here for ALL provider spend (LLM +
// image gen), whether or not it maps to a forge run. Either send an explicit
// `usd`, or `model` + `usage`/`images` and the hub derives USD from pricing.
//   { usd?, tokens?, usage?:{input,output}, images?, model?, provider?, note? }
export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = checkPushSecret(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  let body: SpendReport;
  try {
    body = (await req.json()) as SpendReport;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    body.usd == null &&
    body.tokens == null &&
    body.usage == null &&
    body.images == null
  ) {
    return NextResponse.json(
      { error: "Provide usd, tokens, usage, or images" },
      { status: 400 },
    );
  }

  try {
    const recorded = await recordSpend(body);
    return NextResponse.json({ ok: true, recorded }, { headers: NO_STORE });
  } catch (e) {
    console.error("budget POST error:", e);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}
