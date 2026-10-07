<?php

declare(strict_types=1);

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * The Eloquent user behind the app's authentication.
 *
 * Mass assignment and hidden columns are declared with the
 * `#[Fillable]` and `#[Hidden]` attributes, not the `$fillable`
 * and `$hidden` properties.
 *
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at null until the user verifies the address
 * @property string $password stored hashed; assignment hashes the plaintext
 * @property string|null $remember_token
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
final class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Declares attribute casting for the model.
     *
     * `email_verified_at` reads back as a Carbon instance for date
     * math, and assigning `password` hashes the plaintext, so
     * callers never call Hash::make themselves.
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
