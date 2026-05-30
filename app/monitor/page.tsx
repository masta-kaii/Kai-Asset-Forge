"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types (mirror lib/runs.ts shapes the stream emits) ──────────────
type RunStatus = "queued" | "running" | "passed" | "failed" | "cancelled";
interface Run {
  id: string;
  source: "vercel" | "hermes";
  kind: string;
  theme?: string;
  status: RunStatus;
  stage: string | null;
  progress: number;
  reworks?: number;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}
interface Activity {
  runId: string;
  seq: number;
  ts: string;
  stage?: string;
  agent?: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
}
interface StatusPayload {
  latest: ({ receivedAt?: string } & Record<string, unknown>) | null;
  ageSeconds: number | null;
}

// ─── Visual vocabulary ───────────────────────────────────────────────
const AGENT_COLOR: Record<string, string> = {
  popo: "#f5a623", scout: "#f59e0b", artist: "#60a5fa",
  webgen: "#22d3ee", qc: "#c084fc", pkg: "#4ade80",
  orchestrator: "#f5a623", lister: "#4ade80", monitor: "#94a3b8",
};
const LEVEL_COLOR: Record<Activity["level"], string> = {
  info: "#94a3b8", success: "#4ade80", warn: "#f5a623", error: "#f87171",
};
const STAGE_LABEL: Record<string, string> = {
  scout: "SCOUT", forge: "FORGE", qc: "QC", rework: "REWORK",
  package: "PACK", list: "LIST", done: "DONE",
};
const STATUS_COLOR: Record<RunStatus, string> = {
  running: "#60a5fa", passed: "#4ade80", failed: "#f87171",
  queued: "#94a3b8", cancelled: "#64748b",
};

type Health = "online" | "stale" | "offline" | "scanning";
function healthOf(age: number | null): Health {
  if (age == null) return "offline";
  if (age < 90) return "online";
  if (age < 300) return "stale";
  return "offline";
}
const HEALTH = {
  online: { color: "#4ade80", label: "HERMES ONLINE" },
  stale: { color: "#f5a623", label: "HERMES STALE" },
  offline: { color: "#f87171", label: "HERMES OFFLINE" },
  scanning: { color: "#94a3b8", label: "CONNECTING…" },
};

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function MonitorPage() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<StatusPayload>({ latest: null, ageSeconds: null });
  const [runs, setRuns] = useState<Run[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [now, setNow] = useState(Date.now());
  const feedRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());
  const font = "var(--font-vt323), monospace";

  // Auth guard — same convention as the other pages.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("kaf_auth");
      if (!raw) { router.replace("/login"); return; }
      const d = JSON.parse(raw);
      if (!d.user || !d.ts || Date.now() - d.ts > 7 * 24 * 60 * 60 * 1000) {
        router.replace("/login");
      }
    } catch { router.replace("/login"); }
  }, [router]);

  // Tick for relative timestamps + age countup between status pushes.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ─── SSE connection ───
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource auto-reconnects

    es.addEventListener("status", (e) => {
      try { setStatus(JSON.parse((e as MessageEvent).data)); } catch {}
    });
    es.addEventListener("runs", (e) => {
      try { setRuns(JSON.parse((e as MessageEvent).data).runs || []); } catch {}
    });
    es.addEventListener("activity", (e) => {
      try {
        const ev = JSON.parse((e as MessageEvent).data) as Activity;
        const key = `${ev.runId}:${ev.seq}`;
        if (seen.current.has(key)) return;
        seen.current.add(key);
        setActivity((prev) => [...prev, ev].slice(-300));
      } catch {}
    });
    return () => es.close();
  }, []);

  // Auto-scroll the feed to the newest entry.
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [activity]);

  // Live age: count up from the last heartbeat so the alarm escalates on its
  // own between status pushes. Falls back to the server-computed ageSeconds.
  const liveAge = useCallback((): number | null => {
    const recv = status.latest?.receivedAt as string | undefined;
    if (recv) return Math.max(0, Math.round((now - new Date(recv).getTime()) / 1000));
    return status.ageSeconds;
  }, [status, now]);

  const age = liveAge();
  const health = status.ageSeconds == null && !connected ? "scanning" : healthOf(age ?? null);
  const h = HEALTH[health];

  const activeRuns = runs.filter((r) => r.status === "running");
  const recentDone = runs.filter((r) => r.status !== "running").slice(0, 12);
  const failedCount = runs.filter((r) => r.status === "failed").length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0c12", color: "#e2e8f0", fontFamily: font, padding: "0 0 40px" }}>
      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid #1e2533", background: "#0d1018", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#f5a623", fontSize: 22, letterSpacing: 3 }}>✦ LIVE MONITOR</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: connected ? "#4ade80" : "#f5a623" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#4ade80" : "#f5a623", boxShadow: connected ? "0 0 8px #4ade80" : "none", animation: connected ? "none" : "pulse 1s infinite" }} />
            {connected ? "STREAM LIVE" : "RECONNECTING…"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip label="🏭 FACTORY" color="#f5a623" onClick={() => router.push("/factory")} />
          <Chip label="🏯 DOJO" color="#c084fc" onClick={() => router.push("/dojo")} />
          <Chip label="📦 LIBRARY" color="#60a5fa" onClick={() => router.push("/library")} />
        </div>
      </div>

      {/* ── Staleness banner ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", background: `${h.color}14`, borderBottom: `1px solid ${h.color}44` }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: h.color, boxShadow: `0 0 12px ${h.color}` }} />
        <span style={{ color: h.color, fontSize: 18, letterSpacing: 2 }}>{h.label}</span>
        <span style={{ color: "#64748b", fontSize: 14 }}>
          {age == null ? "no heartbeat received" : `last heartbeat ${age}s ago`}
          {status.latest?.active_agents != null ? ` · ${String(status.latest.active_agents)} agents` : ""}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 14 }}>
          <Stat label="ACTIVE" value={activeRuns.length} color="#60a5fa" />
          <Stat label="FAILED" value={failedCount} color={failedCount ? "#f87171" : "#475569"} />
          <Stat label="RUNS" value={runs.length} color="#94a3b8" />
        </span>
      </div>

      {/* ── Body: runs rail + activity feed ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.4fr)", gap: 16, padding: 16, maxWidth: 1280, margin: "0 auto" }}>
        {/* Runs */}
        <section>
          <SectionTitle>ACTIVE RUNS</SectionTitle>
          {activeRuns.length === 0 && <Empty>No runs in flight.</Empty>}
          {activeRuns.map((r) => <RunCard key={r.id} run={r} />)}

          <SectionTitle style={{ marginTop: 22 }}>RECENT</SectionTitle>
          {recentDone.length === 0 && <Empty>Nothing finished yet.</Empty>}
          {recentDone.map((r) => <RunCard key={r.id} run={r} compact />)}
        </section>

        {/* Activity feed */}
        <section>
          <SectionTitle>ACTIVITY FEED</SectionTitle>
          <div ref={feedRef} style={{ background: "#0d1018", border: "1px solid #1e2533", borderRadius: 4, height: "calc(100vh - 220px)", overflowY: "auto", padding: 10, fontSize: 14, lineHeight: 1.5 }}>
            {activity.length === 0 && <Empty>Waiting for events…</Empty>}
            {activity.map((ev) => (
              <div key={`${ev.runId}:${ev.seq}`} style={{ display: "flex", gap: 8, padding: "2px 0", borderBottom: "1px solid #141925" }}>
                <span style={{ color: "#475569", minWidth: 64 }}>{new Date(ev.ts).toLocaleTimeString([], { hour12: false })}</span>
                {ev.agent && <span style={{ color: AGENT_COLOR[ev.agent] || "#94a3b8", minWidth: 78, textTransform: "uppercase" }}>{ev.agent}</span>}
                {ev.stage && <span style={{ color: "#475569", minWidth: 56 }}>{STAGE_LABEL[ev.stage] || ev.stage}</span>}
                <span style={{ color: LEVEL_COLOR[ev.level], flex: 1 }}>{ev.message}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );

  function RunCard({ run, compact }: { run: Run; compact?: boolean }) {
    const sc = STATUS_COLOR[run.status];
    const stageColor = run.stage ? AGENT_COLOR[run.stage === "forge" ? "artist" : run.stage === "list" || run.stage === "package" ? "pkg" : run.stage] || sc : sc;
    return (
      <div style={{ background: "#0d1018", border: `1px solid ${sc}33`, borderLeft: `3px solid ${sc}`, borderRadius: 4, padding: "8px 10px", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#e2e8f0", fontSize: 15, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {run.theme || run.kind}
          </span>
          <span style={{ color: run.source === "hermes" ? "#22d3ee" : "#f5a623", fontSize: 11, opacity: 0.8 }}>{run.source.toUpperCase()}</span>
          <span style={{ color: sc, fontSize: 12 }}>{run.status.toUpperCase()}</span>
        </div>
        {!compact && run.status === "running" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", margin: "4px 0 2px" }}>
              <span style={{ color: stageColor }}>{run.stage ? STAGE_LABEL[run.stage] || run.stage : "—"}{run.reworks ? ` · rework ${run.reworks}` : ""}</span>
              <span>{run.progress}%</span>
            </div>
            <div style={{ height: 5, background: "#1e2533", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${run.progress}%`, height: "100%", background: stageColor, transition: "width .4s" }} />
            </div>
          </>
        )}
        {compact && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {run.error ? <span style={{ color: "#f87171" }}>{run.error}</span> : `${ago(run.finishedAt || run.startedAt)}`}
          </div>
        )}
      </div>
    );
  }
}

function Chip({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: "#191d28", border: `1px solid ${color}33`, color, fontSize: 12, letterSpacing: 1, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", borderRadius: 3 }}>
      {label}
    </button>
  );
}
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
      <span style={{ color, fontSize: 18 }}>{value}</span>
      <span style={{ color: "#475569", fontSize: 10, letterSpacing: 1 }}>{label}</span>
    </span>
  );
}
function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ color: "#64748b", fontSize: 13, letterSpacing: 2, marginBottom: 8, ...style }}>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#334155", fontSize: 14, padding: "8px 2px" }}>{children}</div>;
}
