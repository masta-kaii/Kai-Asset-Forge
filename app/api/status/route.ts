import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HermesSnapshot = {
  status: string;
  platform?: string;
  gateway_state?: string;
  platforms?: Record<string, { state: string } & Record<string, unknown>>;
  active_agents?: number;
  exit_reason?: string | null;
  updated_at?: string;
  pid?: number;
  [k: string]: unknown;
};

type Stored = HermesSnapshot & { receivedAt: string };

// Module-level cache. On Vercel this lives only as long as the warm instance,
// but the pusher hits every 60s so a cold start re-populates within one tick.
let latest: Stored | null = null;

function getSecret(): string | null {
  const s = process.env.STATUS_PUSH_SECRET;
  return s && s.length > 0 ? s : null;
}

function ageSecondsFrom(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

export async function POST(req: NextRequest) {
  const secret = getSecret();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "STATUS_PUSH_SECRET not configured" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: HermesSnapshot;
  try {
    body = (await req.json()) as HermesSnapshot;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!body || typeof body.status !== "string") {
    return NextResponse.json({ ok: false, error: "missing status" }, { status: 400 });
  }

  latest = { ...body, receivedAt: new Date().toISOString() };
  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (!latest) {
    return NextResponse.json(
      { latest: null, ageSeconds: null },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const ageSeconds = ageSecondsFrom(latest.receivedAt);
  return NextResponse.json(
    { latest, ageSeconds },
    { headers: { "cache-control": "no-store" } },
  );
}
