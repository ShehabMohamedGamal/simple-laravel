<?php

declare(strict_types=1);

namespace Modules\Users\Repositories\Contracts;

use Modules\Users\Models\User;

interface UserRepositoryInterface
{
    public function findByEmail(string $email): ?User;

    public function save(User $user): User;

    public function count(): int;
}
