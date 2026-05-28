# Polls Hermes /health/detailed every 60s and forwards the snapshot to
# the Vercel dashboard's /api/status endpoint. Run alongside Hermes via
# start-factory.bat; see docs/SETUP-AUTOSTART.md.

$ErrorActionPreference = "Continue"

$HermesUrl   = if ($env:HERMES_LOCAL_URL) { $env:HERMES_LOCAL_URL } else { "http://localhost:8080" }
$HermesToken = $env:HERMES_LOCAL_TOKEN
$VercelUrl   = $env:KAI_VERCEL_URL
$Secret      = $env:STATUS_PUSH_SECRET

if (-not $HermesToken -or -not $VercelUrl -or -not $Secret) {
    Write-Host "ERROR: missing one of HERMES_LOCAL_TOKEN, KAI_VERCEL_URL, STATUS_PUSH_SECRET."
    Write-Host "Set them as user-level environment variables; see docs/SETUP-AUTOSTART.md."
    Start-Sleep -Seconds 10
    exit 1
}

Write-Host "Status pusher up. Polling $HermesUrl/health/detailed -> $VercelUrl/api/status every 60s."

while ($true) {
    $stamp = Get-Date -Format "HH:mm:ss"
    try {
        $snap = Invoke-RestMethod -Uri "$HermesUrl/health/detailed" `
            -Headers @{ Authorization = "Bearer $HermesToken" } `
            -TimeoutSec 5

        $body = $snap | ConvertTo-Json -Depth 6 -Compress

        Invoke-RestMethod -Uri "$VercelUrl/api/status" `
            -Method POST `
            -Headers @{ Authorization = "Bearer $Secret" } `
            -ContentType "application/json" `
            -Body $body `
            -TimeoutSec 10 | Out-Null

        Write-Host "[$stamp] pushed."
    } catch {
        Write-Host "[$stamp] push failed: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 60
}
