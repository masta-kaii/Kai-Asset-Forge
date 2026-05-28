import { NextRequest, NextResponse } from "next/server";

// In-memory store for the latest push (shared across same instance on Vercel)
let _latestData: Record<string, unknown> | null = null;
let _latestTimestamp: number | null = null;

export async function GET(): Promise<NextResponse> {
  if (_latestData === null || _latestTimestamp === null) {
    return NextResponse.json({ latest: null, ageSeconds: null });
  }
  const ageSeconds = Math.floor((Date.now() - _latestTimestamp) / 1000);
  return NextResponse.json({ latest: _latestData, ageSeconds });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.STATUS_PUSH_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
    if (token !== secret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  try {
    const body = await request.json();
    _latestData = body;
    _latestTimestamp = Date.now();
    return NextResponse.json({ ok: true, receivedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}
