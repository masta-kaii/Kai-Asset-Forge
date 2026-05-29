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
