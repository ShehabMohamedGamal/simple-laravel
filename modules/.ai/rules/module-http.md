# Module HTTP layer

Covers: `Modules/*/Http/**`, `Modules/*/Routes/**`.

- Keep controllers HTTP only: accept a request or form request, call a service, return a response. No business logic.
- Expose only RESTful methods: `index`, `show`, `create`, `store`, `edit`, `update`, `destroy`, plus `__construct` and `__invoke`. The Arch test rejects anything else.
- Validate through form requests in `Http/Requests`. They extend `Illuminate\Foundation\Http\FormRequest`, put rules in `rules()`, and keep `authorize()` to permission checks. Controllers never type-hint `Illuminate\Http\Request`.
- Never use the `DB` facade, `Illuminate\Database\Eloquent\Builder`, or `Illuminate\Database\Query\Builder` in controllers.
- Type-hint services for actions and save nothing from a controller. Type-hint models in signatures only for route-model binding.
- Route resources with `Route::resource('<plural-lower>', Controller::class)->names('<lower>')` in the module's `Routes/web.php`.
- Suffix controllers with `Controller`. The suffix is banned everywhere outside Controllers folders.
