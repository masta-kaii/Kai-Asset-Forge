import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebaseAdmin";

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

const DOC_PATH = "status/hermes";

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

  const receivedAt = new Date().toISOString();
  await getDb().doc(DOC_PATH).set({
    snapshot: body,
    receivedAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const snap = await getDb().doc(DOC_PATH).get();
  if (!snap.exists) {
    return NextResponse.json(
      { latest: null, ageSeconds: null },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const data = snap.data() as
    | { snapshot: HermesSnapshot; receivedAt: string }
    | undefined;
  if (!data?.receivedAt || !data.snapshot) {
    return NextResponse.json(
      { latest: null, ageSeconds: null },
      { headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      latest: { ...data.snapshot, receivedAt: data.receivedAt },
      ageSeconds: ageSecondsFrom(data.receivedAt),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
