<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\App;
use Illuminate\Support\ServiceProvider;

/**
 * The app's single service provider.
 *
 * It turns lazy loading into an error everywhere except production:
 * a missed eager load is a bug while code runs under test and
 * review, while production traffic prefers a slow query over a
 * failed request.
 */
final class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Applies the app-wide strictness settings.
     *
     * Lives in boot so the setting is in place before any model
     * handles a request.
     */
    public function boot(): void
    {
        Model::preventLazyLoading(! App::environment('production'));
    }
}
