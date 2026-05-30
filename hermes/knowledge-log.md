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
