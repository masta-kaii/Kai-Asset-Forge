@echo off
echo.
echo ╔══════════════════════════════════════════╗
echo ║     🏭 STOPPING KAI ASSET FORGE          ║
echo ╚══════════════════════════════════════════╝
echo.
echo Stopping Hermes Gateway...
hermes gateway stop 2>nul
echo.
echo Stopping Factory server...
taskkill /f /im node.exe 2>nul
echo.
echo ✅ Factory offline. POPO is sleeping.
echo.
pause
