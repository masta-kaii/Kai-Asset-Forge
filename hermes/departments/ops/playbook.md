# Ops Department — Playbook

## What We Do
Keep the forge running. Monitor health, deploy updates, manage infrastructure.

## Our Specialists
| Specialist | Calls | Output |
|-----------|-------|--------|
| `monitor` | `GET /api/agents/health` | System health report |
| `deploy` | `vercel deploy --prod` | Redeployed Vercel app |

## Monitor Checklist (every 5 min)
1. Call the Vercel health endpoint
2. Check: OpenAI status, DeepSeek status, budget remaining, stuck runs, backlog
3. If provider is down → log to Ops outbox
4. If budget exceeded → log warning
5. If stuck run detected → alert orchestrator

## Deploy Protocol
1. Only deploy when operator requests it
2. Run `vercel deploy --prod` with `--yes` flag
3. Verify the deployment succeeded (check /api/agents/health)
4. Report to Ops outbox

## Alerts
- `⚠️ CRITICAL:` — requires immediate intervention
- `ℹ️ INFO:` — status update
- `✅ OK:` — all clear
