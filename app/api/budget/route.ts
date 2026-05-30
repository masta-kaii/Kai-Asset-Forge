import { NextResponse } from "next/server";
import { budgetSummary } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/budget — month spend vs cap + today's throughput, for the HUD gauge.
export async function GET(): Promise<NextResponse> {
  try {
    const summary = await budgetSummary();
    return NextResponse.json(summary, { headers: { "cache-control": "no-store" } });
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
      { headers: { "cache-control": "no-store" } },
    );
  }
}
