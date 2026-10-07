<?php

declare(strict_types=1);

namespace Modules\Users\Tests\Feature;

use Modules\Users\Models\User;
use Modules\Users\Repositories\Contracts\UserRepositoryInterface;
use Modules\Users\Services\UserService;

it('binds the repository contract to the Eloquent implementation', function (): void {
    expect(app()->bound(UserRepositoryInterface::class))->toBeTrue();
});

it('registers a user through the service', function (): void {
    app(UserService::class)->register('Ada Lovelace', 'ada@example.test', 'secret-password');

    $repo = app(UserRepositoryInterface::class);

    expect($repo->count())->toBe(1)
        ->and($repo->findByEmail('ada@example.test'))->not->toBeNull();
});

it('finds a user by email through the repository', function (): void {
    User::factory()->create(['email' => 'find-me@example.test']);

    $found = app(UserRepositoryInterface::class)->findByEmail('find-me@example.test');

    expect($found)->toBeInstanceOf(User::class)
        ->and($found->getAttribute('email'))->toBe('find-me@example.test');
});
