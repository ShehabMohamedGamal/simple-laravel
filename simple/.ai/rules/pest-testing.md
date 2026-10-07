# Pest testing

Covers: `tests/**`.

- Write tests with `it()` and the `expect()` API. Do not use `test()`, datasets, or hooks. Chain extra assertions with `->and()`.
- Start test files with `declare(strict_types=1);` and add `: void` to closure signatures.
- `tests/Pest.php` applies `RefreshDatabase` to every suite. Do not add it per test.
- Test impact analysis stays off: pest TIA refuses to run inside a git subdirectory, and this template lives in a subdirectory of its repo. The parallel gate runs the full suite.
- Parallel runs give each process its own Postgres database (`testing_{TEST_TOKEN}` from `tests/bootstrap.php`). Never hardcode a database name.
- Keep `tests/Arch/ArchTest.php` as the executable convention source. Extend it when a convention needs enforcement.
