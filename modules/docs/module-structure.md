# Module structure

This template's modular profile. The simple profile (single app tree) lives on `main`; this document governs the `laravel-modules` branch.

## Layout

Modules live under `Modules/<Name>` with a flat structure:

```
Modules/Users/
├── Database/
│   ├── Factories/
│   ├── Migrations/
│   └── Seeders/
├── Http/
│   ├── Controllers/
│   ├── Middleware/      (optional)
│   ├── Requests/        (optional)
│   └── Resources/       (optional)
├── Models/
├── Providers/
│   ├── UsersServiceProvider.php
│   └── RouteServiceProvider.php
├── Repositories/
│   ├── Contracts/       (public seam)
│   └── Eloquent/
├── Routes/
│   └── web.php
├── Services/
├── Tests/
├── config/
└── module.json
```

The `app_folder` setting in `config/modules.php` is empty, so class paths match namespaces exactly and the root PSR-4 mapping (`"Modules\\": "Modules/"` in composer.json) autoloads every module. Modules carry no `composer.json` of their own, and the wikimedia composer-merge plugin is explicitly disabled. Note the case: module database folders are capitalized (`Database/Factories`) because PSR-4 matching is case sensitive.

## Creating a module

1. Generate the skeleton: `php artisan module:make <Name>`. Custom stubs live in `stubs/modules/` and produce the layout above, a provider, a route provider, a controller, and module.json with the conventions block.
2. Register the module's tests in `phpunit.xml` (add `Modules/<Name>/tests/Unit` and `Modules/<Name>/tests/Feature` to the `ModuleTests` suite).
3. Extend the Pest binding in `tests/Pest.php`: add `'../Modules/<Name>/tests/Unit'` and `'../Modules/<Name>/tests/Feature'` to `->in()`. The relative path is required; Pest resolves paths against `tests/`.
4. Per model, run in this order:
   - `php artisan module:make-model <Model> <Module>`
   - `php artisan module:make-interface <Model>RepositoryInterface <Module>`
   - `php artisan module:make-repository <Model>Repository <Module>`
   - `php artisan module:make-service <Model>Service <Module>`
5. Bind the contract in the module's service provider:

```php
public function register(): void
{
    parent::register();

    $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
}
```

## Repository pattern

Layering is Controller → Service → Repository → Model. deptrac enforces it (see the `Repository` layer in `deptrac.php`).

- One contract per model in `Repositories/Contracts`, named `<Model>RepositoryInterface`.
- One Eloquent implementation per contract in `Repositories/Eloquent`, named `<Model>Repository`. The custom `module:make-repository` command in `app/Console/Commands` generates it with the import and `implements` clause already correct.
- Services type-hint contracts only. Controllers type-hint services only.
- Contracts are the only module code other modules may reference.

## Data access mode

Each module's `module.json` carries `conventions.dataAccess`:

- `eloquent` (default): repositories return Eloquent models, and models may flow through services.
- `dto`: repositories map to plain transfer objects. Services and controllers must not reference `Illuminate\Database\Eloquent`; the Arch test enforces this per module.

The declaration is enforced deterministically by `tests/Arch/ArchTest.php`, which reads every module.json. Switching a module's mode requires only editing the flag; the Arch test picks it up.

## Cross-module boundary

Default ruleset: a module may reference another module only through that module's `Repositories\Contracts` interfaces. The Arch test loops over modules and forbids every other internal namespace, so the rule fails loudly when a module reaches into another module's services, models, or Eloquent repositories.

This is a per-project decision point, not a permanent rule of the template. Projects that need shared kernels, events, or free access adjust the cross-module loop in `tests/Arch/ArchTest.php` and the concern layers in `deptrac.php` before the first commit.

## Tests

Module tests live in `Modules/<Name>/tests/{Unit,Feature}` and run with the rest of the suite. The Arch suite stays in root `tests/Arch` and covers both `App\` and `Modules\*`. The laravel preset is scoped to `App\*`; module equivalents live in ArchTest.

## Verification

`composer verify` runs pest in parallel and type coverage at 80 percent. Module code is in every gate's scope. Module factories and models carry `@extends` and `@use` docblocks per `.ai/rules/php-docblocks.md`, so phpstan needs no `Modules` ignore patterns.
