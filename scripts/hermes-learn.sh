#!/usr/bin/env bash
#
# hermes-learn.sh — record a lesson in the shared knowledge log AND (if the
# bridge is reachable) live-push it into the home-PC Hermes agent's memory.
#
# This is the "teach Hermes" command. It does two things:
#   1. Appends a timestamped entry to hermes/knowledge-log.md (durable record;
#      Hermes also ingests this on startup via hermes-knowledge-sync.ps1).
#   2. Calls scripts/hermes-call.sh to ask Hermes to commit it to memory now
#      (immediate). If the bridge isn't reachable, the log entry is still kept.
#
# It does NOT git-commit/push — do that yourself (or let the session do it) so
# the entry reaches Hermes's startup sync too.
#
# Usage:
#   scripts/hermes-learn.sh --title "Short title" "the lesson / decision / note"
#   scripts/hermes-learn.sh "free text (first line becomes the title)"
#   echo "long multi-line note" | scripts/hermes-learn.sh --title "Title"
#   scripts/hermes-learn.sh --no-push --title "…" "…"   # log only, skip live push

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$SCRIPT_DIR/../hermes/knowledge-log.md"
CALL="$SCRIPT_DIR/hermes-call.sh"

TITLE=""
PUSH=1
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) sed -n '2,/^set -euo/p' "$0" | sed 's/^# \{0,1\}//; $d'; exit 0 ;;
    --title)   TITLE="${2:-}"; shift 2 ;;
    --no-push) PUSH=0; shift ;;
    --)        shift; while [ $# -gt 0 ]; do ARGS+=("$1"); shift; done ;;
    *)         ARGS+=("$1"); shift ;;
  esac
done

if [ "${#ARGS[@]}" -gt 0 ]; then
  BODY="${ARGS[*]}"
elif [ ! -t 0 ]; then
  BODY="$(cat)"
else
  echo "ERROR: no note text given. See --help." >&2
  exit 2
fi

[ -f "$LOG" ] || { echo "ERROR: knowledge log not found at $LOG" >&2; exit 1; }

# Title defaults to the first line of the body.
if [ -z "$TITLE" ]; then
  TITLE="$(printf '%s\n' "$BODY" | head -n1 | cut -c1-80)"
fi

ID="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Append the entry in the exact format the sync script parses.
{
  printf '\n<!-- KNOWLEDGE id=%s -->\n' "$ID"
  printf '### %s — %s\n' "$ID" "$TITLE"
  printf '%s\n' "$BODY"
} >> "$LOG"

echo "Logged entry $ID — \"$TITLE\" → ${LOG#"$SCRIPT_DIR/../"}"

# Live-push into Hermes memory (best-effort).
if [ "$PUSH" = "1" ]; then
  if [ -x "$CALL" ] || [ -f "$CALL" ]; then
    msg="Commit the following to your long-term memory as authoritative project
knowledge from a Claude Code session. Store it concisely; do not act on it.

[$ID] $TITLE
$BODY"
    if MSG="$msg" bash "$CALL" "$msg" >/tmp/hermes_learn_push 2>/tmp/hermes_learn_err; then
      echo "Live-pushed to Hermes memory. Reply:"
      sed 's/^/  /' /tmp/hermes_learn_push
    else
      echo "NOTE: live push to Hermes failed (entry is still saved in the log)." >&2
      echo "  $(tail -n1 /tmp/hermes_learn_err 2>/dev/null)" >&2
      echo "  Hermes will still pick it up on its next startup sync after you push the repo." >&2
    fi
  else
    echo "NOTE: $CALL not found; skipped live push (log entry kept)." >&2
  fi
fi

echo "Remember to commit + push so Hermes's startup sync also gets it:"
echo "  git add hermes/knowledge-log.md && git commit -m 'knowledge: $TITLE' && git push"
