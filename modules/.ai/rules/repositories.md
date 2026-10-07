# Repositories and services

Covers: `Modules/**`.

- Name contracts `<Model>RepositoryInterface` in `Repositories/Contracts/` and implementations `<Model>Repository` in `Repositories/Eloquent/`.
- Make repositories `final` with `declare(strict_types=1);` and implement the contract.
- Bind each contract to its implementation in the module provider's `register()`: `$this->app->bind(UserRepositoryInterface::class, UserRepository::class);`.
- Keep all persistence queries inside repositories. Build them with `Model::query()` and never use the `DB` facade. Never call `new Model` inside a repository.
- Instantiate models in services and persist them through the repository contract: `new User([...])` then `$this->users->save($user)`.
- Type-hint repository contracts in service constructors, never implementations. Make services `final readonly`.
- Reference other modules only through their `Repositories\Contracts` namespaces. Every other module's namespace is off limits.
