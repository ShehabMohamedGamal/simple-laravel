# App architecture

Covers: `app/**`.

- Build the app from ten layers, one folder each: `app/Http/Controllers` (middleware included), `app/Services`, `app/Models`, `app/Http/Requests`, `app/Http/Resources`, `app/External`, `app/Policies`, `app/Jobs`, `app/Events`, `app/Listeners`. deptrac enforces the map.
- Treat `Service` as the single hub. Anything that needs `Model`, `External`, `Job`, `Event`, or `Policy` goes through a service method.
- Keep the allowed edges: Controller to Service, Request, Resource, and Model; Service to Model, External, Service, Job, Event, and Policy; Model to Model; Resource to Model and Resource; Policy to Model; Job and Listener to Service and Job.
- Keep `Request`, `Event`, and `External` classes as leaves with no outgoing dependencies, except External composing other External classes.
- Keep controllers HTTP only. Never use the `DB` facade, `Illuminate\Database\Eloquent\Builder`, or `Illuminate\Database\Query\Builder` in them. No business logic in controllers or middleware.
- Validate through form requests in `app/Http/Requests`. They extend `Illuminate\Foundation\Http\FormRequest`, put rules in `rules()`, and keep `authorize()` to permission checks. Controllers never type-hint `Illuminate\Http\Request`.
- Type-hint models in controller signatures only for route-model binding. Never query a model from a controller.
- Read models and shape responses with resources in `app/Http/Resources`.
- Suffix classes by folder: `Service` in `app/Services`, `Request` in `app/Http/Requests`, `Resource` in `app/Http/Resources`. The suffixes are banned outside their folders.
- Use the structural exceptions sparingly: Model to Model for relations, Job to Job for chaining, Resource to Resource for nesting, External to External for composed SDKs.
