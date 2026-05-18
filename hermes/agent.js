const fs = require("fs")
const path = require("path")

const ROLE = process.env.ROLE || "orchestrator"
const API_BASE = process.env.KAI_API_BASE || "https://kai-asset-forge-hub.vercel.app"
const API_TOKEN = process.env.KAI_API_TOKEN || ""
const POLL_SECONDS = parseInt(process.env.POLL_SECONDS || "10", 10)
const HEARTBEAT_MINUTES = parseInt(process.env.HEARTBEAT_MINUTES || "30", 10)

const conf = {
  orchestrator: {
    inbox: "/srv/agent-bus/orchestrator/inbox",
    outbox: "/srv/agent-bus/orchestrator/outbox",
    archive: "/srv/agent-bus/orchestrator/archive",
    endpoint: "/api/agents/orchestrator",
    method: "POST",
  },
  lister: {
    inbox: "/srv/agent-bus/sales/inbox",
    outbox: "/srv/agent-bus/sales/outbox",
    archive: "/srv/agent-bus/sales/archive",
    endpoint: "/api/agents/listing",
    method: "POST",
  },
}

const cfg = conf[ROLE]
if (!cfg) {
  console.error(`Unknown ROLE: ${ROLE}. Use orchestrator or lister.`)
  process.exit(1)
}

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

  try {
    const parsed = parseTaskFile(filepath)
    let payload

    if (ROLE === "orchestrator") {
      payload = buildOrchestratorPayload(parsed)
    } else if (ROLE === "lister") {
      payload = buildListerPayload(parsed)
    }

    const result = await apiFetch(cfg.endpoint, payload)

    const outName = basename.replace(/\.task\.md$/, ".result.json")
    const outPath = path.join(cfg.outbox, outName)
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2))

    const archivePath = path.join(cfg.archive, basename)
    fs.renameSync(filepath, archivePath)

    log(`Done → ${outName}`)
  } catch (err) {
    log(`Failed: ${err.message}`)

    const errName = basename.replace(/\.task\.md$/, ".error.json")
    const errPath = path.join(cfg.outbox, errName)
    fs.writeFileSync(errPath, JSON.stringify({ error: err.message, file: basename }, null, 2))

    const archivePath = path.join(cfg.archive, basename)
    try { fs.renameSync(filepath, archivePath) } catch {}
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

async function main() {
  log(`Starting — role=${ROLE} base=${API_BASE} poll=${POLL_SECONDS}s heartbeat=${HEARTBEAT_MINUTES}m`)
  ensureDirs()

  let ticks = 0
  const heartbeatInterval = HEARTBEAT_MINUTES * 60

  setInterval(pollInbox, POLL_SECONDS * 1000)
  pollInbox()

  if (ROLE === "orchestrator") {
    setInterval(heartbeat, heartbeatInterval * 1000)
    setTimeout(heartbeat, 3000)
  }
}

main()
