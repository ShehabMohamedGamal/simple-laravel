---
name: laravel
description: Laravel backend, testing, Tailwind, and one-shot verification. Covers controllers, models, migrations, queues, caching, validation, and Eloquent; test design and coverage with Pest; Tailwind v4 utilities, spacing, and dark mode; and vendor/bin/pest --agent one-off checks for routes, pages, mail, jobs, and screenshots.
metadata:
  author: simple-template
---

# Laravel

Merged from the boost skills laravel-best-practices, testing-best-practices, tailwindcss-development, and pest-plugin-agent. Rule files load on demand; this index decides which ones to read.

## Consistency first

Check what the application already does before applying any rule. Check sibling files, related controllers, models, or tests for established patterns. Follow them; do not introduce a second way. These rules are defaults for when no pattern exists yet, not overrides. Deviate only for a correctness or security defect, and call the deviation out.

## How to apply

1. Map every affected concern to the rule index. Read each mapped rule file before editing. Skip unrelated files.
2. Verify version-sensitive APIs for the installed version with `search-docs`, or inspect the installed framework when it is unavailable.
3. Make the smallest coherent change. Keep the architecture and naming.
4. Run the narrowest relevant tests. The gate chain in AGENTS.md runs the full suite on commit; do not ask the user to run it manually.
5. Re-read the diff against every mapped rule before finishing.

## Backend rule index

| Concern | Read |
| --- | --- |
| Query count, eager loading, indexes, large datasets | [`rules/db-performance.md`](rules/db-performance.md) |
| Subqueries, aggregates, complex ordering and query plans | [`rules/advanced-queries.md`](rules/advanced-queries.md) |
| Models, relationships, scopes, casts | [`rules/eloquent.md`](rules/eloquent.md) |
| Authentication, authorization, input safety, secrets, uploads | [`rules/security.md`](rules/security.md) |
| Form Requests and validation rules | [`rules/validation.md`](rules/validation.md) |
| Controllers, route binding, resources, middleware | [`rules/routing.md`](rules/routing.md) |
| Schema changes, columns, foreign keys, indexes | [`rules/migrations.md`](rules/migrations.md) |
| Jobs, retries, uniqueness, batches, Horizon | [`rules/queue-jobs.md`](rules/queue-jobs.md) |
| Cache lifetime, invalidation, locks, memoization | [`rules/caching.md`](rules/caching.md) |
| Outbound requests, retries, timeouts, fakes | [`rules/http-client.md`](rules/http-client.md) |
| Exceptions, reporting, rendering, log context | [`rules/error-handling.md`](rules/error-handling.md) |
| Events and notifications | [`rules/events-notifications.md`](rules/events-notifications.md) |
| Mailables and mail assertions | [`rules/mail.md`](rules/mail.md) |
| Scheduled tasks and overlap protection | [`rules/scheduling.md`](rules/scheduling.md) |
| Collections, lazy iteration, bulk operations | [`rules/collections.md`](rules/collections.md) |
| Blade components, attributes, composers | [`rules/blade-views.md`](rules/blade-views.md) |
| Environment values and application configuration | [`rules/config.md`](rules/config.md) |
| Naming, helpers, file boundaries, PHP style | [`rules/style.md`](rules/style.md) |
| Actions, services, dependencies, application structure | [`rules/architecture.md`](rules/architecture.md) |

Decision rules: prefer framework features and existing application abstractions over new helpers or dependencies. Avoid speculative abstractions. Keep database access out of Blade views and prevent hidden N+1 queries across controllers, resources, jobs, and serialization.

## Testing

This project uses Pest. Read nearby tests before you choose syntax and organization; project conventions take precedence over this skill. Do not delete or rewrite an existing test that follows a project convention; explain the drawbacks and let the user decide.

- Test observable behavior and application contracts. A test must pass after an implementation change if the behavior stays the same.
- Cover every changed decision and each applicable high-value failure mode. A decision is a branch, a validation, a calculation, or an authorization.
- Exercise declarations through behavior instead of repeating their text. Leave framework behavior to framework tests; a constrained relationship, cast, scope, or validation rule belongs to this project.
- Write a feature test first. Write a unit test only for logic that does not use the framework.
- Write a browser test only for JavaScript behavior a feature test cannot reach. Put it in `tests/Browser` and call `assertNoJavaScriptErrors()` in it.
- Keep every test that can detect a distinct defect. When two tests detect the same defect, trim the higher-layer test to one case and report the duplication.
- Use the test tools the project installs. Add a test dependency, plugin, or browser only after the user asks.
- An `arch()` test declares a rule for an entire directory and intentionally checks declarations; judge it by the convention it protects.

### Test rule index

| Subject | Rule File |
| --- | --- |
| Test framework features that may already do the work | [`testing/finding-features.md`](testing/finding-features.md) |
| File layout, test names, and groups | [`testing/naming.md`](testing/naming.md) |
| Arrange-act-assert and choosing the correct assertion | [`testing/assertions.md`](testing/assertions.md) |
| Endpoint coverage, auth, tenant isolation, validation, browser tests | [`testing/endpoint-tests.md`](testing/endpoint-tests.md) |
| Factories, test data ownership, repeated input values | [`testing/test-data.md`](testing/test-data.md) |
| Fakes, mocks, outbound HTTP, time, randomness, databases | [`testing/isolation.md`](testing/isolation.md) |
| Escaping, injection, cross-tenant access, privilege checks | [`testing/security.md`](testing/security.md) |
| Environment and CI settings for a slow suite | [`testing/performance.md`](testing/performance.md) |
| Reviewing a test or suite | [`testing/review.md`](testing/review.md) |

## Tailwind v4

- Check and follow existing Tailwind conventions. Offer to extract repeated patterns into components that match the project (Blade, JSX, Vue).
- Configuration is CSS-first with `@theme`; no `tailwind.config.js`, and `corePlugins` is not supported.
- Import with `@import "tailwindcss";` instead of the `@tailwind` directives.
- Deprecated utilities: `bg-opacity-*`, `text-opacity-*`, `border-opacity-*`, `divide-opacity-*`, `ring-opacity-*`, `placeholder-opacity-*` become `black/*` opacity forms; `flex-shrink-*` becomes `shrink-*`, `flex-grow-*` becomes `grow-*`, `overflow-ellipsis` becomes `text-ellipsis`.
- Use `gap` utilities instead of margins between siblings.
- If existing pages support dark mode, new pages must support it the same way, typically the `dark:` variant.
- If a Vite manifest error appears after a frontend change, run `npm run build` or ask the user to run `npm run dev`.

## One-shot verification: `pest --agent`

`vendor/bin/pest --agent='<code>'` runs a PHP snippet as a temporary test: a route response, a model relationship, a rendered page, mail or a queued job, a screenshot. Use it to verify a change works, not to replace real tests. Load this skill before any shell command or throwaway test when the request is to verify that something works.

### Invocation

Wrap the snippet in single outer quotes; use double quotes for PHP string literals inside. Double outer quotes make the shell interpolate `$variables` to nothing and silently break the check. Never hand-escape.

```bash
vendor/bin/pest --agent='$user = \App\Models\User::factory()->create(); visit("/login")->type("email", $user->email)->press("Log in")->assertPathIs("/dashboard");'
```

If the snippet contains an apostrophe, write it to a `.php` file (plain body statements, no `<?php`, no `use`) and run `vendor/bin/pest --agent="$(cat /path/to/snippet.php)"`. Delete the file after the check.

### Rules

- Use `vendor/bin/pest`, never bare `pest`.
- Fully qualify every class name; the generated test has no `use` statements.
- The snippet must be valid PHP, not natural language.
- Seed state with factories inside the snippet; the test database starts empty.
- Screenshots land in `tests/Browser/Screenshots/`. The signature is `screenshot(bool $fullPage = true, ?string $filename = null)`; always pass `filename:`, and `fullPage: false` for viewport-only captures. Sweep throwaway screenshots after review.
- Browser assertions auto-wait; assert the post-transition state directly. There is no `waitFor()`.
- Browser checks need a reachable app URL: `php artisan serve` or the browser plugin's built-in server.
- If `visit()` is undefined, ask the user before installing `pestphp/pest-plugin-browser`, `playwright`, and the browser binaries. Once approved, add `tests/Browser/Screenshots` to `.gitignore`.
- If a check fails on a missing table, look for a commented `RefreshDatabase` line in `tests/Pest.php`. Ask before uncommenting it: on a persistent test database it wipes data on every run.
- Traits and path-scoped hooks do not carry over to the snippet; inline the setup you need. Prefer one focused snippet per invocation; an empty snippet is an error.

### When not to use

The behavior deserves a permanent regression guard (write a test file in `tests/Feature` or `tests/Browser`), the check needs more than about three statements, or the user asked for a fix rather than a verification.
