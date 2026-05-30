import { NextRequest } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";
import { listRuns, listRecentActivity, type ActivityEvent } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Cap the connection so it stays under serverless limits; the browser's
// EventSource reconnects automatically (and resumes via Last-Event-ID).
export const maxDuration = 30;

const STATUS_DOC = "status/hermes";
const TICK_MS = 2000;
const MAX_LIFETIME_MS = 25_000;

function sse(event: string, data: unknown, id?: string): string {
  const lines = [`event: ${event}`];
  if (id) lines.push(`id: ${id}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  return lines.join("\n") + "\n\n";
}

function ageSecondsFrom(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

async function readStatus(): Promise<{ latest: unknown; ageSeconds: number | null }> {
  try {
    const snap = await getDb().doc(STATUS_DOC).get();
    const data = snap.exists
      ? (snap.data() as { snapshot?: unknown; receivedAt?: string } | undefined)
      : undefined;
    if (!data?.receivedAt || data.snapshot === undefined) {
      return { latest: null, ageSeconds: null };
    }
    return {
      latest: { ...(data.snapshot as object), receivedAt: data.receivedAt },
      ageSeconds: ageSecondsFrom(data.receivedAt),
    };
  } catch {
    return { latest: null, ageSeconds: null };
  }
}

// GET /api/stream — Server-Sent Events: status, runs, and activity deltas.
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  // Resume point: the last activity timestamp the client already has.
  let cursor = req.headers.get("last-event-id") || undefined;
  const start = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };

      send(`retry: 3000\n\n`);
      send(`: connected\n\n`);

      try {
        while (!closed && Date.now() - start < MAX_LIFETIME_MS) {
          // 1) Hermes liveness (drives the staleness alarm client-side).
          send(sse("status", await readStatus()));

          // 2) Current runs (newest first).
          try {
            send(sse("runs", { runs: await listRuns({ limit: 20 }) }));
          } catch { /* index still building, etc. — keep streaming */ }

          // 3) Activity deltas since the cursor.
          try {
            const activity: ActivityEvent[] = await listRecentActivity(
              cursor ? { afterTs: cursor, limit: 100 } : { limit: 40 },
            );
            for (const ev of activity) {
              send(sse("activity", ev, ev.ts));
              if (!cursor || ev.ts > cursor) cursor = ev.ts;
            }
          } catch { /* collection-group index may still be building */ }

          send(`: ping\n\n`);
          await new Promise((r) => setTimeout(r, TICK_MS));
        }
      } catch {
        // fall through to close
      } finally {
        closed = true;
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
