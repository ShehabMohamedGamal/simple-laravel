<?php

declare(strict_types=1);

namespace Modules\Users\Services;

use Modules\Users\Models\User;
use Modules\Users\Repositories\Contracts\UserRepositoryInterface;

final readonly class UserService
{
    public function __construct(private UserRepositoryInterface $users) {}

    public function register(string $name, string $email, string $password): User
    {
        $user = new User([
            'name' => $name,
            'email' => $email,
            'password' => $password,
        ]);

        return $this->users->save($user);
    }

    public function count(): int
    {
        return $this->users->count();
    }
}
