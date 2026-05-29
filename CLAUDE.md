# CLAUDE.md

Guidance for Claude Code sessions working in this repository.

## What this project is

**KAI Asset Forge** — a one-person, AI-powered pixel-art game-asset shop.
Assets are generated, curated, packaged, and listed on itch.io / Gumroad.
The AI runs production; the human (Kai) monitors and approves. See
`hermes/brain.md` for the full vision, style rules, pricing, and quality bar.

### Moving parts

- **Vercel hub** — `kai-asset-forge-hub.vercel.app`. Dashboard + API
  (`/api/agents/*`, `/api/status`). The cloud control panel.
- **Hermes fleet** (`hermes/agent.js`) — a file-bus orchestrator that runs on
  the home PC (Docker). Polls `task-bus/*/inbox` for `*.task.md`, calls the
  Vercel API, writes results to `outbox`. Roles: orchestrator, lister, monitor.
- **Hermes agent gateway** — a separate, full AI agent on the home PC,
  listening on `localhost:8642` (Python / aiohttp). This is the "Hermes" Kai
  talks to on Telegram. It speaks the OpenAI API and can run the terminal,
  read/write files, drive a browser, manage cron jobs, generate images, etc.
- **Status pusher** (`scripts/hermes-status-pusher.ps1`) — a scheduled task on
  the PC that pushes a Hermes health snapshot to the Vercel dashboard.

## Reaching the home-PC Hermes agent

A cloud Claude Code session can delegate work to the home PC's Hermes agent
over a **Cloudflare Tunnel** (`hermes.masta-kai.dev` → `localhost:8642`),
protected by **two independent auth layers**:

1. **Cloudflare Access** service token — `CF-Access-Client-Id` /
   `CF-Access-Client-Secret` request headers.
2. **Hermes bearer key** — `Authorization: Bearer <key>` request header.

A request must satisfy *both* to reach the agent. `/health` is exempt from
layer 2; every other endpoint requires it.

### Use the helper, not raw curl

```bash
scripts/hermes-call.sh "check free disk space and report GB available"
echo "multi-line instruction…" | scripts/hermes-call.sh
scripts/hermes-call.sh --health     # tunnel + CF Access smoke test
scripts/hermes-call.sh --models     # verify the bearer-key layer (expects hermes-agent)
scripts/hermes-call.sh --raw "…"    # full JSON response instead of just the text
```

The helper attaches all three headers and POSTs to `/v1/chat/completions`.
Because that runs the full Hermes AIAgent loop, a single call can *execute*
multi-step work on the PC (run commands, edit files, etc.) and return the
result — it is not just a chat reply.

### Required cloud env vars

Set in the Claude Code **cloud environment** settings (not in the repo):
`HERMES_URL`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`,
`HERMES_API_KEY`. See `.env.example` for descriptions. The environment's
**network policy** must allow egress to `hermes.masta-kai.dev` (use the
"Custom" allowlist). Env-var and network changes only apply to **new**
sessions.

### Other Hermes endpoints (all OpenAI-compatible, behind both auth layers)

`/v1/chat/completions` (stateless), `/v1/responses` (stateful),
`/v1/runs` (async fire-and-poll: `POST` → `run_id`, then poll
`/v1/runs/{id}` and `/v1/runs/{id}/events`), session management under
`/api/sessions/*`, and cron management under `/api/jobs/*`.

### Security notes

- Never commit any secret (CF token, Hermes key) to this repo. Only variable
  *names* belong in `.env.example`.
- The Hermes agent has full control of the home PC. Treat its credentials
  accordingly; rotate the Hermes key and the CF service token if either may
  have been exposed.
- The PC's status pusher needs the Hermes key too — it reads
  `HERMES_LOCAL_TOKEN` from the PC user environment.

## Conventions

- Develop on a feature branch; do not commit or push unless asked.
- Keep secrets out of the repo and out of commit messages.
