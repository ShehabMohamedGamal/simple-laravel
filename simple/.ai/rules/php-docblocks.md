# PHP docblocks and comments

Covers: `**/*.php`.

## Docblocks

- Write a docblock for every class, interface, trait, enum, method, and property in `app/`. The `docs-coverage` report step in `composer verify` lists the ones you missed.
- Describe the abstraction, not the implementation. A docblock says what the thing is for, why it exists, and what the signature cannot show: constraints, units, invariants, side effects, and the behavior callers must know.
- Never restate the code. If a sentence only repeats what the name, types, or body already say, delete it.
- Write docblocks as interface documentation. They tell callers what to expect; keep the internal how out of them.
- Prefer making code obvious over documenting it. Rename, retype, or restructure first, then write the docblock when the code still needs explaining.
- Update the docblock whenever you change the code it describes. A stale docblock is worse than none.
- Write docblocks as prose, so the Writing rules in AGENTS.md govern them: active voice, one idea per sentence, no filler, no em dashes.

## Comments

- Use `//` comments for implementation notes. Explain why the code is written this way: constraints, tradeoffs, workarounds, non-obvious behavior. Never narrate what the next line does.

## Tags

- Use a tag only when it adds information the signature cannot show: `@throws` with its condition, `@deprecated` with its replacement, constraints or units, and `@property` tags on Eloquent models for magic attributes.
- Never write `@param` or `@return` lines that restate types. Signatures in this repo are fully typed.

## Examples

A good class docblock describes the contract and the reasons the signature cannot carry:

```php
/**
 * Single entry point for invoice payment state transitions.
 *
 * Transitions are idempotent: paying an already-paid invoice
 * returns the existing payment. Amounts are always in minor units.
 */
final class PaymentService
{
```

A good inline comment explains a why the code cannot state:

```php
// Retry twice because the provider rate-limits bursts during its
// nightly reindex, and a third attempt always lands after the window.
$response = Http::retry(2, 500)->post($endpoint, $payload);
```

A bad docblock restates the signature and the body. Write nothing instead:

```php
/**
 * Get the attributes that should be cast.
 *
 * @return array<string, string>
 */
protected function casts(): array
```
