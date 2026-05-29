#!/usr/bin/env bash
#
# hermes-call.sh — delegate a task to the home-PC Hermes agent.
#
# Hermes is a full AI agent (terminal / files / browser / cron / image-gen …)
# running on the home PC, exposed at $HERMES_URL via a Cloudflare Tunnel and
# protected by two independent auth layers:
#   1. Cloudflare Access service token  (CF-Access-Client-Id / -Secret headers)
#   2. Hermes bearer key                (Authorization: Bearer … header)
# This script attaches all three headers so a request actually reaches the
# agent. It speaks the OpenAI Chat Completions API at /v1/chat/completions.
#
# Usage:
#   scripts/hermes-call.sh "check disk space and report free GB"
#   echo "long multi-line instruction" | scripts/hermes-call.sh
#   scripts/hermes-call.sh --health     # tunnel + CF Access smoke test (no key needed)
#   scripts/hermes-call.sh --models     # list models (verifies the bearer-key layer)
#   scripts/hermes-call.sh --raw "…"    # print the full JSON response, not just the text
#
# Required env vars (set in the Claude Code cloud environment, NOT in the repo):
#   HERMES_URL                e.g. https://hermes.masta-kai.dev
#   CF_ACCESS_CLIENT_ID       Cloudflare Access service-token id
#   CF_ACCESS_CLIENT_SECRET   Cloudflare Access service-token secret
#   HERMES_API_KEY            Hermes bearer key (auth layer 2)
# Optional:
#   HERMES_MODEL              model id (default: hermes-agent)
#
# Note: the network policy of the cloud environment must allow egress to
# hermes.masta-kai.dev (set "Custom" allowlist in the environment settings).
# Env-var and network changes only take effect in NEW sessions.

set -euo pipefail

MODEL="${HERMES_MODEL:-hermes-agent}"
RAW=0
MODE="chat"

usage() {
  sed -n '2,/^set -euo/p' "$0" | sed 's/^# \{0,1\}//; s/^#$//' | sed '$d'
}

ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --raw)     RAW=1; shift ;;
    --health)  MODE="health"; shift ;;
    --models)  MODE="models"; shift ;;
    --)        shift; while [ $# -gt 0 ]; do ARGS+=("$1"); shift; done ;;
    *)         ARGS+=("$1"); shift ;;
  esac
done

# --- required env -----------------------------------------------------------
missing=()
for v in HERMES_URL CF_ACCESS_CLIENT_ID CF_ACCESS_CLIENT_SECRET HERMES_API_KEY; do
  [ -n "${!v:-}" ] || missing+=("$v")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "ERROR: missing env var(s): ${missing[*]}" >&2
  echo "Set them in the Claude Code cloud environment settings, then start a NEW session." >&2
  exit 2
fi

CF_HEADERS=(
  -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}"
  -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}"
)
AUTH_HEADER=(-H "Authorization: Bearer ${HERMES_API_KEY}")

# Split a "body\nHTTPCODE" curl response into globals $BODY and $CODE.
split_resp() {
  CODE="${1##*$'\n'}"
  BODY="${1%$'\n'*}"
}

case "$MODE" in
  health)
    # /health is exempt from the Hermes bearer key, so only CF headers are sent.
    resp="$(curl -sS --max-time 30 -w $'\n%{http_code}' "${CF_HEADERS[@]}" "${HERMES_URL}/health")"
    split_resp "$resp"
    echo "$BODY"; echo "[HTTP $CODE]"
    [ "$CODE" = "200" ] || exit 1
    exit 0
    ;;
  models)
    resp="$(curl -sS --max-time 30 -w $'\n%{http_code}' "${CF_HEADERS[@]}" "${AUTH_HEADER[@]}" "${HERMES_URL}/v1/models")"
    split_resp "$resp"
    echo "$BODY"; echo "[HTTP $CODE]"
    [ "$CODE" = "200" ] || exit 1
    exit 0
    ;;
esac

# --- chat mode: prompt from args or stdin -----------------------------------
if [ "${#ARGS[@]}" -gt 0 ]; then
  PROMPT="${ARGS[*]}"
elif [ ! -t 0 ]; then
  PROMPT="$(cat)"
else
  echo "ERROR: no prompt given." >&2
  usage
  exit 2
fi

# Build the JSON body with python3 so the prompt is escaped correctly.
REQ_BODY="$(HERMES_PROMPT="$PROMPT" HERMES_MODEL="$MODEL" python3 -c '
import json, os
print(json.dumps({
    "model": os.environ["HERMES_MODEL"],
    "messages": [{"role": "user", "content": os.environ["HERMES_PROMPT"]}],
    "stream": False,
}))')"

# The agent loop can take a while when it runs tools, so allow a long timeout.
resp="$(curl -sS --max-time 600 -w $'\n%{http_code}' \
  "${CF_HEADERS[@]}" "${AUTH_HEADER[@]}" \
  -H "Content-Type: application/json" \
  -X POST "${HERMES_URL}/v1/chat/completions" \
  --data "$REQ_BODY")"
split_resp "$resp"

if [ "$CODE" != "200" ]; then
  echo "ERROR: Hermes returned HTTP $CODE" >&2
  echo "$BODY" >&2
  exit 1
fi

if [ "$RAW" = "1" ]; then
  echo "$BODY"
else
  HERMES_RESP="$BODY" python3 -c '
import json, os, sys
try:
    d = json.loads(os.environ["HERMES_RESP"])
    print(d["choices"][0]["message"]["content"])
except Exception as e:
    sys.stderr.write("could not parse response (%s); printing raw:\n" % e)
    print(os.environ["HERMES_RESP"])
'
fi
