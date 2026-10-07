<?php

declare(strict_types=1);

namespace Modules\Users\Repositories\Eloquent;

use Modules\Users\Models\User;
use Modules\Users\Repositories\Contracts\UserRepositoryInterface;

final class UserRepository implements UserRepositoryInterface
{
    public function findByEmail(string $email): ?User
    {
        return User::query()->where('email', $email)->first();
    }

    public function save(User $user): User
    {
        $user->save();

        return $user;
    }

    public function count(): int
    {
        return User::query()->toBase()->count();
    }
}
