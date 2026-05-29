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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = getSecret();
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: HermesSnapshot;
  try {
    body = (await req.json()) as HermesSnapshot;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body.status !== "string") {
    return NextResponse.json({ error: "missing status" }, { status: 400 });
  }

  const receivedAt = new Date().toISOString();
  try {
    await getDb().doc(DOC_PATH).set({
      snapshot: body,
      receivedAt,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("status POST firestore error:", e);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, receivedAt });
}

export async function GET(): Promise<NextResponse> {
  try {
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
  } catch (e) {
    console.error("status GET firestore error:", e);
    return NextResponse.json(
      { latest: null, ageSeconds: null },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
