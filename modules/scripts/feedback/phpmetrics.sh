set -eu

# Report-only: prints the phpmetrics summary JSON. No ceiling, no verdict.
report=$(mktemp "${TMPDIR:-/tmp}/phpmetrics.XXXXXX.json")
trap 'rm -f "$report"' EXIT

vendor/bin/phpmetrics --report-summary-json="$report" app Modules >/dev/null
cat "$report"
