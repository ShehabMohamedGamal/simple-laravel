# Eloquent models

Covers: `app/Models/**`, `Modules/*/Models/**`.

- Declare mass assignment with the `#[Fillable([...])]` attribute and hide sensitive columns with `#[Hidden([...])]`. Do not use the `$fillable` or `$hidden` properties.
- Declare casts with the `protected function casts(): array` method, not a `$casts` property.
- Keep models `final` with `declare(strict_types=1);`.
- Override `newFactory()` in module models so factory resolution finds the module's `Database/Factories`.
- Keep queries out of models other than relations and local scopes. Persistence flows through repositories and services.
