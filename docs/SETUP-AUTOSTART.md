# Windows autostart (PC, one-time)

Makes the factory come up automatically when the PC boots and you log in.

## What runs where

| Process            | Lifecycle              | How                                        |
| ------------------ | ---------------------- | ------------------------------------------ |
| `cloudflared`      | At boot, before login  | Windows service (`cloudflared service install`) |
| `hermes gateway`   | At user log on         | `start-factory.bat` via Task Scheduler     |
| `next start`       | At user log on         | `start-factory.bat`                        |
| Status pusher      | At user log on         | `start-factory.bat` → `scripts/hermes-status-pusher.ps1` |

`cloudflared` survives logout because it's a real service. Hermes and the
status pusher need a logged-in user session today; revisit if you want the
tunnel to be useful while logged out.

## Set the env vars (one-time, user-level)

`Win+R` → `rundll32 sysdm.cpl,EditEnvironmentVariables` → User variables →
New, for each:

| Variable             | Value                                              |
| -------------------- | -------------------------------------------------- |
| `HERMES_LOCAL_URL`   | `http://localhost:8080` (or wherever Hermes binds) |
| `HERMES_LOCAL_TOKEN` | Hermes' bearer token                               |
| `KAI_VERCEL_URL`     | `https://kai-asset-forge-hub.vercel.app`           |
| `STATUS_PUSH_SECRET` | Same value as the Vercel env var of the same name  |

Log out and back in so the new vars are visible to scheduled tasks.

## Register the Task Scheduler trigger

`Win+R` → `taskschd.msc` → Create Task:

- **General**: name `Kai Asset Forge`. Run only when user is logged on.
- **Triggers**: New → At log on → specific user `khair`.
- **Actions**: New → Start a program →
  - Program: `cmd`
  - Arguments: `/c "C:\Users\khair\Kai-Asset-Forge\start-factory.bat"`
- **Conditions**: uncheck "Start the task only if the computer is on AC
  power" if this is a desktop.

## Verify

1. Reboot the PC. Do **not** log in. Wait ~30 s.
2. From your phone, hit `https://hermes.your-domain.example/health/detailed`
   with the right headers (see `docs/SETUP-TUNNEL.md`). Expect a 502 —
   tunnel is up, but Hermes isn't running yet.
3. Log in. The factory bat window opens, then the status pusher window.
4. Within 60 s, the dashboard's PC badge flips from `PC OFFLINE` to
   `PC ONLINE`.
5. Re-hit the curl from step 2. Expect 200.

## Troubleshooting

- **Pusher window flashes and closes**: missing env var. Run the script
  manually in a non-elevated terminal to see the error message it prints
  before exiting.
- **Dashboard stays `PC OFFLINE`**: check Vercel function logs for the
  `/api/status` POST — most likely `STATUS_PUSH_SECRET` mismatch (401) or
  `STATUS_PUSH_SECRET` not set on Vercel (503).
- **Dashboard goes `PC STALE`**: pusher hasn't reported in 2+ minutes.
  Check the pusher window; check Hermes itself is responding on its local
  port.
