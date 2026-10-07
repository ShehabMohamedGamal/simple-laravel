<?php

use App\Console\Commands\ModuleRepositoryMakeCommand;
use Nwidart\Modules\Activators\FileActivator;
use Nwidart\Modules\Providers\ConsoleServiceProvider;

return [
    'namespace' => 'Modules',

    'vapor_maintenance_mode' => env('VAPOR_MAINTENANCE_MODE', false),

    'stubs' => [
        'enabled' => true,
        'path' => base_path('stubs/modules'),
        'files' => [
            'routes/web' => 'Routes/web.php',
            'scaffold/config' => 'config/config.php',
        ],
        'replacements' => [
            'json' => ['LOWER_NAME', 'STUDLY_NAME', 'KEBAB_NAME', 'MODULE_NAMESPACE', 'PROVIDER_NAMESPACE'],
            'routes/web' => ['LOWER_NAME', 'STUDLY_NAME', 'PLURAL_LOWER_NAME', 'KEBAB_NAME', 'MODULE_NAMESPACE', 'CONTROLLER_NAMESPACE'],
            'scaffold/config' => ['STUDLY_NAME'],
        ],
        'gitkeep' => true,
    ],

    'paths' => [
        'modules' => base_path('Modules'),

        'assets' => public_path('modules'),

        'migration' => base_path('database/migrations'),

        'app_folder' => '',

        'generator' => [
            'provider' => ['path' => 'Providers', 'generate' => true],
            'route-provider' => ['path' => 'Providers', 'generate' => true],
            'event-provider' => ['path' => 'Events', 'generate' => false],

            'controller' => ['path' => 'Http/Controllers', 'generate' => true],
            'filter' => ['path' => 'Http/Middleware', 'generate' => false],
            'request' => ['path' => 'Http/Requests', 'generate' => false],
            'resource' => ['path' => 'Http/Resources', 'generate' => false],

            'model' => ['path' => 'Models', 'generate' => true],
            'services' => ['path' => 'Services', 'generate' => true],
            'repository' => ['path' => 'Repositories/Eloquent', 'generate' => true, 'namespace' => 'Repositories\\Eloquent'],
            'interfaces' => ['path' => 'Repositories/Contracts', 'generate' => true, 'namespace' => 'Repositories\\Contracts'],

            'config' => ['path' => 'config', 'generate' => true],

            'lang' => ['path' => 'lang', 'generate' => false],
            'views' => ['path' => 'resources/views', 'generate' => false],

            'factory' => ['path' => 'Database/Factories', 'generate' => true],
            'migration' => ['path' => 'Database/Migrations', 'generate' => true],
            'seeder' => ['path' => 'Database/Seeders', 'generate' => true],

            'routes' => ['path' => 'Routes', 'generate' => true],

            'test-feature' => ['path' => 'tests/Feature', 'generate' => true],
            'test-unit' => ['path' => 'tests/Unit', 'generate' => true],
        ],
    ],

    'auto-discover' => [
        'migrations' => true,
        'translations' => false,
    ],

    'commands' => ConsoleServiceProvider::defaultCommands()
        ->merge([
            ModuleRepositoryMakeCommand::class,
        ])->toArray(),

    'scan' => [
        'enabled' => false,
        'paths' => [
            base_path('vendor/*/*'),
        ],
    ],

    'composer' => [
        'vendor' => env('MODULE_VENDOR', 'nwidart'),
        'author' => [
            'name' => env('MODULE_AUTHOR_NAME', 'Nicolas Widart'),
            'email' => env('MODULE_AUTHOR_EMAIL', 'n.widart@gmail.com'),
        ],
        'composer-output' => false,
    ],

    'register' => [
        'translations' => true,
        'files' => 'register',
    ],

    'activators' => [
        'file' => [
            'class' => FileActivator::class,
            'statuses-file' => base_path('modules_statuses.json'),
        ],
    ],

    'activator' => 'file',

    'inertia' => [
        'frontend' => 'vue',
    ],
];
