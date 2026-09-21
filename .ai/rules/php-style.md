# PHP style

Covers: `**/*.php` (every PHP file).

- Start every new app and test file with `declare(strict_types=1);`.
- Make classes `final`. Exceptions: interfaces, the abstract `App\Http\Controllers\Controller` base, and anonymous migration classes. Keep `App\Services` classes non-final so tests can mock them directly.
- Inject dependencies through promoted constructors.
- Type every parameter and return. Write complete return types on methods and test closures. The type-coverage gate requires 80 percent minimum.
- Write no comments. The no-comments gate rejects any staged diff that adds them. State the constraint in the code's name, types, or structure instead.
- Never weaken a gate, an ignore pattern, or a test to make a failure disappear. Fix the code the gate flags.
- Follow the default Laravel pint ruleset; there is no `pint.json`.
- Run `vendor/bin/rector --dry-run` manually to preview refactors. Rector sits outside the verify chain.
