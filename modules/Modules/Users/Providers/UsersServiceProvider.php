<?php

declare(strict_types=1);

namespace Modules\Users\Providers;

use Modules\Users\Repositories\Contracts\UserRepositoryInterface;
use Modules\Users\Repositories\Eloquent\UserRepository;
use Nwidart\Modules\Support\ModuleServiceProvider;

final class UsersServiceProvider extends ModuleServiceProvider
{
    protected string $name = 'Users';

    protected string $nameLower = 'users';

    protected array $providers = [
        RouteServiceProvider::class,
    ];

    public function register(): void
    {
        parent::register();

        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
    }
}
