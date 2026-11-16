#!/usr/bin/env bash
# Scheduler entry point (works on macOS and Linux/NAS). Pulls latest, then runs all filters unattended.
#   CONFIG_REPO=/path/to/private-checkout   optional: git-pull it, use its filters.txt
#   SELF_UPDATE=1                           optional: git-pull this script's own repo first
#   GMAIL_MOVE_DATA=/path                   where credentials/tokens/moved.json live (default: script dir)
cd "$(dirname "$0")" || exit 1
LOG="${GMAIL_MOVE_DATA:-.}/auto.log"
exec >>"$LOG" 2>&1
echo "=== $(date) ==="
LOCK="${TMPDIR:-/tmp}/gmail-move.lock"
mkdir "$LOCK" 2>/dev/null || { echo "previous run still active, skipping"; exit 0; }
trap 'rmdir "$LOCK"' EXIT
[ "$SELF_UPDATE" = "1" ] && { git pull --ff-only || echo "WARN: self-update failed"; }
if [ -n "$CONFIG_REPO" ]; then
  git -C "$CONFIG_REPO" pull --ff-only || echo "WARN: config pull failed, using last checkout"
  export GMAIL_MOVE_CONFIG="$CONFIG_REPO/filters.txt"
fi
PY=.venv/bin/python; [ -x "$PY" ] || PY=python3
"$PY" gmail_move.py --auto
echo "exit: $?"
