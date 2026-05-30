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
