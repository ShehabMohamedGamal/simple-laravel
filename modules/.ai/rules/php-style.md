# PHP style

Covers: `**/*.php` (every PHP file).

- Start every new app, module, and test file with `declare(strict_types=1);`.
- Make classes `final`. Exceptions: interfaces, the abstract `App\Http\Controllers\Controller` base, and anonymous migration classes.
- Make services `final readonly` and inject dependencies through promoted constructors.
- Type every parameter and return. Write complete return types on methods and test closures. The type-coverage gate requires 80 percent minimum.
- Follow `.ai/rules/php-docblocks.md` for the docblock and comment doctrine.
- Never weaken a gate, an ignore pattern, or a test to make a failure disappear. Fix the code the gate flags.
- Follow the default Laravel pint ruleset; there is no `pint.json`.
- Run `vendor/bin/rector --dry-run` manually to preview refactors. Rector sits outside the verify chain.
