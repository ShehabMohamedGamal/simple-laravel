#!/usr/bin/env sh
# Deterministic no-memory gate. Blocks `bd memory` / `bd remember` before
# execution; durable knowledge belongs in beads issues instead. Consumed by
# the OpenCode plugin (no-memory.ts) and the zcode PreToolUse hook
# (.zcode/config.json), which pipe raw commands or hook JSON payloads here.
# Usage: printf '%s' '<command or hook JSON payload>' | no-memory.sh
# Exit 0 CLEAN, 2 BLOCKED.
set -eu

if rg -q '\bbd\s+(memory|remember)\b'; then
  echo "BLOCKED: memory tools are banned in this repo. Record durable knowledge in beads issues instead: bd create / bd update <id> --notes." >&2
  exit 2
fi
exit 0
