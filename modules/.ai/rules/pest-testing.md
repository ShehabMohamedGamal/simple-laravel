# Pest testing

Covers: `tests/**`, `Modules/*/tests/**`.

- Write tests with `it()` and the `expect()` API. Do not use `test()`, datasets, or hooks. Chain extra assertions with `->and()`.
- Start test files with `declare(strict_types=1);` and add `: void` to closure signatures.
- `tests/Pest.php` applies `RefreshDatabase` to every suite. Do not add it per test.
- Test impact analysis stays off: pest TIA refuses to run inside a git subdirectory, and this template lives in a subdirectory of its repo. The parallel gate runs the full suite.
- Parallel runs give each process its own Postgres database (`testing_{TEST_TOKEN}` from `tests/bootstrap.php`). Never hardcode a database name.
- Resolve dependencies from the container with `app(UserService::class)` or `app(UserRepositoryInterface::class)` in module tests. Do not `new` services or repositories.
- Register a new module's tests in the `ModuleTests` suite in `phpunit.xml` and in the `->in()` paths in `tests/Pest.php`. Module paths there are relative and start with `../`.
- Keep `tests/Arch/ArchTest.php` as the executable convention source. Extend it when a convention needs enforcement.
