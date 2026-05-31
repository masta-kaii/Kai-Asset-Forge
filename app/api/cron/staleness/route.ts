import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { notify } from "@/lib/notify";
import { budgetSummary, failedRunsSince } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_DOC = "status/hermes";
const STATE_DOC = "alerts/state";
const HUB = process.env.APP_URL || "https://kai-asset-forge-hub.vercel.app";

function staleThreshold(): number {
  const v = parseInt(process.env.STALE_SECONDS || "600", 10);
  return Number.isFinite(v) && v > 0 ? v : 600;
}

// Vercel cron requests carry `Authorization: Bearer $CRON_SECRET` when the env
// var is set. Require it when present; otherwise run (best-effort) so the
// endpoint works before CRON_SECRET is configured.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

async function statusAge(): Promise<number | null> {
  try {
    const snap = await getDb().doc(STATUS_DOC).get();
    const recv = snap.exists ? (snap.get("receivedAt") as string | undefined) : undefined;
    if (!recv) return null;
    return Math.max(0, Math.round((Date.now() - new Date(recv).getTime()) / 1000));
  } catch {
    return null;
  }
}

// GET /api/cron/staleness — fires Telegram alerts for fleet silence, budget
// breach, and newly failed runs. De-duped via alerts/state so it won't spam.
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let db;
  try {
    db = getDb();
  } catch (e) {
    console.error("cron staleness: Firestore unavailable:", e);
    return NextResponse.json({ ok: false, error: "storage unavailable" }, { status: 200 });
  }

  const stateRef = db.doc(STATE_DOC);
  const state = (await stateRef.get().catch(() => null))?.data() || {};
  const wasStale = !!state.stale;
  const wasOverBudget = !!state.budget;
  // First run (no cursor yet): seed at "now" so we don't alert on the entire
  // history of past failures — only failures from here forward.
  const firstRun = !state.lastFailedAt;
  const nowIso = new Date().toISOString();
  const lastFailedAt: string = state.lastFailedAt || nowIso;

  const fired: string[] = [];
  const patch: Record<string, unknown> = { checkedAt: FieldValue.serverTimestamp() };

  // 1) Staleness — alert on transition into stale and on recovery.
  const age = await statusAge();
  const isStale = age == null || age > staleThreshold();
  if (isStale && !wasStale) {
    await notify(`🚨 *Hermes offline* — no heartbeat ${age == null ? "ever" : `for ${age}s`}.\nFactory is unmonitored.\n${HUB}/monitor`);
    fired.push("stale");
  } else if (!isStale && wasStale) {
    await notify(`✅ *Hermes back online* — heartbeat ${age}s ago.`, { silent: true });
    fired.push("recovered");
  }
  patch.stale = isStale;

  // 2) Budget — alert once when month spend reaches the cap.
  let summary;
  try {
    summary = await budgetSummary();
    const over = summary.month.usd >= summary.cap;
    if (over && !wasOverBudget) {
      await notify(`🚨 *Budget cap hit* — $${summary.month.usd.toFixed(2)} / $${summary.cap.toFixed(2)} this month (${summary.month.runs} runs).`);
      fired.push("budget");
    } else if (!over && wasOverBudget) {
      fired.push("budget-reset");
    }
    patch.budget = over;
  } catch {
    /* budget read failed — leave prior state */
  }

  // 3) New failed runs since last check. On the very first run we only seed
  // the cursor (no backlog spam); subsequent runs alert on genuinely new ones.
  try {
    if (firstRun) {
      patch.lastFailedAt = nowIso;
    } else {
      const failures = await failedRunsSince(lastFailedAt);
      for (const r of failures) {
        await notify(`⚠️ *Run failed* — ${r.theme || r.kind} (${r.source})\n${r.error || "no error message"}\n${HUB}/monitor`, { silent: true });
        fired.push(`fail:${r.id}`);
      }
      if (failures.length > 0) {
        patch.lastFailedAt = failures[failures.length - 1].finishedAt || nowIso;
      }
    }
  } catch {
    /* failure scan failed — leave cursor */
  }

  await stateRef.set(patch, { merge: true }).catch(() => {});

  return NextResponse.json(
    { ok: true, age, isStale, budget: summary?.pct ?? null, fired },
    { headers: { "cache-control": "no-store" } },
  );
}
