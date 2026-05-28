# Cloudflare Tunnel setup (PC, one-time)

Exposes Hermes' HTTP API at `https://hermes.<your-domain>` so a cloud Claude
Code session can reach it. Runs as a Windows service, so the tunnel is up
at the login screen — no user session needed.

## Prerequisites

- A Cloudflare account with a domain on it.
- Hermes' HTTP API running on the PC with bearer-token auth already on
  (you confirmed this).
- The Hermes API port and bearer token to hand. Default in
  `scripts/hermes-status-pusher.ps1` is `localhost:8080`; change it if
  yours differs.

## Steps

```powershell
# 1. Install cloudflared.
winget install --id Cloudflare.cloudflared

# 2. Authenticate (opens browser; pick the right Cloudflare zone).
cloudflared tunnel login

# 3. Create the tunnel. Writes %USERPROFILE%\.cloudflared\<uuid>.json.
cloudflared tunnel create kai-hermes

# 4. Add a DNS route on your Cloudflare zone.
cloudflared tunnel route dns kai-hermes hermes.your-domain.example
```

## Config

Create `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: <uuid-from-step-3>
credentials-file: C:\Users\khair\.cloudflared\<uuid>.json
ingress:
  - hostname: hermes.your-domain.example
    service: http://localhost:8080   # change if Hermes binds elsewhere
  - service: http_status:404
```

## Install as a Windows service

```powershell
cloudflared service install
```

This runs at boot, independent of user login.

## Zero Trust Access policy (second layer)

In the Cloudflare dashboard → Zero Trust → Access → Applications:

1. Add a self-hosted application for `hermes.your-domain.example`.
2. Create two access policies:
   - **You (browser)**: identity provider = GitHub OAuth, restricted to
     your account.
   - **Cloud Claude sessions**: service auth token. Copy the
     `CF-Access-Client-Id` and `CF-Access-Client-Secret` into the cloud
     Claude Code session environment alongside `KAI_HERMES_TOKEN`.

Without this, anyone who guesses the hostname hits Hermes' bearer check
directly; with it, requests need both a Cloudflare service token *and* the
Hermes bearer token.

## Verify

From any machine:

```bash
curl -i \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  -H "Authorization: Bearer $KAI_HERMES_TOKEN" \
  "https://hermes.your-domain.example/health/detailed"
```

Expect 200 with Hermes' JSON. A 403 from Cloudflare means the Access
policy is misconfigured; a 401 from Hermes means the bearer token is
wrong; a 502 means cloudflared can reach the hostname but Hermes itself
isn't listening on the configured port.
