@echo off
echo.
echo ╔══════════════════════════════════════════╗
echo ║     🏭 KAI ASSET FORGE — STARTING UP     ║
echo ╚══════════════════════════════════════════╝
echo.
echo [1/2] Starting Hermes Gateway...
start "Hermes Gateway" cmd /c "hermes gateway run 2>&1"
echo        Gateway launched in background.
echo.
echo [2/2] Starting Factory (Next.js)...
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
