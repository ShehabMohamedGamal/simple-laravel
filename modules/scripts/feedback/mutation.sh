set -eu

new_tests=$(git diff --cached --name-only --relative --diff-filter=A -- tests Modules | grep -E '^(tests|Modules/[^/]+/tests)/(Unit|Feature)/[^/]+Test\.php$' || true)
if [ -z "$new_tests" ]; then
  echo "mutation: no new test files staged; nothing to report."
  exit 0
fi

# Report-only: prints the mutation score and surviving mutants. No
# threshold, no verdict. Paratest takes a single path, so each staged
# test file gets its own run.
for test_file in $new_tests; do
  PAO_FORCE=1 vendor/bin/pest --mutate --parallel "$test_file" || true
done
