# Hermes Setup — Docker Desktop on Windows

## Prerequisites
1. Install **Docker Desktop** from https://www.docker.com/products/docker-desktop/
2. After installation, open Docker Desktop and wait for the whale icon to show "running"
3. Open **PowerShell** as Administrator

## One-Time Setup

```powershell
# Create the Hermes directory
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\hermes"
Set-Location "$env:USERPROFILE\hermes"

# Copy all files from the Kai-Asset-Forge repo hermes/ folder here
# (do this manually: drag-copy hermes/* into C:\Users\YOURNAME\hermes\)

# Create task bus directories
New-Item -ItemType Directory -Force -Path "task-bus\orchestrator\inbox"
New-Item -ItemType Directory -Force -Path "task-bus\orchestrator\working"
New-Item -ItemType Directory -Force -Path "task-bus\orchestrator\outbox"
New-Item -ItemType Directory -Force -Path "task-bus\orchestrator\archive"
New-Item -ItemType Directory -Force -Path "task-bus\product\inbox"
New-Item -ItemType Directory -Force -Path "task-bus\product\outbox"
New-Item -ItemType Directory -Force -Path "task-bus\sales\inbox"
New-Item -ItemType Directory -Force -Path "task-bus\sales\outbox"
New-Item -ItemType Directory -Force -Path "task-bus\ops\outbox"
New-Item -ItemType Directory -Force -Path "task-bus\support\inbox"

# Create .env file
@'
ANTHROPIC_API_KEY=sk-ant-your-key-here
KAI_API_BASE=https://kai-asset-forge.vercel.app
KAI_API_TOKEN=your-agent-token-from-vercel-env
'@ | Out-File -FilePath .env -Encoding utf8
```

## Start the Fleet

```powershell
# From C:\Users\YOURNAME\hermes\
docker compose up -d

# Check if running
docker compose ps

# View logs
docker compose logs -f
```

## Send Your First Command

```powershell
# Create a task for the orchestrator
@'
# Task: Ship a pixel pack
- **From:** Kai
- **Priority:** normal
- **Created:** {timestamp}

Ship a new fantasy creatures pixel-art pack. 2 creatures, 1 item.
List on itch.io when done.
'@ | Out-File -FilePath "task-bus\orchestrator\inbox\ship-pack.task.md" -Encoding utf8

# Watch the outbox for results
Get-Content "task-bus\orchestrator\outbox\*" -Wait
```

## Stop the Fleet

```powershell
docker compose down
```

## Troubleshooting

- **Docker not starting:** Open Docker Desktop first, wait for green "Engine running"
- **Containers exit immediately:** Check logs: `docker compose logs`
- **API calls failing:** Verify `KAI_API_TOKEN` in `.env` matches `AGENT_API_TOKEN` in Vercel
- **Permission denied on Windows:** Run PowerShell as Administrator
