# hermes-knowledge-sync.ps1
#
# PC-side ingest for the shared knowledge log. Pulls the repo, finds entries in
# hermes/knowledge-log.md that are newer than the last ingested one, and saves
# each into the local Hermes agent's long-term memory via its API. Designed to
# run on Hermes startup and periodically (e.g. every 15 min) via a scheduled
# task or a Hermes cron job.
#
# Required:
#   -RepoPath <path>        Local git clone of the Kai-Asset-Forge repo.
#                           (Or set env HERMES_REPO_PATH.)
#   env HERMES_LOCAL_TOKEN  Hermes bearer key (same as platforms.api_server.key).
# Optional:
#   -HermesUrl   default http://localhost:8642
#   -CursorFile  default $env:LOCALAPPDATA\hermes\knowledge-cursor.txt
#   -NoPull      skip 'git pull' (just ingest what's on disk)
#
# Exit codes: 0 ok (incl. nothing-new), 1 error.

[CmdletBinding()]
param(
  [string]$RepoPath  = $env:HERMES_REPO_PATH,
  [string]$HermesUrl = "http://localhost:8642",
  [string]$CursorFile = (Join-Path $env:LOCALAPPDATA "hermes\knowledge-cursor.txt"),
  [switch]$NoPull
)

$ErrorActionPreference = "Stop"
function Log($m) { Write-Host ("[{0}] {1}" -f (Get-Date -Format HH:mm:ss), $m) }

if (-not $RepoPath -or -not (Test-Path $RepoPath)) {
  Log "ERROR: RepoPath not set or missing ('$RepoPath'). Pass -RepoPath or set HERMES_REPO_PATH."
  exit 1
}
$token = $env:HERMES_LOCAL_TOKEN
if (-not $token) { Log "ERROR: HERMES_LOCAL_TOKEN not set."; exit 1 }

$logPath = Join-Path $RepoPath "hermes\knowledge-log.md"

# 1. Pull latest.
if (-not $NoPull) {
  try {
    Log "git pull ..."
    git -C $RepoPath pull --ff-only 2>&1 | ForEach-Object { Log "  $_" }
  } catch {
    Log "WARN: git pull failed ($_). Continuing with on-disk copy."
  }
}

if (-not (Test-Path $logPath)) { Log "ERROR: log not found at $logPath"; exit 1 }

# 2. Load cursor (last ingested id; ISO UTC sorts chronologically as text).
$cursor = ""
if (Test-Path $CursorFile) { $cursor = (Get-Content $CursorFile -Raw).Trim() }
Log "cursor = '$cursor'"

# 3. Parse entries. Only scan below the first standalone '---' line so the
#    marker shown in the file's format example (in the header) is never ingested.
$lines = Get-Content $logPath
$sep = ($lines | Select-String -Pattern '^\s*---\s*$' | Select-Object -First 1)
if ($sep) { $content = ($lines[$sep.LineNumber..($lines.Count - 1)] -join "`n") }
else      { $content = ($lines -join "`n") }
$pattern = '(?s)<!-- KNOWLEDGE id=(?<id>\S+) -->\r?\n(?<body>.*?)(?=(\r?\n<!-- KNOWLEDGE id=)|\z)'
$entries = [regex]::Matches($content, $pattern)
Log ("found {0} entr{1} total" -f $entries.Count, $(if ($entries.Count -eq 1) {"y"} else {"ies"}))

# 4. Ingest the new ones (id greater than cursor, ordinal compare).
$newest = $cursor
$ingested = 0
# Content-Type is set on each request via -ContentType so it carries the
# UTF-8 charset alongside the explicit UTF-8 body bytes (see ingest loop).
$headers = @{ Authorization = "Bearer $token" }

foreach ($m in $entries) {
  $id   = $m.Groups['id'].Value.Trim()
  $body = $m.Groups['body'].Value.Trim()
  if ([string]::CompareOrdinal($id, $cursor) -le 0) { continue }  # already have it

  $prompt = @"
Commit the following to your long-term memory as authoritative project
knowledge synced from a Claude Code session. Store it concisely; do not act
on it now.

[$id]
$body
"@
  $payload = @{
    model    = "hermes-agent"
    messages = @(@{ role = "user"; content = $prompt })
    stream   = $false
  } | ConvertTo-Json -Depth 6

  try {
    Log "ingesting $id ..."
    # NOTE (PS 5.1): Invoke-RestMethod does not UTF-8-encode the body, so any
    # non-ASCII characters in a knowledge entry (em dash, curly quotes, emoji)
    # arrive as mojibake and the Hermes API rejects them as invalid JSON.
    # Encode the body to UTF-8 bytes explicitly and pass charset on Content-Type.
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    Invoke-RestMethod -Uri "$HermesUrl/v1/chat/completions" -Method Post `
      -Headers $headers -Body $bodyBytes `
      -ContentType "application/json; charset=utf-8" -TimeoutSec 180 | Out-Null
    $ingested++
    if ([string]::CompareOrdinal($id, $newest) -gt 0) { $newest = $id }
  } catch {
    Log "ERROR ingesting ${id}: $_"
    # Stop so the cursor isn't advanced past a failed entry; retry next run.
    break
  }
}

# 5. Advance cursor to the newest successfully ingested id.
if ($newest -ne $cursor) {
  New-Item -ItemType Directory -Force -Path (Split-Path $CursorFile) | Out-Null
  Set-Content -Path $CursorFile -Value $newest -Encoding UTF8
  Log "cursor advanced to '$newest'"
}

# NOTE (PS 5.1): keep this line ASCII. A literal em dash here crashes the parser.
Log ("done -- {0} new entr{1} ingested" -f $ingested, $(if ($ingested -eq 1) {"y"} else {"ies"}))
exit 0
