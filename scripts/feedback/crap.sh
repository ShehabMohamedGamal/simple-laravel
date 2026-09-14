set -eu

staged=$(git diff --cached --name-only --diff-filter=ACM -- app | grep '\.php$' || true)
if [ -z "$staged" ]; then
  echo "crap: no app files staged; nothing to report."
  exit 0
fi

report=$(mktemp "${TMPDIR:-/tmp}/crap.XXXXXX.xml")
trap 'rm -f "$report"' EXIT

PAO_FORCE=1 vendor/bin/pest --coverage-crap4j="$report" --parallel

# Report-only: prints the CRAP value of every method in the staged app
# classes. No ceiling, no verdict.
printf '%s\n' "$staged" | php -r '
$report = $argv[1];
$staged = array_filter(explode("\n", trim(stream_get_contents(STDIN))));
$classes = [];
foreach ($staged as $file) {
    $classes[] = "App\\" . str_replace(["/", ".php"], ["\\", ""], substr($file, 4));
}
$xml = simplexml_load_file($report);
$rows = [];
foreach ($xml->methods->method as $method) {
    if (!in_array((string) $method->className, $classes, true)) {
        continue;
    }
    $rows[] = sprintf("crap=%d %s::%s", $method->crap, $method->className, $method->methodName);
}
if ($rows === []) {
    echo "crap: no methods found for the staged app classes.", "\n";
    exit(0);
}
sort($rows);
echo implode("\n", $rows), "\n";
' "$report"
