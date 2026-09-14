<?php

/*
|--------------------------------------------------------------------------
| Architecture Rules
|--------------------------------------------------------------------------
|
| Executable spec for this app's conventions and vendor boundaries.
| Layering (who may depend on whom) lives in deptrac.php and is enforced
| there; this file covers what deptrac cannot see: framework presets,
| naming suffixes, and vendor-namespace restrictions.
|
*/

// --- Baseline presets --------------------------------------------------------
// php():     no die/dump/deprecated functions        — requires ext-intl
// security(): no eval/md5/other unsafe builtins
// laravel():  Laravel conventions (Controller suffix, REST-only public
//             methods, etc.)
// strict():   strict_types everywhere + all classes final. Services are
//             exempted from "final" (via ignoring()) so they can still be
//             mocked directly in tests — that's the intended escape hatch,
//             not a loophole, so keep it scoped to App\Services only.

arch()->preset()->php();
arch()->preset()->security();
arch()->preset()->laravel();

// --- Controllers: vendor boundaries deptrac cannot see ----------------------

arch('controllers do not touch the database directly')
    ->expect('App\Http\Controllers')
    ->not->toUse([
        'Illuminate\Support\Facades\DB',
        'Illuminate\Database\Eloquent\Builder',
        'Illuminate\Database\Query\Builder',
    ]);

arch('controllers validate through form requests, not inline')
    ->expect('App\Http\Controllers')
    ->not->toUse('Illuminate\Http\Request');

// --- Services: business logic, framework-agnostic ---------------------------

arch('services are suffixed correctly')
    ->expect('App\Services')
    ->toHaveSuffix('Service');

// --- Requests & Resources: presentation-layer helpers ------------------------

arch('form requests are suffixed correctly')
    ->expect('App\Http\Requests')
    ->toHaveSuffix('Request');

arch('resources are suffixed correctly')
    ->expect('App\Http\Resources')
    ->toHaveSuffix('Resource');

// --- Optional: only relevant if you organize traits into Traits/ folders ----

arch('traits folders only contain traits')
    ->expect('App\*\Traits')
    ->toBeTraits();
