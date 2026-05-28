# Kai Asset Forge — orientation for Claude

## What this repo is

The Vercel-hosted dashboard and tooling for a Hermes-driven local pixel-art
factory. The deployed app at `kai-asset-forge-hub.vercel.app` is a UI; it
does not run the factory itself.

## Where the work actually happens

The factory runs on the user's Windows PC as **Hermes (Nous Research)** with
its built-in Telegram gateway and an HTTP API. Hermes drives Aseprite,
commits to this repo, and reports status. The dashboard and any cloud Claude
session are remote consumers of that factory.

This means a few API routes in this repo are **inert on Vercel** —
specifically `app/api/health/route.ts` and `app/api/kanban/status/route.ts`,
which shell out to a `hermes` CLI that does not exist in the serverless
runtime. They still work in `next dev` on the PC. Don't be surprised; don't
fix them as a side quest unless asked.

## Talking to Hermes-on-PC from a cloud session

If `KAI_HERMES_URL` and `KAI_HERMES_TOKEN` are set in the session
environment, Hermes is reachable through a Cloudflare Tunnel:

```
curl -H "Authorization: Bearer $KAI_HERMES_TOKEN" \
  "$KAI_HERMES_URL/health/detailed"
```

The tunnel sits behind Cloudflare Zero Trust Access, so the request also
needs whatever service-token headers Cloudflare expects (configured in the
session environment alongside the bearer token).

If those env vars are not set, Hermes is unreachable from this session.
Tell the user, then either work without it or ask them to configure the
session env.

## Status flow (PC → Vercel → dashboard)

The PC runs `scripts/hermes-status-pusher.ps1`, which polls Hermes'
`/health/detailed` every 60 s and POSTs the snapshot to `/api/status` on
Vercel with `Authorization: Bearer $STATUS_PUSH_SECRET`. The dashboard's
factory page polls `/api/status` and renders a freshness badge in the
header. One-way push; the dashboard never reaches into the PC.

To change the snapshot shape: update Hermes' `/health/detailed` first, then
mirror the new fields in `app/api/status/route.ts` (the `HermesSnapshot`
type) and the badge in `app/factory/page.tsx`.

## Dead code to leave alone

The user has explicitly deferred cleanup of:

- `hermes/agent.js`, `hermes/docker-compose.yml` — superseded by
  Hermes-on-PC.
- The subprocess calls in `app/api/health/route.ts` and
  `app/api/kanban/status/route.ts` — see note above.

Don't refactor or delete these without asking.

## Setup docs

- `docs/SETUP-TUNNEL.md` — Cloudflare Tunnel install on the PC.
- `docs/SETUP-AUTOSTART.md` — Windows autostart wiring.
- `.env.example` — full list of env vars (Vercel side + PC side + session
  side).
