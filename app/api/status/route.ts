import { NextRequest, NextResponse } from "next/server";

// ⚠️ Vercel serverless: each instance has its own memory.
// For single-instance use this works fine. For multi-region, use a DB.
let store: { data: Record<string, unknown>; ts: number } | null = null;

export async function GET(): Promise<NextResponse> {
  if (!store) {
    return NextResponse.json({ latest: null, ageSeconds: null });
  }
  return NextResponse.json({
    latest: store.data,
    ageSeconds: Math.floor((Date.now() - store.ts) / 1000),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.STATUS_PUSH_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    store = { data: body, ts: Date.now() };
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
