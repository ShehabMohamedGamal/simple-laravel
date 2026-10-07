# Rules index

Each rule file lists the globs it covers. Read every file whose globs match the paths you are editing before you write code.

- `**/*.php` — `php-style.md`: strict types, final classes, promoted constructors, return types.
- `**/*.php` — `php-docblocks.md`: docblock doctrine, comment policy, tag rules.
- `tests/**`, `Modules/*/tests/**` — `pest-testing.md`: Pest style, suite registration, parallel databases.
- `app/Models/**`, `Modules/*/Models/**` — `models.md`: Eloquent model conventions.
- `Modules/**` — `module-layout.md`: module folder layout, manifest, providers, new-module checklist.
- `Modules/**` — `repositories.md`: repository pattern, service orchestration, the cross-module seam.
- `Modules/*/Http/**`, `Modules/*/Routes/**` — `module-http.md`: controllers, form requests, routes.
