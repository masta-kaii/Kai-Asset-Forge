# Hermes Status Pusher
# Fetches health snapshot from local Hermes and pushes it to Vercel.
#
# Required env vars:
#   STATUS_PUSH_SECRET   - shared secret (Bearer token)
#   KAI_VERCEL_URL       - e.g. https://kai-asset-forge-hub.vercel.app
#   HERMES_LOCAL_URL     - e.g. http://localhost:8642
#   HERMES_LOCAL_TOKEN   - (optional) Bearer token for Hermes API

$ErrorActionPreference = "Stop"

$secret    = $env:STATUS_PUSH_SECRET
$vercelUrl = $env:KAI_VERCEL_URL
$hermesUrl = $env:HERMES_LOCAL_URL

if (-not $secret)   { Write-Host "[ERROR] STATUS_PUSH_SECRET not set"; exit 1 }
if (-not $vercelUrl) { Write-Host "[ERROR] KAI_VERCEL_URL not set"; exit 1 }
if (-not $hermesUrl) { $hermesUrl = "http://localhost:8642" }

$ts = Get-Date -Format "HH:mm:ss"

# 1. Fetch snapshot from Hermes
try {
    $hermesHeaders = @{}
    if ($env:HERMES_LOCAL_TOKEN) {
        $hermesHeaders["Authorization"] = "Bearer $env:HERMES_LOCAL_TOKEN"
    }
    $snapshot = Invoke-RestMethod -Uri "$hermesUrl/health/detailed" -Headers $hermesHeaders -TimeoutSec 5
} catch {
    Write-Host "[$ts] Hermes fetch failed: $_"
    exit 1
}

# 2. Push to Vercel
try {
    $vercelHeaders = @{
        "Authorization" = "Bearer $secret"
        "Content-Type"  = "application/json"
    }
    $body = $snapshot | ConvertTo-Json -Depth 10 -Compress
    $result = Invoke-RestMethod -Uri "$vercelUrl/api/status" -Method Post -Headers $vercelHeaders -Body $body -TimeoutSec 10
    Write-Host "[$ts] pushed. gateways:" $snapshot.platforms.PSObject.Properties.Name -join ", "
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "[$ts] push failed: $statusCode — $_"
    exit 1
}
