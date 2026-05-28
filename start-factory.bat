@echo off
echo.
echo ╔══════════════════════════════════════════╗
echo ║     🏭 KAI ASSET FORGE — STARTING UP     ║
echo ╚══════════════════════════════════════════╝
echo.
echo [1/3] Starting Hermes Gateway...
start "Hermes Gateway" cmd /c "hermes gateway run 2>&1"
echo        Gateway launched in background.
echo.
echo [2/3] Starting Status Pusher...
start "Status Pusher" cmd /c "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\khair\Kai-Asset-Forge\scripts\hermes-status-pusher.ps1"
echo        Pusher launched in background.
echo.
sc query cloudflared >nul 2>&1
if errorlevel 1 (
  echo        WARNING: cloudflared service not installed.
  echo        See docs\SETUP-TUNNEL.md to expose Hermes to the web.
  echo.
)
echo [3/3] Starting Factory (Next.js)...
cd /d C:\Users\khair\Kai-Asset-Forge
echo        Factory running at http://localhost:3000
echo.
echo ╔══════════════════════════════════════════╗
echo ║  ✅ FACTORY ONLINE — POPO IS WATCHING    ║
echo ║  📡 http://localhost:3000/factory        ║
echo ╚══════════════════════════════════════════╝
echo.
echo ⚠  Keep this window open. Close it to stop the factory.
echo.
npx next start -p 3000
