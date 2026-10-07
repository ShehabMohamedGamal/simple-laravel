#!/usr/bin/env bash
# Update every globally installed npm package to its latest version.
# One npm outdated -g call finds the stale set; each stale package is then
# reinstalled with npm install -g <name>@latest. --check prints the stale
# set and exits without updating.
#
# Usage: update-npm-globals.sh [--check]
set -euo pipefail

usage() {
  echo "usage: $0 [--check]" >&2
  exit 2
}

die() { echo "error: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }
warn() { echo "warn: $*" >&2; }

CHECK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK=1 ;;
    -h|--help) usage ;;
    *) usage ;;
  esac
  shift
done

command -v npm >/dev/null || die "npm is not on PATH"
command -v node >/dev/null || die "node is not on PATH (needed to parse npm's JSON)"

# npm outdated exits 0 when everything is current, 1 when the stale set is
# printed, and anything else only on a real failure.
ERR="$(mktemp)"
trap 'rm -f "$ERR"' EXIT
set +e
OUT="$(npm outdated -g --json 2>"$ERR")"
CODE=$?
set -e
if [ "$CODE" -gt 1 ] || { [ "$CODE" -ne 0 ] && [ -z "$OUT" ]; }; then
  die "npm outdated failed (exit $CODE): $(cat "$ERR")"
fi

STALE="$(printf '%s' "$OUT" | node -e '
let s = "";
process.stdin.on("data", (d) => (s += d));
process.stdin.on("end", () => {
  let parsed;
  try { parsed = JSON.parse(s); } catch { process.exit(1); }
  for (const [name, info] of Object.entries(parsed)) {
    console.log(`${name}\t${info.current ?? "?"}\t${info.latest ?? "?"}`);
  }
});')" || die "could not parse npm outdated output as JSON"

mapfile -t STALE_ROWS <<<"$STALE"
if [ -z "${STALE_ROWS[0]:-}" ]; then
  ok "all global npm packages are up to date"
  exit 0
fi

echo "outdated global npm packages:"
while IFS=$'\t' read -r name current latest; do
  printf '  %s: %s -> %s\n' "$name" "$current" "$latest"
done < <(printf '%s\n' "${STALE_ROWS[@]}")

if [ "$CHECK" -eq 1 ]; then
  echo "check only; rerun without --check to update"
  exit 0
fi

UPDATED=0
FAILED=0
while IFS=$'\t' read -r name _current _latest; do
  echo "== npm install -g ${name}@latest =="
  if npm install -g "${name}@latest"; then
    UPDATED=$((UPDATED + 1))
  else
    warn "npm install -g ${name}@latest failed"
    FAILED=$((FAILED + 1))
  fi
done < <(printf '%s\n' "${STALE_ROWS[@]}")

echo
echo "summary: $UPDATED updated, $FAILED failed"
[ "$FAILED" -eq 0 ] || exit 1
