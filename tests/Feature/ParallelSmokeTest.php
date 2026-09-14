<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;

it('writes to its own process database', function () {
    expect(getenv('DB_DATABASE'))->toStartWith('testing');

    User::factory()->create(['email' => 'parallel-smoke@example.test']);

    expect(DB::table('users')->count())->toBe(1);
});
