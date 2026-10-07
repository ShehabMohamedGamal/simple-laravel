# Eloquent models

Covers: `app/Models/**`.

- Declare mass assignment with the `#[Fillable([...])]` attribute and hide sensitive columns with `#[Hidden([...])]`. Do not use the `$fillable` or `$hidden` properties.
- Declare casts with the `protected function casts(): array` method, not a `$casts` property.
- Keep models `final` with `declare(strict_types=1);`.
- Keep queries out of models other than relations and local scopes. Persistence flows through the `Service` layer.
