<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Users\Http\Controllers\UsersController;

Route::resource('users', UsersController::class)->names('users');
