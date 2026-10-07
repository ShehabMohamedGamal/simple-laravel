<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Support\Str;
use Nwidart\Modules\Commands\Make\RepositoryMakeCommand;
use Nwidart\Modules\Module;
use Nwidart\Modules\Support\Stub;

/**
 * Generates an Eloquent repository bound to its contract inside one module.
 *
 * Extends nwidart's repository generator to render the branch's own
 * repository stub, so every generated repository pairs with the
 * interface module consumers are meant to depend on.
 */
final class ModuleRepositoryMakeCommand extends RepositoryMakeCommand
{
    /** The line `artisan list` shows for this command. */
    protected $description = 'Create an Eloquent repository implementing its contract for the specified module.';

    /**
     * Renders the repository stub for the requested module.
     *
     * Fills the stub's contract placeholder from the module's own
     * contract namespace, keeping repository and interface in the
     * same module.
     */
    protected function getTemplateContents(): string
    {
        $module = $this->laravel['modules']->findOrFail($this->getModuleName());
        $class = class_basename(Str::studly($this->argument('name')));

        return (new Stub('/repository.stub', [
            'CLASS_NAMESPACE' => $this->getClassNamespace($module),
            'CONTRACT_NAMESPACE' => $this->contractNamespace($module),
            'CLASS' => $class,
            'CONTRACT' => $class.'Interface',
        ]))->render();
    }

    /**
     * Reads the module's contract namespace from the modules config.
     *
     * Falls back to `Repositories\Contracts` when the project has no
     * override, matching the layout `docs/module-structure.md` fixes.
     */
    private function contractNamespace(Module $module): string
    {
        return $this->module_namespace(
            $module->getStudlyName(),
            config('modules.paths.generator.interfaces.namespace', 'Repositories\\Contracts'),
        );
    }
}
