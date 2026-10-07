set -eu

new_tests=$(git diff --cached --name-only --relative --diff-filter=A -- tests | grep '\.php$' || true)
if [ -z "$new_tests" ]; then
  echo "mutation: no new test files staged; nothing to report."
  exit 0
fi

# Report-only: prints the mutation score and surviving mutants. No
# threshold, no verdict.
PAO_FORCE=1 vendor/bin/pest --mutate --parallel $new_tests
