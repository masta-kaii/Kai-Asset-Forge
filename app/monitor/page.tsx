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
interface BudgetSummary {
  month: { usd: number; tokens: number; runs: number; since: string };
  today: { total: number; passed: number; failed: number; usd: number };
  cap: number;
  dailyCap: number;
  pct: number;
  dailyPct: number;
  blocked: boolean;
  blockReason: string | null;
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

  // ─── Run detail drawer (event replay via /api/runs/[id]) ───
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ run: Run; events: Activity[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);

  const openRun = useCallback(async (id: string) => {
    setSelected(id);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const [rRes, eRes] = await Promise.all([
        fetch(`/api/runs/${id}`),
        fetch(`/api/runs/${id}/events?limit=500`),
      ]);
      const run = rRes.ok ? ((await rRes.json()).run as Run) : null;
      if (!run) {
        // Run evicted / never existed — surface it instead of an empty drawer.
        setDetail(null);
        return;
      }
      const events = (eRes.ok ? (await eRes.json()).events || [] : []) as Activity[];
      setDetail({ run, events: events.map((e) => ({ ...e, runId: id })) });
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

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

  // Budget gauge + today's throughput (cheap aggregate; poll lightly).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/budget");
        const d = await r.json();
        if (alive) setBudget(d);
      } catch {}
    };
    load();
    const i = setInterval(load, 30000);
    return () => { alive = false; clearInterval(i); };
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

      {/* ── Kill-switch banner (budget cap reached → new work blocked) ── */}
      {budget?.blocked && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", background: "#f8717122", borderBottom: "1px solid #f87171", color: "#fca5a5", fontSize: 15, letterSpacing: 1 }}>
          🛑 PIPELINE HALTED — {budget.blockReason || "budget cap reached"}. New forge work is blocked until the budget resets.
        </div>
      )}

      {/* ── HUD metrics bar (budget gauges + throughput) ── */}
      {budget && (
        <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", padding: "10px 18px", borderBottom: "1px solid #1e2533", background: "#0b0e15" }}>
          <BudgetGauge label="MONTHLY" usd={budget.month.usd} cap={budget.cap} pct={budget.pct} />
          <BudgetGauge label="TODAY" usd={budget.today.usd} cap={budget.dailyCap} pct={budget.dailyPct} />
          <span style={{ display: "flex", gap: 18, fontSize: 14 }}>
            <Stat label="RUNS" value={budget.today.total} color="#94a3b8" />
            <Stat label="PASSED" value={budget.today.passed} color="#4ade80" />
            <Stat label="FAILED" value={budget.today.failed} color={budget.today.failed ? "#f87171" : "#475569"} />
            <Stat label="MO RUNS" value={budget.month.runs} color="#60a5fa" />
            <Stat label="TOKENS" value={budget.month.tokens} color="#c084fc" />
          </span>
        </div>
      )}

      {/* ── Headline live pipeline rail ── */}
      <div style={{ padding: "10px 18px 0", maxWidth: 1280, margin: "0 auto" }}>
        <SectionTitle>PIPELINE{activeRuns[0] ? ` · ${activeRuns[0].theme || activeRuns[0].kind}` : " · IDLE"}</SectionTitle>
        <PipelineRail run={activeRuns[0] || { id: "", source: "vercel", kind: "", status: "queued", stage: null, progress: 0, startedAt: "" }} />
      </div>

      {/* ── Run history strip ── */}
      {runs.length > 0 && (
        <div style={{ padding: "10px 18px 0", maxWidth: 1280, margin: "0 auto" }}>
          <SectionTitle>RUN HISTORY</SectionTitle>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {[...runs].reverse().map((r) => {
              const c = STATUS_COLOR[r.status];
              return (
                <div key={r.id} onClick={() => openRun(r.id)} title={`${r.theme || r.kind} · ${r.status} · ${ago(r.startedAt)}`}
                  style={{ width: 22, height: 22, background: `${c}22`, border: `1px solid ${c}`, borderRadius: 2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: c, fontSize: 11 }}>
                  {r.status === "running" ? "▶" : r.status === "passed" ? "✓" : r.status === "failed" ? "✕" : "·"}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
      {/* ── Run detail drawer ── */}
      {selected && (
        <RunDrawer
          runId={selected}
          detail={detail}
          loading={loadingDetail}
          onClose={() => { setSelected(null); setDetail(null); }}
        />
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );

  function RunCard({ run, compact }: { run: Run; compact?: boolean }) {
    const sc = STATUS_COLOR[run.status];
    const stageColor = run.stage ? AGENT_COLOR[run.stage === "forge" ? "artist" : run.stage === "list" || run.stage === "package" ? "pkg" : run.stage] || sc : sc;
    return (
      <div onClick={() => openRun(run.id)} title="Open run detail" style={{ background: "#0d1018", border: `1px solid ${sc}33`, borderLeft: `3px solid ${sc}`, borderRadius: 4, padding: "8px 10px", marginBottom: 8, cursor: "pointer", transition: "border-color .15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = sc; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${sc}33`; e.currentTarget.style.borderLeftColor = sc; }}>
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
function BudgetGauge({ label, usd, cap, pct }: { label: string; usd: number; cap: number; pct: number }) {
  const color = pct >= 100 ? "#f87171" : pct >= 80 ? "#f5a623" : "#4ade80";
  // Sub-dollar caps (e.g. the $0.33 daily) need cents to be legible.
  const fmt = (n: number) => (cap < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`);
  return (
    <div style={{ flex: "1 1 200px", minWidth: 180 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 3 }}>
        <span style={{ letterSpacing: 1 }}>{label} BUDGET</span>
        <span style={{ color }}>{fmt(usd)} / {fmt(cap)} · {pct}%</span>
      </div>
      <div style={{ height: 8, background: "#1e2533", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", transition: "width .4s", background: color }} />
      </div>
    </div>
  );
}
function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ color: "#64748b", fontSize: 13, letterSpacing: 2, marginBottom: 8, ...style }}>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#334155", fontSize: 14, padding: "8px 2px" }}>{children}</div>;
}

// ─── Pipeline rail: Scout → Forge → QC → Pack → List ─────────────────
const RAIL = [
  { key: "scout", label: "SCOUT", color: "#f59e0b" },
  { key: "forge", label: "FORGE", color: "#60a5fa" },
  { key: "qc", label: "QC", color: "#c084fc" },
  { key: "package", label: "PACK", color: "#4ade80" },
  { key: "list", label: "LIST", color: "#4ade80" },
];
const RAIL_INDEX: Record<string, number> = {
  scout: 0, forge: 1, rework: 1, qc: 2, package: 3, list: 4, done: 5,
};

function PipelineRail({ run }: { run: Run }) {
  const cur = run.stage ? RAIL_INDEX[run.stage] ?? 0 : 0;
  const passed = run.status === "passed";
  const failed = run.status === "failed";
  return (
    <div style={{ display: "flex", alignItems: "stretch", margin: "10px 0 4px" }}>
      {RAIL.map((s, i) => {
        let state: "done" | "active" | "pending" | "failed" = "pending";
        if (passed) state = "done";
        else if (i < cur) state = "done";
        else if (i === cur) state = failed ? "failed" : run.status === "running" ? "active" : "done";
        const col = state === "done" ? "#4ade80" : state === "active" ? "#f5a623" : state === "failed" ? "#f87171" : "#334155";
        return (
          <div key={s.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {i < RAIL.length - 1 && (
              <div style={{ position: "absolute", top: 13, left: "50%", width: "100%", height: 2, background: i < cur || passed ? "#4ade80" : "#1e2533" }} />
            )}
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${col}`, background: state === "active" ? "#f5a62322" : "#0d1018", color: col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, zIndex: 1, boxShadow: state === "active" ? `0 0 10px ${col}` : "none", animation: state === "active" ? "pulse 1.2s infinite" : "none" }}>
              {state === "done" ? "✓" : state === "failed" ? "✕" : i + 1}
            </div>
            <span style={{ color: col, fontSize: 12, marginTop: 4, letterSpacing: 1 }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Run detail drawer with full event replay ────────────────────────
function RunDrawer({ runId, detail, loading, onClose }: {
  runId: string;
  detail: { run: Run; events: Activity[] } | null;
  loading: boolean;
  onClose: () => void;
}) {
  const run = detail?.run;
  const events = detail?.events || [];
  const dur = run?.finishedAt && run.startedAt
    ? Math.max(0, Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))
    : null;
  const sc = run ? STATUS_COLOR[run.status] : "#94a3b8";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", height: "100%", background: "#0a0c12", borderLeft: "1px solid #1e2533", overflowY: "auto", padding: 18, fontFamily: "var(--font-vt323), monospace" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ color: "#e2e8f0", fontSize: 19, flex: 1 }}>{run?.theme || run?.kind || runId}</span>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #334155", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: "1px 9px", fontFamily: "inherit", borderRadius: 3 }}>✕</button>
        </div>

        {loading && <Empty>Loading run…</Empty>}
        {!loading && !run && <Empty>Run not found.</Empty>}

        {run && (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "#64748b", marginBottom: 4 }}>
              <span style={{ color: run.source === "hermes" ? "#22d3ee" : "#f5a623" }}>{run.source.toUpperCase()}</span>
              <span style={{ color: sc }}>{run.status.toUpperCase()}</span>
              {run.reworks ? <span style={{ color: "#f5a623" }}>{run.reworks} rework(s)</span> : null}
              {dur != null && <span>{dur}s</span>}
              <span>started {ago(run.startedAt)}</span>
            </div>

            <PipelineRail run={run} />
            {run.error && <div style={{ color: "#f87171", fontSize: 13, margin: "6px 0", padding: 8, background: "#f8717111", border: "1px solid #f8717133", borderRadius: 3 }}>{run.error}</div>}

            <SectionTitle style={{ marginTop: 16 }}>EVENT LOG · {events.length}</SectionTitle>
            <div style={{ background: "#0d1018", border: "1px solid #1e2533", borderRadius: 4, padding: 10, fontSize: 13, lineHeight: 1.55 }}>
              {events.length === 0 && <Empty>No events recorded.</Empty>}
              {events.map((ev) => (
                <div key={`${ev.runId}:${ev.seq}`} style={{ display: "flex", gap: 8, padding: "2px 0", borderBottom: "1px solid #141925" }}>
                  <span style={{ color: "#475569", minWidth: 30 }}>#{ev.seq}</span>
                  <span style={{ color: "#475569", minWidth: 62 }}>{new Date(ev.ts).toLocaleTimeString([], { hour12: false })}</span>
                  {ev.agent && <span style={{ color: AGENT_COLOR[ev.agent] || "#94a3b8", minWidth: 70, textTransform: "uppercase" }}>{ev.agent}</span>}
                  {ev.stage && <span style={{ color: "#475569", minWidth: 52 }}>{STAGE_LABEL[ev.stage] || ev.stage}</span>}
                  <span style={{ color: LEVEL_COLOR[ev.level], flex: 1 }}>{ev.message}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
