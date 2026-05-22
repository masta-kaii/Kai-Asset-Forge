#!/usr/bin/env bash
# Kai Asset Forge — Autonomous Pipeline Runner
# Fires the SDXL local pipeline, reports results to Telegram
# Called by Windows Task Scheduler every 8 hours

set -e

PIPELINE_URL="http://localhost:3000/api/forge/pipeline"
LOG_DIR="/c/Users/khair/Kai-Asset-Forge/pipeline-logs"
TIMESTAMP=$(date "+%Y-%m-%d_%H-%M-%S")
LOG_FILE="${LOG_DIR}/pipeline-${TIMESTAMP}.json"
TELEGRAM_BOT="" # Will send via Hermes if available

mkdir -p "${LOG_DIR}"

echo "[$(date)] 🏰 Kai Asset Forge Pipeline Starting..."
echo "[$(date)] Theme: auto (Scout picks best trending)"

# Step 1: Check ComfyUI is alive
COMFY_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8188/api/prompt 2>/dev/null || echo "000")
if [ "$COMFY_CHECK" != "200" ]; then
    echo "[$(date)] ❌ ComfyUI not responding on :8188. Check if ComfyUI is running."
    exit 1
fi

# Step 2: Check Next.js dev server is alive
NEXT_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$NEXT_CHECK" != "200" ]; then
    echo "[$(date)] ❌ Next.js dev server not responding on :3000. Starting it..."
    cd /c/Users/khair/Kai-Asset-Forge
    nohup npx next dev > /dev/null 2>&1 &
    sleep 10
fi

# Step 3: Fire the pipeline!
echo "[$(date)] 🚀 Firing SDXL pipeline..."
curl -s -X POST "${PIPELINE_URL}" \
  -H "Content-Type: application/json" \
  -d '{"theme":"auto"}' > "${LOG_FILE}" 2>/dev/null

# Step 4: Parse results
PIPELINE_RESULT=$(cat "${LOG_FILE}")
SUCCESS=$(echo "${PIPELINE_RESULT}" | "/c/Users/khair/AppData/Local/Programs/Python/Python310/python.exe" -c "
import sys, json
data = json.load(sys.stdin)
theme = data.get('theme', '?')
score = data.get('trendingScore', 0)
generated = data.get('generatedCount', 0)
uploaded = data.get('uploadedCount', 0)
approved = data.get('approvedCount', 0)
listing_title = (data.get('listing') or {}).get('title', 'No listing')
error = data.get('error', '')
if data.get('success'):
    print(f'✅ | Theme: {theme} | Trending: {score}/10 | Generated: {generated} | Uploaded: {uploaded} | Approved: {approved} | Listing: {listing_title}')
else:
    print(f'❌ FAILED: {error}')
" 2>/dev/null || echo "❌ Parse error")

echo "[$(date)] ${PIPELINE_RESULT}"

echo "[$(date)] Pipeline run complete. Log: ${LOG_FILE}"
echo "---"
echo "${PIPELINE_RESULT}"
