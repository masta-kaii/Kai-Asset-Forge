# Hermes Knowledge Log

The **shared brain** between cloud Claude Code sessions and the home-PC Hermes
agent. Cloud sessions append what we learn/build/decide here; Hermes loads new
entries into its long-term memory (on startup and on a schedule) so it "knows"
what happened in Claude even though it wasn't in the room.

## How it flows

```
cloud Claude  ──(scripts/hermes-learn.sh)──►  this file  ──(git push)
                          │
                          └─ also live-pushes into Hermes memory via the bridge
home PC       ──(scripts/hermes-knowledge-sync.ps1 on startup + cron)──►
                          git pull this file → save NEW entries to Hermes memory
```

## Entry format (do not change — both scripts parse it)

Each entry begins with an HTML marker carrying a unique, sortable id, followed
by a heading and free-form notes. `hermes-learn.sh` writes this automatically.

```
<!-- KNOWLEDGE id=2026-01-01T00:00:00Z -->
### 2026-01-01T00:00:00Z — Short title
- Bullet notes, decisions, gotchas.
- Keep it tight: what changed and why it matters to Hermes.
```

The PC sync uses the `id=` values to know which entries are new (it stores a
cursor of the last id it ingested). Newest entries go at the **bottom**.

---

<!-- KNOWLEDGE id=2026-05-29T16:00:00Z -->
### 2026-05-29T16:00:00Z — Cloud↔PC Hermes bridge is live (two-layer auth)
- Cloud Claude Code sessions can now reach the home-PC Hermes agent over a
  Cloudflare Tunnel: `hermes.masta-kai.dev` → `localhost:8642`.
- Two independent auth layers protect it:
  1. Cloudflare Access service token — `CF-Access-Client-Id` / `-Secret` headers.
  2. Hermes bearer key — `Authorization: Bearer <key>` header (config lives at
     `platforms.api_server.key` in the PC's Hermes `config.yaml`).
- The cloudflared Windows service is reboot-proof: its registry `ImagePath`
  must end with `... config.yml" tunnel run` (a bare exe path silently exits),
  and config + creds must sit in
  `C:\Windows\System32\config\systemprofile\.cloudflared\` (the LocalSystem
  account's home), not the user profile.
- Use `scripts/hermes-call.sh "do X"` from cloud sessions to delegate work to
  the PC agent. See `CLAUDE.md` → "Reaching the home-PC Hermes agent".

<!-- KNOWLEDGE id=2026-05-29T16:30:00Z -->
### 2026-05-29T16:30:00Z — This knowledge log exists; how Hermes should use it
- This file (`hermes/knowledge-log.md`) is the shared memory between cloud
  Claude and Hermes. Treat entries here as authoritative project knowledge.
- Cloud sessions append entries automatically when meaningful work concludes.
- On the PC, `scripts/hermes-knowledge-sync.ps1` pulls this file and saves new
  entries into Hermes long-term memory on startup and periodically.
- The repo's `hermes/` rulebook (brain.md, departments/*/playbook.md,
  agents/*/runbook.md) governs the Docker asset-factory fleet — a SEPARATE
  system from this Telegram/gateway Hermes. Don't confuse the two.

<!-- KNOWLEDGE id=2026-05-30T01:35:00Z -->
### 2026-05-30T01:35:00Z — Knowledge-sync loop is live (PC ingests log automatically)
- Hermes now ingests `hermes/knowledge-log.md` into long-term memory on logon
  and every 15 minutes, via Scheduled Task `HermesKnowledgeSync` + a Startup
  shortcut. Cursor stored at `$env:LOCALAPPDATA\hermes\knowledge-cursor.txt`.
- Wrapper batch on the PC: `scripts/hermes-sync-wrapper.bat`. PC env vars:
  `HERMES_REPO_PATH` (canonical: `C:\Workspace\Kai Asset Forge`) and
  `HERMES_LOCAL_TOKEN` (43 chars, matches `api_server.extra.key`).
- The Hermes API key actually lives at `api_server.extra.key` in
  `%LOCALAPPDATA%\hermes\config.yaml` — NOT at `platforms.api_server.key` as
  my Phase B notes mistakenly said. Auth re-verified 6/6.
- Two real bugs in `scripts/hermes-knowledge-sync.ps1` were patched on first
  PC run, both peculiar to PowerShell 5.1: (1) Unicode em dash in a script
  string crashed the parser — keep ASCII `--` in the script; (2) PS5.1's
  `Invoke-RestMethod` doesn't UTF-8-encode the JSON body, so Unicode in
  knowledge entries (em dashes, curly quotes) needs explicit
  `[System.Text.Encoding]::UTF8.GetBytes($payload)` and `Content-Type:
  application/json; charset=utf-8`. Future edits to the script must preserve
  both fixes.

<!-- KNOWLEDGE id=2026-05-30T02:10:00Z -->
### 2026-05-30T02:10:00Z — PowerShell 5.1 fixes for hermes-knowledge-sync.ps1 are now in origin
- The two PS 5.1 patches Hermes discovered on first run are now committed:
  the em-dash on the final log line is ASCII `--`, and `Invoke-RestMethod`
  POSTs an explicit UTF-8 byte body with `-ContentType "application/json;
  charset=utf-8"`. `Content-Type` was removed from the `$headers` hash to
  avoid the duplicate-header conflict with the per-request `-ContentType`.
- Outcome: future clones of the script work as-is on Windows PowerShell 5.1
  without manual patching. The Workspace clone can be safely reset to
  origin/master without losing these fixes.

<!-- KNOWLEDGE id=2026-05-30T02:30:00Z -->
### 2026-05-30T02:30:00Z — Single canonical clone at C:\Workspace\Kai Asset Forge
- The PC now has ONE canonical repo clone at `C:\Workspace\Kai Asset Forge`,
  tracking `origin/master`. The earlier duplicate at
  `C:\Users\khair\Kai-Asset-Forge` was deleted after the workspace clone was
  reset --hard to origin/master.
- `HERMES_REPO_PATH` (user env var) points at the canonical clone.
- `scripts/hermes-knowledge-sync.ps1` no longer needs local patches — the
  PowerShell 5.1 fixes (em dash + UTF-8 body) are baked into origin.
- Stashes are clean; the only untracked files in the workspace clone are
  intentional local-only assets (tileset references, `app/api/pixelforge/`,
  utility scripts, sync wrapper) — none of those should be committed without
  explicit decision.

<!-- KNOWLEDGE id=2026-05-30T07:22:38Z -->
### 2026-05-30T07:22:38Z — Phase 1: durable run ledger + fleet telemetry
Added a Firestore runs/{id}+events store (lib/runs.ts) with /api/runs* endpoints; the Vercel autonomous pipeline and the Hermes fleet (agent.js) now both write to this single ledger. Fixed /api/kanban/status and /api/forge/stats to read the ledger instead of execSync('hermes ...') which never worked on Vercel. Implemented the agent.js monitor role (health poll -> /api/status snapshot) and gave the fleet STATUS_PUSH_SECRET. Telemetry writes auth via STATUS_PUSH_SECRET and are best-effort (never break task processing).

<!-- KNOWLEDGE id=2026-05-30T08:43:32Z -->
### 2026-05-30T08:43:32Z — Phase 2: live SSE monitor
Added /api/stream (SSE) that multiplexes Hermes liveness, current runs, and cross-run activity deltas from the Phase 1 ledger; self-terminates ~25s and resumes via Last-Event-ID (EventSource auto-reconnect). Added lib/runs.ts listRecentActivity() collection-group query (needs COLLECTION_GROUP index on events.ts). New /monitor page: staleness banner (green<90s/amber<300s/red), active-run rail with stage+progress, and auto-scroll activity feed. Factory got a MONITOR nav chip. All stream DB reads are guarded so missing index / unconfigured Firestore degrades to an empty stream, never a 500.

<!-- KNOWLEDGE id=2026-05-30T10:31:03Z -->
### 2026-05-30T10:31:03Z — Phase 3: pipeline rail + run replay
Monitor now has a live PipelineRail (Scout->Forge->QC->Pack->List stepper, current stage pulses, connectors fill on completion) adapted from design-explorations/pipeline-timeline.html — shown as a headline rail and in a per-run detail drawer. Clicking any run card or history block opens a side drawer that fetches /api/runs/[id] + /api/runs/[id]/events and replays the full event log with duration/reworks/error. Added a run-history strip of colored status blocks. All graceful without Firestore.

<!-- KNOWLEDGE id=2026-05-30T18:28:37Z -->
### 2026-05-30T18:28:37Z — Phase 4: budget gauge + Telegram alerts
Added budgetSummary()/failedRunsSince() in lib/runs.ts + /api/budget for a HUD budget gauge on /monitor (month $used/$cap, green->amber->red at 80/100%, default cap $10/mo via MONTHLY_BUDGET_USD per brain.md). lib/notify.ts is an env-gated best-effort Telegram notifier (TELEGRAM_BOT_TOKEN/CHAT_ID). /api/cron/staleness (vercel cron */5, CRON_SECRET-gated) detects fleet silence (>STALE_SECONDS), budget breach, and new failed runs, firing de-duped alerts via alerts/state doc; guarded so Firestore outage returns ok:false not a crash. Cost is fed via patchRun costDelta — fleet should report LLM/image spend there. All 4 phases in PR #5 (base master).

<!-- KNOWLEDGE id=2026-05-31T04:01:06Z -->
### 2026-05-31T04:01:06Z — Phase 4.1: spend reporting + review fixes
Wired real cost reporting: hermes/agent.js reportSpendRemote() POSTs provider spend (usd or model+usage/images) to push-secret-gated POST /api/budget, which recordSpend() folds into a spend/{YYYY-MM} ledger summed by budgetSummary alongside run cost. Fixed build break (missing SPEND const). Self-review fixes: POST /api/runs now forwards stage (fleet runs were stored stage:null); failedRunsSince bounded with server-side status filter+limit+index; added (status,source,startedAt) composite index; cron seeds lastFailedAt to now on first run (no historical alert storm); monitor openRun checks rRes.ok; apiAuth logs a loud SECURITY warning if STATUS_PUSH_SECRET unset in prod. STILL UNBUILT per brain.md: $0.33/day cap + kill-switch (only monthly Telegram alert exists today). PR #5.

<!-- KNOWLEDGE id=2026-05-31T04:21:32Z -->
### 2026-05-31T04:21:32Z — Phase 4.2 kill switch + deploy state
Built the brain.md kill switch: lib/runs.ts dailyCap()/budgetGate(); budgetSummary now returns dailyCap/dailyPct/blocked/blockReason and recordSpend writes both spend/{YYYY-MM} and spend/{YYYY-MM-DD}; /api/forge/autonomous calls budgetGate() at entry and returns 402 (fails OPEN on storage error); cron adds a daily-cap alert (de-duped via alerts/state.dailyAlertedOn); /monitor shows MONTHLY+TODAY gauges and a PIPELINE HALTED banner. Added firebase.json (repo had rules+indexes but no firebase.json, so deploy had nothing to target). Firebase project id = kai-asset-forge (public). DEPLOY STILL BLOCKED: Firebase CLI not authenticated on the PC and the SA key can't be extracted programmatically — needs 'firebase login' on the PC OR GOOGLE_APPLICATION_CREDENTIALS pointed at the SA JSON, then: firebase deploy --only firestore:indexes,firestore:rules --project kai-asset-forge. Vercel has STATUS_PUSH_SECRET (prod); TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CRON_SECRET are NOT set (alerts+cron auth need them). PR #5.

<!-- KNOWLEDGE id=2026-05-31T04:30:41Z -->
### 2026-05-31T04:30:41Z — Factory monitoring LIVE in production
Firestore rules+indexes deployed to project kai-asset-forge (firebase deploy succeeded after firebase.json was added). Live smoke test of the Vercel hub all green: /api/budget returns the new kill-switch shape (cap 10, dailyCap 0.33, blocked false), /api/runs and the dual /api/runs?status=running&source=hermes filter both return clean empty lists with NO FAILED_PRECONDITION (composite index confirmed working), /api/kanban/status and /api/forge/stats both 200 reading the ledger. STATUS_PUSH_SECRET is set in prod. Remaining optional: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CRON_SECRET not yet set (alerts + cron auth). Note: the Claude cloud env network allowlist only permits hermes.masta-kai.dev, so cloud sessions must verify the Vercel hub via Hermes, not direct curl. PR #5.
