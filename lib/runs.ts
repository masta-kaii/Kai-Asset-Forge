import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebaseAdmin";

/**
 * Durable run + event store.
 *
 * The single source of truth for "what the factory did and is doing", shared
 * by both execution worlds:
 *   - the Vercel autonomous pipeline (/api/forge/autonomous)
 *   - the home-PC Hermes fleet (hermes/agent.js + monitor role)
 *
 * Firestore layout:
 *   runs/{runId}                  → RunDoc (current state of one production run)
 *   runs/{runId}/events/{eventId} → RunEvent (append-only activity log)
 *
 * Writes go through the admin SDK (bypassing security rules); the dashboard
 * reads via the /api/runs endpoints. This replaces the ephemeral /tmp logs
 * that Vercel wipes between invocations.
 */

export type RunSource = "vercel" | "hermes";
export type RunStatus = "queued" | "running" | "passed" | "failed" | "cancelled";
export type RunStage =
  | "scout"
  | "forge"
  | "qc"
  | "rework"
  | "package"
  | "list"
  | "done";

export type EventLevel = "info" | "success" | "warn" | "error";

export interface Artifact {
  name: string;
  kind?: string; // sprite | tileset | page | listing | ...
  url?: string; // durable URL (e.g. Vercel Blob) when available
  meta?: Record<string, unknown>;
}

export interface RunDoc {
  id: string;
  source: RunSource;
  kind: string; // "autonomous-pipeline" | "listing" | ...
  theme?: string;
  status: RunStatus;
  stage: RunStage | null;
  progress: number; // 0-100
  reworks: number;
  artifacts: Artifact[];
  cost: { tokens?: number; usd?: number };
  error: string | null;
  meta: Record<string, unknown>;
  startedAt: string; // ISO
  finishedAt: string | null; // ISO
  updatedAt?: string; // ISO (server-derived on read)
}

export interface RunEvent {
  seq: number;
  ts: string; // ISO
  stage?: RunStage;
  agent?: string; // popo | scout | artist | webgen | qc | pkg | ...
  level: EventLevel;
  message: string;
  data?: Record<string, unknown>;
}

const COLLECTION = "runs";
const SPEND = "spend"; // monthly standalone-spend ledger: spend/{YYYY-MM}

function newRunId(): string {
  // Lexically sortable by creation time, with a short random suffix.
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Drop undefined values — Firestore rejects them. */
function clean<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

export interface CreateRunInput {
  source: RunSource;
  kind: string;
  theme?: string;
  status?: RunStatus;
  stage?: RunStage | null;
  meta?: Record<string, unknown>;
  id?: string; // allow caller-supplied id (e.g. Hermes run_id) for idempotency
}

export async function createRun(input: CreateRunInput): Promise<string> {
  const id = input.id || newRunId();
  const now = new Date().toISOString();
  const doc: RunDoc = {
    id,
    source: input.source,
    kind: input.kind,
    theme: input.theme,
    status: input.status || "running",
    stage: input.stage ?? null,
    progress: 0,
    reworks: 0,
    artifacts: [],
    cost: {},
    error: null,
    meta: input.meta || {},
    startedAt: now,
    finishedAt: null,
  };
  await getDb()
    .collection(COLLECTION)
    .doc(id)
    .set({ ...clean(doc), updatedAt: FieldValue.serverTimestamp() });
  return id;
}

export type RunPatch = Partial<
  Pick<
    RunDoc,
    | "status"
    | "stage"
    | "progress"
    | "reworks"
    | "error"
    | "finishedAt"
    | "theme"
  >
> & {
  artifacts?: Artifact[]; // appended, not replaced
  costDelta?: { tokens?: number; usd?: number };
  meta?: Record<string, unknown>; // shallow-merged
};

export async function patchRun(id: string, patch: RunPatch): Promise<void> {
  const ref = getDb().collection(COLLECTION).doc(id);
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (patch.status !== undefined) update.status = patch.status;
  if (patch.stage !== undefined) update.stage = patch.stage;
  if (patch.progress !== undefined) update.progress = patch.progress;
  if (patch.reworks !== undefined) update.reworks = patch.reworks;
  if (patch.error !== undefined) update.error = patch.error;
  if (patch.finishedAt !== undefined) update.finishedAt = patch.finishedAt;
  if (patch.theme !== undefined) update.theme = patch.theme;

  if (patch.artifacts && patch.artifacts.length > 0) {
    update.artifacts = FieldValue.arrayUnion(...patch.artifacts);
  }
  if (patch.costDelta) {
    if (typeof patch.costDelta.tokens === "number")
      update["cost.tokens"] = FieldValue.increment(patch.costDelta.tokens);
    if (typeof patch.costDelta.usd === "number")
      update["cost.usd"] = FieldValue.increment(patch.costDelta.usd);
  }
  if (patch.meta) {
    for (const [k, v] of Object.entries(patch.meta)) {
      if (v !== undefined) update[`meta.${k}`] = v;
    }
  }

  await ref.update(update);
}

/** Mark a run terminal in one call. */
export async function finishRun(
  id: string,
  status: Extract<RunStatus, "passed" | "failed" | "cancelled">,
  error?: string,
): Promise<void> {
  await patchRun(id, {
    status,
    stage: "done",
    progress: 100,
    error: error ?? null,
    finishedAt: new Date().toISOString(),
  });
}

export interface AppendEventInput {
  stage?: RunStage;
  agent?: string;
  level?: EventLevel;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Append an event to a run's activity log. Uses a transaction to keep `seq`
 * monotonic and to bump the run's updatedAt so liveness/ordering stays sane.
 */
export async function appendEvent(
  runId: string,
  ev: AppendEventInput,
): Promise<number> {
  const db = getDb();
  const runRef = db.collection(COLLECTION).doc(runId);
  const eventsRef = runRef.collection("events");
  const eventRef = eventsRef.doc();

  const seq = await db.runTransaction(async (tx) => {
    const runSnap = await tx.get(runRef);
    const lastSeq = (runSnap.get("lastSeq") as number | undefined) ?? 0;
    const nextSeq = lastSeq + 1;
    const event: RunEvent = clean({
      seq: nextSeq,
      ts: new Date().toISOString(),
      stage: ev.stage,
      agent: ev.agent,
      level: ev.level || "info",
      message: ev.message,
      data: ev.data,
    });
    tx.set(eventRef, event);
    tx.set(
      runRef,
      { lastSeq: nextSeq, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return nextSeq;
  });

  return seq;
}

function toIso(v: unknown): string | undefined {
  if (!v) return undefined;
  // Firestore Timestamp has toDate(); ISO strings pass through.
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof v === "string") return v;
  return undefined;
}

export async function getRun(id: string): Promise<RunDoc | null> {
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as RunDoc & { updatedAt?: unknown };
  return { ...data, updatedAt: toIso(data.updatedAt) };
}

export interface ListRunsOptions {
  limit?: number;
  status?: RunStatus;
  source?: RunSource;
}

export async function listRuns(opts: ListRunsOptions = {}): Promise<RunDoc[]> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  let q = getDb()
    .collection(COLLECTION)
    .orderBy("startedAt", "desc") as FirebaseFirestore.Query;
  if (opts.status) q = q.where("status", "==", opts.status);
  if (opts.source) q = q.where("source", "==", opts.source);
  const snap = await q.limit(limit).get();
  return snap.docs.map((d) => {
    const data = d.data() as RunDoc & { updatedAt?: unknown };
    return { ...data, updatedAt: toIso(data.updatedAt) };
  });
}

export async function listEvents(
  runId: string,
  opts: { limit?: number; afterSeq?: number } = {},
): Promise<RunEvent[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  let q = getDb()
    .collection(COLLECTION)
    .doc(runId)
    .collection("events")
    .orderBy("seq", "asc") as FirebaseFirestore.Query;
  if (typeof opts.afterSeq === "number") q = q.where("seq", ">", opts.afterSeq);
  const snap = await q.limit(limit).get();
  return snap.docs.map((d) => d.data() as RunEvent);
}

export interface ActivityEvent extends RunEvent {
  runId: string;
}

/**
 * Cross-run activity feed via a collection-group query over all events.
 * Without a cursor: the newest `limit` events (returned oldest→newest so the
 * UI can append). With `afterTs`: only events newer than the cursor — the
 * delta the SSE stream pushes on each tick.
 *
 * Requires a COLLECTION_GROUP index on events.ts (see firestore.indexes.json
 * fieldOverrides).
 */
export async function listRecentActivity(
  opts: { afterTs?: string; limit?: number } = {},
): Promise<ActivityEvent[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const events = getDb().collectionGroup("events");

  let docs;
  if (opts.afterTs) {
    docs = (
      await events.where("ts", ">", opts.afterTs).orderBy("ts", "asc").limit(limit).get()
    ).docs;
  } else {
    // Newest first for the initial window, then flip to chronological.
    docs = (await events.orderBy("ts", "desc").limit(limit).get()).docs.reverse();
  }

  return docs.map((d) => {
    const ev = d.data() as RunEvent;
    const runId = d.ref.parent.parent?.id || "";
    return { ...ev, runId };
  });
}

// ─── Aggregates for the budget gauge + HUD (Phase 4) ─────────────────

export interface BudgetSummary {
  month: { usd: number; tokens: number; runs: number; since: string };
  today: { total: number; passed: number; failed: number; usd: number };
  cap: number; // monthly budget cap in USD
  dailyCap: number; // daily budget cap in USD (brain.md: $0.33/day)
  pct: number; // 0-100, month spend vs cap
  dailyPct: number; // 0-100, today spend vs daily cap
  blocked: boolean; // true when month OR day cap is reached (kill switch)
  blockReason: string | null;
}

/** Start of the current UTC month / day, as ISO strings. */
function periodStarts(): { monthIso: string; dayIso: string } {
  const now = new Date();
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { monthIso: month.toISOString(), dayIso: day.toISOString() };
}

export function monthlyCap(): number {
  const v = parseFloat(process.env.MONTHLY_BUDGET_USD || "10");
  return Number.isFinite(v) && v > 0 ? v : 10;
}

export function dailyCap(): number {
  const v = parseFloat(process.env.DAILY_BUDGET_USD || "0.33");
  return Number.isFinite(v) && v > 0 ? v : 0.33;
}

/**
 * Spend + throughput for the current month/day, summed from the run ledger.
 * Cost is fed by callers via patchRun({ costDelta }) — the deterministic
 * Vercel pipeline reports ~0; the Hermes fleet reports real LLM/image spend.
 */
export async function budgetSummary(): Promise<BudgetSummary> {
  const { monthIso, dayIso } = periodStarts();
  const cap = monthlyCap();
  const dCap = dailyCap();
  const snap = await getDb()
    .collection(COLLECTION)
    .where("startedAt", ">=", monthIso)
    .get();

  let usd = 0;
  let tokens = 0;
  let runs = 0;
  let dToday = 0;
  let pToday = 0;
  let fToday = 0;
  let usdToday = 0;

  snap.forEach((d) => {
    runs++;
    const cost = (d.get("cost") as { usd?: number; tokens?: number }) || {};
    usd += cost.usd || 0;
    tokens += cost.tokens || 0;
    const startedAt = (d.get("startedAt") as string) || "";
    if (startedAt >= dayIso) {
      dToday++;
      usdToday += cost.usd || 0;
      const status = d.get("status") as RunStatus;
      if (status === "passed") pToday++;
      else if (status === "failed") fToday++;
    }
  });

  // Fold in standalone spend reported by the home-PC agent (untied to runs),
  // for both the month and today.
  const [mSpend, dSpend] = await Promise.all([monthlySpend(), dailySpend()]);
  usd += mSpend.usd;
  tokens += mSpend.tokens;
  usdToday += dSpend.usd;

  const overMonth = cap > 0 && usd >= cap;
  const overDay = dCap > 0 && usdToday >= dCap;
  const blockReason = overMonth
    ? `monthly cap reached ($${usd.toFixed(2)} / $${cap.toFixed(2)})`
    : overDay
      ? `daily cap reached ($${usdToday.toFixed(2)} / $${dCap.toFixed(2)})`
      : null;

  return {
    month: { usd, tokens, runs, since: monthIso },
    today: { total: dToday, passed: pToday, failed: fToday, usd: usdToday },
    cap,
    dailyCap: dCap,
    pct: cap > 0 ? Math.min(100, Math.round((usd / cap) * 100)) : 0,
    dailyPct: dCap > 0 ? Math.min(100, Math.round((usdToday / dCap) * 100)) : 0,
    blocked: overMonth || overDay,
    blockReason,
  };
}

/** Budget gate for the kill switch: returns a reason string when new work
 *  must NOT start (cap reached), or null when spending is allowed. Fails OPEN
 *  on a storage error so a Firestore hiccup can't wedge the whole factory. */
export async function budgetGate(): Promise<string | null> {
  try {
    const s = await budgetSummary();
    return s.blocked ? s.blockReason : null;
  } catch {
    return null;
  }
}

// ─── Standalone spend ledger (Phase 4.1) ─────────────────────────────
//
// The in-repo pipeline is deterministic ($0); real money is spent by the
// home-PC Hermes agent (Claude / OpenAI / DeepSeek), much of it not tied to a
// forge run (Telegram chats, terminal work). Those reporters POST to
// /api/budget, which increments a per-month spend/{YYYY-MM} doc. budgetSummary()
// folds this into the gauge alongside run-attributed cost.

/** USD per 1M tokens, [input, output], by model. Estimates — reporters may
 *  send an explicit `usd` to bypass this entirely. Unknown models → 0. */
const TOKEN_PRICING: Record<string, [number, number]> = {
  "claude-opus-4": [15, 75],
  "claude-sonnet-4": [3, 15],
  "claude-haiku-4": [0.8, 4],
  "gpt-4o": [2.5, 10],
  "gpt-4o-mini": [0.15, 0.6],
  "deepseek-chat": [0.27, 1.1],
  "deepseek-reasoner": [0.55, 2.19],
};

/** Per-image USD for image models (point estimate; reporters may override). */
const IMAGE_PRICING: Record<string, number> = {
  "gpt-image-1": 0.04,
  "dall-e-3": 0.04,
};

/** Compute USD from token usage for a known model. Matches on prefix so
 *  dated IDs (claude-sonnet-4-20250514) resolve to their family. */
export function costFromUsage(
  model: string,
  usage: { input?: number; output?: number },
): number {
  const key = Object.keys(TOKEN_PRICING).find((k) => model.startsWith(k));
  if (!key) return 0;
  const [inRate, outRate] = TOKEN_PRICING[key];
  return ((usage.input || 0) * inRate + (usage.output || 0) * outRate) / 1_000_000;
}

export function costFromImages(model: string, count: number): number {
  const key = Object.keys(IMAGE_PRICING).find((k) => model.startsWith(k));
  return key ? IMAGE_PRICING[key] * Math.max(0, count) : 0;
}

export interface SpendReport {
  usd?: number; // explicit dollar amount — wins over derived
  tokens?: number;
  usage?: { input?: number; output?: number };
  images?: number;
  model?: string;
  provider?: string; // "anthropic" | "openai" | "deepseek" | …
  note?: string;
}

/** Resolve a report to a USD/token delta (without writing). Exposed for tests. */
export function resolveSpend(r: SpendReport): { usd: number; tokens: number } {
  let usd = r.usd ?? 0;
  if (r.usd == null && r.model) {
    if (r.usage) usd += costFromUsage(r.model, r.usage);
    if (r.images) usd += costFromImages(r.model, r.images);
  }
  const tokens =
    r.tokens ?? (r.usage ? (r.usage.input || 0) + (r.usage.output || 0) : 0);
  return { usd: Math.max(0, usd), tokens: Math.max(0, tokens) };
}

/** Record ad-hoc spend into the current month's AND day's ledgers (one doc
 *  each, keyed YYYY-MM / YYYY-MM-DD). Returns the delta. */
export async function recordSpend(
  r: SpendReport,
): Promise<{ usd: number; tokens: number; month: string; day: string }> {
  const { monthKey, dayKey } = periodKeys();
  const { usd, tokens } = resolveSpend(r);
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    usd: FieldValue.increment(usd),
    tokens: FieldValue.increment(tokens),
    reports: FieldValue.increment(1),
  };
  if (r.provider) update[`byProvider.${r.provider}`] = FieldValue.increment(usd);
  const col = getDb().collection(SPEND);
  await Promise.all([
    col.doc(monthKey).set(update, { merge: true }),
    col.doc(dayKey).set(update, { merge: true }),
  ]);
  return { usd, tokens, month: monthKey, day: dayKey };
}

/** Spend recorded against a SPEND doc id (month or day key). */
async function spendDoc(key: string): Promise<{ usd: number; tokens: number }> {
  const snap = await getDb().collection(SPEND).doc(key).get();
  if (!snap.exists) return { usd: 0, tokens: 0 };
  return {
    usd: (snap.get("usd") as number) || 0,
    tokens: (snap.get("tokens") as number) || 0,
  };
}

/** Current month's standalone (non-run) spend. */
async function monthlySpend(): Promise<{ usd: number; tokens: number }> {
  return spendDoc(periodKeys().monthKey);
}

/** Today's standalone (non-run) spend. */
async function dailySpend(): Promise<{ usd: number; tokens: number }> {
  return spendDoc(periodKeys().dayKey);
}

/** "YYYY-MM" / "YYYY-MM-DD" keys for the current UTC period. */
function periodKeys(): { monthKey: string; dayKey: string } {
  const iso = new Date().toISOString();
  return { monthKey: iso.slice(0, 7), dayKey: iso.slice(0, 10) };
}

/** Runs that entered a failed state since the given ISO cursor (for alerting).
 *  Bounded: filters status server-side and caps the result so a stuck cursor
 *  or a backlog can't turn each cron tick into an unbounded scan + alert storm. */
export async function failedRunsSince(
  sinceIso: string,
  max = 25,
): Promise<RunDoc[]> {
  const snap = await getDb()
    .collection(COLLECTION)
    .where("status", "==", "failed")
    .where("finishedAt", ">", sinceIso)
    .orderBy("finishedAt", "asc")
    .limit(max)
    .get();
  return snap.docs.map((d) => {
    const data = d.data() as RunDoc & { updatedAt?: unknown };
    return { ...data, updatedAt: toIso(data.updatedAt) };
  });
}
