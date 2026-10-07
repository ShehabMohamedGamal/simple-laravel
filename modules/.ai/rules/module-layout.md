# Module layout

Covers: `Modules/**`.

- Follow the module folder layout: `Http/Controllers`, `Models`, `Providers`, `Repositories/Contracts`, `Repositories/Eloquent`, `Routes`, `Services`, `Database/Factories`, `Database/Migrations`, `Database/Seeders`, `config`, `tests/Feature`, `tests/Unit`.
- Capitalize `Database` because PSR-4 is case sensitive. Keep `config` and `tests` lowercase. Match every class folder to its namespace case.
- Give every module a `<Module>ServiceProvider` with `$name`, `$nameLower`, and a `$providers` array, plus a `RouteServiceProvider` that maps `Routes/web.php` into the `web` middleware group through `module_path()`.
- Keep the `module.json` manifest current: name, kebab alias, providers, and `conventions.dataAccess`. The Arch test reads `conventions.dataAccess`.
- Generate new classes from the stubs in `stubs/modules/`. They are the scaffold source of truth.
- Register a new module in `modules_statuses.json` before its code will load.
- Put module routes in the module's `Routes/web.php`, never in the root `routes/` files.
