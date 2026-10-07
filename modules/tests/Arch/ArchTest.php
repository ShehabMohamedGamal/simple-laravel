<?php

declare(strict_types=1);

arch()->preset()->php();
arch()->preset()->security();
arch()->preset()->laravel()->ignoring('Modules');

arch('controllers do not touch the database directly')
    ->expect(['App\Http\Controllers', 'Modules\*\Http\Controllers'])
    ->not->toUse([
        'Illuminate\Support\Facades\DB',
        'Illuminate\Database\Eloquent\Builder',
        'Illuminate\Database\Query\Builder',
    ]);

arch('controllers validate through form requests, not inline')
    ->expect(['App\Http\Controllers', 'Modules\*\Http\Controllers'])
    ->not->toUse('Illuminate\Http\Request');

$moduleDataAccess = moduleDataAccessModes();
$modules = array_keys($moduleDataAccess);

$moduleFolders = static fn (string $folder): array => array_map(
    static fn (string $module): string => "Modules\\{$module}\\{$folder}",
    $modules,
);

if (hasModuleFolder('Enums')) {
    arch('modules declare no enums outside their Enums folders')
        ->expect('Modules')
        ->not->toBeEnums()
        ->ignoring($moduleFolders('Enums'));

    arch('module enums folders only contain enums')
        ->expect('Modules\*\Enums')
        ->toBeEnums();
}

if (hasModuleFolder('Exceptions')) {
    arch('module exceptions implement Throwable')
        ->expect('Modules\*\Exceptions')
        ->classes()
        ->toImplement(Throwable::class);

    arch('module classes implement Throwable only in Exceptions folders')
        ->expect('Modules')
        ->not->toImplement(Throwable::class)
        ->ignoring($moduleFolders('Exceptions'));
}

if (hasModuleFolder('Http/Middleware')) {
    arch('module middleware have a handle method')
        ->expect('Modules\*\Http\Middleware')
        ->classes()
        ->toHaveMethod('handle');
}

if (hasModuleFolder('Models')) {
    arch('module models extend Eloquent')
        ->expect('Modules\*\Models')
        ->classes()
        ->toExtend('Illuminate\Database\Eloquent\Model')
        ->ignoring(array_map(
            static fn (string $module): string => "Modules\\{$module}\\Models\\Scopes",
            $modules,
        ));

    arch('module models are not suffixed Model')
        ->expect('Modules\*\Models')
        ->classes()
        ->not->toHaveSuffix('Model');

    arch('module classes extend Model only inside Models folders')
        ->expect('Modules')
        ->not->toExtend('Illuminate\Database\Eloquent\Model')
        ->ignoring($moduleFolders('Models'));
}

if (hasModuleFolder('Http/Requests')) {
    arch('module requests are suffixed Request')
        ->expect('Modules\*\Http\Requests')
        ->classes()
        ->toHaveSuffix('Request');

    arch('module requests extend FormRequest')
        ->expect('Modules\*\Http\Requests')
        ->classes()
        ->toExtend('Illuminate\Foundation\Http\FormRequest');

    arch('module requests define rules')
        ->expect('Modules\*\Http\Requests')
        ->toHaveMethod('rules');
}

if (hasModuleFolder('Providers')) {
    arch('module providers are suffixed ServiceProvider')
        ->expect('Modules\*\Providers')
        ->classes()
        ->toHaveSuffix('ServiceProvider');

    arch('module providers extend ServiceProvider')
        ->expect('Modules\*\Providers')
        ->classes()
        ->toExtend('Illuminate\Support\ServiceProvider');

    arch('module classes extend ServiceProvider only in Providers folders')
        ->expect('Modules')
        ->not->toExtend('Illuminate\Support\ServiceProvider')
        ->ignoring($moduleFolders('Providers'));

    arch('module classes are not suffixed ServiceProvider outside Providers folders')
        ->expect('Modules')
        ->not->toHaveSuffix('ServiceProvider')
        ->ignoring($moduleFolders('Providers'));
}

if (hasModuleFolder('Http/Controllers')) {
    arch('module controllers are suffixed Controller')
        ->expect('Modules\*\Http\Controllers')
        ->classes()
        ->toHaveSuffix('Controller');

    arch('module classes are not suffixed Controller outside Controllers folders')
        ->expect('Modules')
        ->not->toHaveSuffix('Controller')
        ->ignoring($moduleFolders('Http\Controllers'));

    arch('module controllers expose only RESTful methods')
        ->expect('Modules\*\Http\Controllers')
        ->not->toHavePublicMethodsBesides(['__construct', '__invoke', 'index', 'show', 'create', 'store', 'edit', 'update', 'destroy', 'middleware']);
}

if (hasModuleFolder('Policies')) {
    arch('module policies are suffixed Policy')
        ->expect('Modules\*\Policies')
        ->classes()
        ->toHaveSuffix('Policy');
}

if (hasModuleFolder('Traits')) {
    arch('module traits folders only contain traits')
        ->expect('Modules\*\Traits')
        ->toBeTraits();
}

if (hasModuleFolder('Services')) {
    arch('module services are suffixed Service')
        ->expect('Modules\*\Services')
        ->toHaveSuffix('Service');
}

if (hasModuleFolder('Repositories/Contracts')) {
    arch('module repository contracts are suffixed Interface')
        ->expect('Modules\*\Repositories\Contracts')
        ->toHaveSuffix('Interface');
}

foreach ($moduleDataAccess as $module => $mode) {
    if ($mode === 'dto') {
        arch("{$module} declares dto data access and keeps Eloquent out of services and controllers")
            ->expect(["Modules\\{$module}\\Http", "Modules\\{$module}\\Services"])
            ->not->toUse('Illuminate\Database\Eloquent');
    }
}

foreach ($modules as $module) {
    if (count($modules) < 2) {
        continue;
    }

    $forbidden = [];

    foreach ($modules as $other) {
        if ($other === $module) {
            continue;
        }

        foreach (moduleInternalNamespaces($other) as $namespace) {
            $forbidden[] = $namespace;
        }
    }

    arch("{$module} touches other modules only through their contracts")
        ->expect("Modules\\{$module}")
        ->not->toUse($forbidden)
        ->ignoring("Modules\\{$module}\\Tests");
}

/**
 * @return array<string, string> the declared data access mode per module
 */
function moduleDataAccessModes(): array
{
    $modes = [];
    $manifestPaths = glob(__DIR__.'/../../Modules/*/module.json');
    $manifestPaths = $manifestPaths === false ? [] : $manifestPaths;

    foreach ($manifestPaths as $path) {
        $manifest = json_decode((string) file_get_contents($path), true);
        $module = basename(dirname($path));
        $modes[$module] = $manifest['conventions']['dataAccess'] ?? 'eloquent';
    }

    return $modes;
}

function hasModuleFolder(string $folder): bool
{
    return glob(__DIR__.'/../../Modules/*/'.$folder) !== [];
}

/**
 * @return array<int, string> the code namespaces the module owns, contracts included
 */
function moduleInternalNamespaces(string $module): array
{
    $unnamespaced = ['tests', 'routes', 'config', 'resources', 'lang', 'storage'];
    $base = __DIR__.'/../../Modules/'.mb_strtolower($module);
    $namespaces = [];
    $dirs = glob($base.'/*', GLOB_ONLYDIR);
    $dirs = $dirs === false ? [] : $dirs;

    foreach ($dirs as $dir) {
        $name = basename($dir);

        if (in_array($name, $unnamespaced, true)) {
            continue;
        }

        $studly = str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $name)));
        $namespaces[] = "Modules\\{$module}\\{$studly}";
    }

    $namespaces[] = "Modules\\{$module}\\Repositories\\Eloquent";

    return $namespaces;
}
