# Hermes — Activate Your AI Agent Fleet

## Step 1: Install Docker Desktop

1. Go to https://www.docker.com/products/docker-desktop/
2. Click **"Download for Windows"**
3. Run the installer (click through all defaults)
4. When it finishes, **restart your computer**
5. After restart, open **Docker Desktop** from the Start menu
6. Wait for the whale icon in the system tray to turn green with "Engine running"

## Step 2: Copy Hermes Files

Open PowerShell and run:

```powershell
# Create hermes folder
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\hermes"

# Open the folder in File Explorer
Invoke-Item "$env:USERPROFILE\hermes"
```

Now manually copy these from `C:\Workspace\Kai Asset Forge\hermes\`:
- `Dockerfile`
- `agent.js`
- `docker-compose.yml`
- The `task-bus\` folder (everything inside)

Into: `C:\Users\YOURNAME\hermes\`

## Step 3: Create Task Bus Folders

```powershell
cd "$env:USERPROFILE\hermes"
New-Item -ItemType Directory -Force -Path "task-bus\orchestrator\inbox"
New-Item -ItemType Directory -Force -Path "task-bus\orchestrator\working"
New-Item -ItemType Directory -Force -Path "task-bus\orchestrator\outbox"
New-Item -ItemType Directory -Force -Path "task-bus\orchestrator\archive"
New-Item -ItemType Directory -Force -Path "task-bus\product\inbox"
New-Item -ItemType Directory -Force -Path "task-bus\product\outbox"
New-Item -ItemType Directory -Force -Path "task-bus\sales\inbox"
New-Item -ItemType Directory -Force -Path "task-bus\sales\outbox"
New-Item -ItemType Directory -Force -Path "task-bus\ops\outbox"
```

## Step 4: Set Your API Keys

```powershell
cd "$env:USERPROFILE\hermes"

# Create the .env file
New-Item -Force -Path .env

# Open it in Notepad
notepad .env
```

Paste exactly these 2 lines into Notepad, replacing the placeholders:

KAI_API_BASE=https://kai-asset-forge-hub.vercel.app
KAI_API_TOKEN=hermes-secret-abc123

> **IMPORTANT:** Do NOT include any backticks (\`\`\`) in the .env file — only the 2 lines above.

- `KAI_API_TOKEN`: Use the same value you set as `AGENT_API_TOKEN` in Vercel

Save and close Notepad.

## Step 5: Build & Launch the Fleet

```powershell
cd "$env:USERPROFILE\hermes"
docker compose --profile full build
docker compose --profile full up -d
```

You should see:
```
[+] Running 3/3
 ✔ Container kai-orchestrator  Started
 ✔ Container kai-lister         Started
 ✔ Container kai-monitor        Started
```

Check if they're running:
```powershell
docker compose --profile full ps
```

## Step 6: Send Your First Command

```powershell
cd "$env:USERPROFILE\hermes"

# Write a task for the orchestrator
@'
# Task: Ship a pixel pack
- **From:** Kai
- **Priority:** normal

Ship a new fantasy creatures pixel-art pack.
Generate 2 creatures, approve them, list on itch.io.
'@ | Out-File -FilePath "task-bus\orchestrator\inbox\ship-pack.task.md" -Encoding utf8

# Watch for results (Ctrl+C to stop)
Get-Content "task-bus\orchestrator\outbox\*" -Wait
```

## Stopping the Fleet

```powershell
cd "$env:USERPROFILE\hermes"
docker compose --profile full down
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Docker not starting | Open Docker Desktop first, wait for green |
| "docker not found" | Restart PowerShell after Docker install |
| Build fails | Check your internet connection — Docker needs to pull `node:22-alpine` |
| Containers exit immediately | Check: `docker compose --profile full logs` |
| API calls failing | Verify `KAI_API_TOKEN` in `.env` matches `AGENT_API_TOKEN` in Vercel |
| "pull access denied" | Use `docker compose --profile full build` first (not `up`) |
