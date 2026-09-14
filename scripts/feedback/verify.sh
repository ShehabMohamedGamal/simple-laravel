#!/usr/bin/env sh
# Verify chain. Every step runs to the end; nothing stops mid-chain.
# The three gates decide the exit status, collected and reported at the
# end. Report steps print raw tool output and never affect the result.
# Step output is tidied (noise lines dropped) before printing; the
# tool's own exit status is captured before the pipe.
set -u

failures=''

run_gate() {
  label="$1"
  shift
  echo "== $label =="
  out=$("$@")
  rc=$?
  printf '%s\n' "$out" | php scripts/feedback/tidy.php
  if [ "$rc" -ne 0 ]; then
    failures="$failures $label"
  fi
}

run_report() {
  label="$1"
  shift
  echo "== report: $label =="
  out=$("$@")
  printf '%s\n' "$out" | php scripts/feedback/tidy.php || true
}

run_gate no-comments sh scripts/feedback/no-comments.sh --staged --config
run_gate pest env PAO_FORCE=1 vendor/bin/pest --parallel
run_gate type-coverage env PAO_FORCE=1 vendor/bin/pest --type-coverage --min=80

run_report pint vendor/bin/pint --test --format=json
run_report deptrac vendor/bin/deptrac analyse --no-progress
run_report phpstan env PAO_FORCE=1 vendor/bin/phpstan analyse
run_report lsp php scripts/feedback/lsp.php
run_report mutation sh scripts/feedback/mutation.sh
run_report crap sh scripts/feedback/crap.sh
run_report phpmetrics sh scripts/feedback/phpmetrics.sh
run_report audit composer audit --abandoned=report

if [ -n "$failures" ]; then
  echo "FAILED GATES:$failures"
  exit 1
fi
echo "ALL GATES PASSED"
