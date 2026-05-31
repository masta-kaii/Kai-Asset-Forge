const fs = require("fs")
const path = require("path")

const ROLE = process.env.ROLE || "orchestrator"
const API_BASE = process.env.KAI_API_BASE || "https://kai-asset-forge-hub.vercel.app"
const API_TOKEN = process.env.KAI_API_TOKEN || ""
const POLL_SECONDS = parseInt(process.env.POLL_SECONDS || "10", 10)
const HEARTBEAT_MINUTES = parseInt(process.env.HEARTBEAT_MINUTES || "30", 10)

// Telemetry → durable runs store + status snapshot on the Vercel hub.
// These endpoints authenticate with STATUS_PUSH_SECRET (the same secret the
// PC-side status pusher already holds), not the /api/agents bearer.
const STATUS_PUSH_SECRET = process.env.STATUS_PUSH_SECRET || ""
// Monitor role: how often to push a fleet health snapshot (runbook: ~5 min).
const MONITOR_MINUTES = parseInt(process.env.MONITOR_MINUTES || "5", 10)

const projectRoot = path.resolve(__dirname, "..")
const conf = {
  orchestrator: {
    inbox: path.join(projectRoot, ".memory/agent-bus/orchestrator/inbox"),
    outbox: path.join(projectRoot, ".memory/agent-bus/orchestrator/outbox"),
    archive: path.join(projectRoot, ".memory/agent-bus/orchestrator/archive"),
    endpoint: "/api/agents/orchestrator",
    method: "POST",
  },
  lister: {
    inbox: path.join(projectRoot, ".memory/agent-bus/sales/inbox"),
    outbox: path.join(projectRoot, ".memory/agent-bus/sales/outbox"),
    archive: path.join(projectRoot, ".memory/agent-bus/sales/archive"),
    endpoint: "/api/agents/listing",
    method: "POST",
  },
  // The monitor does not process inbox tasks; it polls fleet health and pushes
  // a snapshot to the hub so the dashboard can show liveness/staleness.
  monitor: {
    inbox: path.join(projectRoot, ".memory/agent-bus/ops/inbox"),
    outbox: path.join(projectRoot, ".memory/agent-bus/ops/outbox"),
    archive: path.join(projectRoot, ".memory/agent-bus/ops/archive"),
    endpoint: null,
    method: null,
  },
}

const cfg = conf[ROLE]
if (!cfg) {
  console.error(`Unknown ROLE: ${ROLE}. Use orchestrator, lister, or monitor.`)
  process.exit(1)
}

// Maps fleet role → the pipeline stage it represents in the runs store.
const ROLE_STAGE = { orchestrator: "forge", lister: "list", monitor: "done" }

function ensureDirs() {
  for (const d of [cfg.inbox, cfg.outbox, cfg.archive]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  }
}

function log(...args) {
  const ts = new Date().toISOString()
  console.log(`[${ts}] [${ROLE}]`, ...args)
}

async function apiFetch(endpoint, body = null) {
  const url = `${API_BASE}${endpoint}`
  const opts = {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
  }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(url, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`)
  return data
}

// ─── Telemetry to the durable runs store (best-effort) ──────────────
// Authenticates with STATUS_PUSH_SECRET. Never throws: monitoring must not
// take down task processing. Returns null on any failure.
async function hubFetch(endpoint, method, body) {
  try {
    const opts = { method, headers: { "Content-Type": "application/json" } }
    if (STATUS_PUSH_SECRET) opts.headers.Authorization = `Bearer ${STATUS_PUSH_SECRET}`
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${API_BASE}${endpoint}`, opts)
    if (!res.ok) {
      log(`telemetry ${method} ${endpoint} → HTTP ${res.status}`)
      return null
    }
    return await res.json().catch(() => ({}))
  } catch (err) {
    log(`telemetry ${method} ${endpoint} failed: ${err.message}`)
    return null
  }
}

async function createRunRemote(theme) {
  const data = await hubFetch("/api/runs", "POST", {
    source: "hermes",
    kind: ROLE,
    theme,
    status: "running",
    stage: ROLE_STAGE[ROLE] || null,
    meta: { role: ROLE },
  })
  return data && data.id ? data.id : null
}

async function emitRemote(runId, level, message, data) {
  if (!runId) return
  await hubFetch(`/api/runs/${runId}/events`, "POST", {
    level,
    agent: ROLE,
    stage: ROLE_STAGE[ROLE] || undefined,
    message,
    data,
  })
}

async function finishRunRemote(runId, status, error) {
  if (!runId) return
  await hubFetch(`/api/runs/${runId}`, "PATCH", {
    status,
    stage: "done",
    progress: 100,
    error: error || null,
    finishedAt: new Date().toISOString(),
  })
}

// Forward provider spend to the budget ledger when the hub result carries it.
// Accepts either an explicit { usd } or { model, usage:{input,output}, images }
// that the hub prices server-side. Best-effort; never throws.
async function reportSpendRemote(result) {
  if (!result || typeof result !== "object") return
  const c = result.cost || result.usage || result.spend
  if (!c && result.usd == null && result.tokens == null) return
  const report = {
    usd: result.usd ?? result.cost?.usd,
    tokens: result.tokens ?? result.cost?.tokens,
    usage: result.usage || result.cost?.usage,
    images: result.images ?? result.cost?.images,
    model: result.model || result.cost?.model,
    provider: result.provider || result.cost?.provider,
    note: `${ROLE} task`,
  }
  if (
    report.usd == null && report.tokens == null &&
    report.usage == null && report.images == null
  ) return
  const r = await hubFetch("/api/budget", "POST", report)
  if (r && r.recorded) log(`Spend reported: $${(r.recorded.usd || 0).toFixed(4)}`)
}

function parseTaskFile(filepath) {
  const raw = fs.readFileSync(filepath, "utf8")
  const out = {}

  const kvRe = /^[-*]\s+\*\*(.+?)\*\*:\s*(.+)/gm
  let m
  while ((m = kvRe.exec(raw)) !== null) {
    out[m[1].trim().toLowerCase()] = m[2].trim()
  }

  const h1Re = /^#\s+(.+)/m
  const h1 = h1Re.exec(raw)
  if (h1) out.title = h1[1].trim()

  out._raw = raw
  return out
}

function buildOrchestratorPayload(parsed) {
  return {
    theme: parsed.theme || parsed.title || "fantasy creatures",
    maxAssets: parseInt(parsed["asset count"] || parsed.maxassets || "2", 10),
    resumeRunId: parsed["run id"] || parsed.resume || undefined,
  }
}

function buildListerPayload(parsed) {
  return {
    platform: parsed.platform || "itch.io",
    keywords: parsed.theme || parsed.keywords || parsed.title || "pixel art",
    pricingTier: parsed["target price"] || parsed.price || "$2.99",
    provider: parsed.provider || undefined,
  }
}

async function processTask(filepath) {
  const basename = path.basename(filepath)
  log(`Processing ${basename}`)

  let runId = null
  try {
    const parsed = parseTaskFile(filepath)
    let payload

    if (ROLE === "orchestrator") {
      payload = buildOrchestratorPayload(parsed)
    } else if (ROLE === "lister") {
      payload = buildListerPayload(parsed)
    }

    // Open a durable run so this task shows up live on the dashboard.
    runId = await createRunRemote(parsed.theme || parsed.title || basename)
    await emitRemote(runId, "info", `Processing ${basename}`, { file: basename })

    const result = await apiFetch(cfg.endpoint, payload)

    const outName = basename.replace(/\.task\.md$/, ".result.json")
    const outPath = path.join(cfg.outbox, outName)
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2))

    const archivePath = path.join(cfg.archive, basename)
    fs.renameSync(filepath, archivePath)

    log(`Done → ${outName}`)
    await reportSpendRemote(result)
    await emitRemote(runId, "success", `Done → ${outName}`)
    await finishRunRemote(runId, "passed")
  } catch (err) {
    log(`Failed: ${err.message}`)

    const errName = basename.replace(/\.task\.md$/, ".error.json")
    const errPath = path.join(cfg.outbox, errName)
    fs.writeFileSync(errPath, JSON.stringify({ error: err.message, file: basename }, null, 2))

    const archivePath = path.join(cfg.archive, basename)
    try { fs.renameSync(filepath, archivePath) } catch {}

    await emitRemote(runId, "error", `Failed: ${err.message}`, { file: basename })
    await finishRunRemote(runId, "failed", err.message)
  }
}

const inFlight = new Set()

async function pollInbox() {
  try {
    const files = fs.readdirSync(cfg.inbox).filter((f) => f.endsWith(".task.md"))
    for (const file of files) {
      if (inFlight.has(file)) continue
      inFlight.add(file)
      const filepath = path.join(cfg.inbox, file)
      await processTask(filepath)
      inFlight.delete(file)
    }
  } catch (err) {
    log(`Poll error: ${err.message}`)
  }
}

async function heartbeat() {
  try {
    const result = await apiFetch("/api/agents/health")
    const statusPath = path.join(cfg.outbox, "status.md")
    const ts = new Date().toISOString()
    fs.writeFileSync(
      statusPath,
      `## Status ${ts}\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`
    )
    log(`Heartbeat OK`)
  } catch (err) {
    log(`Heartbeat failed: ${err.message}`)
  }
}

// ─── Monitor role ───────────────────────────────────────────────────
// Polls fleet health and pushes a snapshot to /api/status, which the
// dashboard reads (and ages out into a staleness alarm). This implements the
// monitor runbook that previously had no code behind it.
async function monitorTick() {
  let health = null
  try {
    health = await apiFetch("/api/agents/health")
  } catch (err) {
    log(`Health check failed: ${err.message}`)
  }

  const snapshot = {
    status: health ? "healthy" : "degraded",
    gateway_state: health ? "connected" : "unreachable",
    active_agents: (health && (health.active_agents ?? health.activeAgents)) || 0,
    platforms: (health && health.platforms) || undefined,
    role: "monitor",
    updated_at: new Date().toISOString(),
  }

  const pushed = await hubFetch("/api/status", "POST", snapshot)

  // Keep a local breadcrumb too (matches the orchestrator heartbeat).
  try {
    const statusPath = path.join(cfg.outbox, `status-${new Date().toISOString().replace(/[:.]/g, "-")}.md`)
    fs.writeFileSync(statusPath, `## Monitor ${snapshot.updated_at}\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\`\n`)
  } catch {}

  log(`Monitor tick → ${snapshot.status}${pushed ? " (pushed)" : ""}`)
}

async function main() {
  log(`Starting — role=${ROLE} base=${API_BASE} poll=${POLL_SECONDS}s heartbeat=${HEARTBEAT_MINUTES}m`)
  ensureDirs()

  if (ROLE === "monitor") {
    setInterval(monitorTick, MONITOR_MINUTES * 60 * 1000)
    monitorTick()
    return
  }

  setInterval(pollInbox, POLL_SECONDS * 1000)
  pollInbox()

  if (ROLE === "orchestrator") {
    setInterval(heartbeat, HEARTBEAT_MINUTES * 60 * 1000)
    setTimeout(heartbeat, 3000)
  }
}

main()
