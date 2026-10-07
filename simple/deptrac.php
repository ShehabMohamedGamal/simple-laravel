<?php

declare(strict_types=1);

use Deptrac\Deptrac\Contract\Config\Collector\DirectoryConfig;
use Deptrac\Deptrac\Contract\Config\DeptracConfig;
use Deptrac\Deptrac\Contract\Config\Layer;
use Deptrac\Deptrac\Contract\Config\Ruleset;

/**
 * Enforces a strict Controller -> Service -> Model layering for Laravel
 * projects, with Request/HttpResource/External/Policy/Job/Event/Listener
 * as additional layers. Service is the single "hub": every other layer
 * that needs to reach Model, External, Job, Event or Policy must go
 * through a Service method rather than doing it directly.
 *
 * Structural exceptions (not layering violations, just how the framework
 * works): Model->Model (Eloquent relationships), Job->Job (chaining),
 * HttpResource->HttpResource (nested resources), External->External
 * (composed SDK wrappers).
 *
 * Uncovered classes (Providers, Console Commands, Notifications,
 * Exceptions, Traits, Enums, ...) are intentionally left out of every
 * collector below. Deptrac does not report on classes that don't match
 * any layer, so they stay fully invisible to this ruleset by default.
 */
return static function (DeptracConfig $config): void {
    $config
        ->paths('./app')
        ->excludeFiles('#.*Test\.php$#')
        ->layers(
            // Controllers handle HTTP only. Middleware shares that same
            // job (no business logic, ever) so it's folded in here too.
            $controller = Layer::withName('Controller')->collectors(
                DirectoryConfig::create('app/Http/Controllers/.*'),
                DirectoryConfig::create('app/Http/Middleware/.*'),
            ),

            $service = Layer::withName('Service')->collectors(
                DirectoryConfig::create('app/Services/.*'),
            ),

            $model = Layer::withName('Model')->collectors(
                DirectoryConfig::create('app/Models/.*'),
            ),

            // FormRequest classes: validation + basic authorize() checks only.
            $request = Layer::withName('Request')->collectors(
                DirectoryConfig::create('app/Http/Requests/.*'),
            ),

            // API resource / response-shaping classes (JsonResource etc).
            $httpResource = Layer::withName('HttpResource')->collectors(
                DirectoryConfig::create('app/Http/Resources/.*'),
            ),

            // Third-party API clients / SDK wrappers. Sibling to Services,
            // not nested under it, so the collector boundary stays
            // unambiguous.
            $external = Layer::withName('External')->collectors(
                DirectoryConfig::create('app/External/.*'),
            ),

            $policy = Layer::withName('Policy')->collectors(
                DirectoryConfig::create('app/Policies/.*'),
            ),

            $job = Layer::withName('Job')->collectors(
                DirectoryConfig::create('app/Jobs/.*'),
            ),

            // Plain data-carrying event classes. Kept as a leaf layer.
            $event = Layer::withName('Event')->collectors(
                DirectoryConfig::create('app/Events/.*'),
            ),

            $listener = Layer::withName('Listener')->collectors(
                DirectoryConfig::create('app/Listeners/.*'),
            ),
        )
        ->rulesets(
            // Controller: orchestrates a request/response. Never touches
            // Model directly except via route-model-binding type-hints
            // (deptrac can't tell that apart from a manual query - that
            // distinction is a code review convention, not something this
            // ruleset enforces).
            Ruleset::forLayer($controller)->accesses($service, $request, $httpResource, $model),

            // Service is the hub: the only layer allowed to reach Model,
            // External, Job, Event and Policy for real business purposes.
            Ruleset::forLayer($service)->accesses($model, $external, $service, $job, $event, $policy),

            // Eloquent relationships reference other Models - structural,
            // not a layering violation.
            Ruleset::forLayer($model)->accesses($model),

            // Pure leaf: no outgoing dependencies allowed.
            Ruleset::forLayer($request),

            // A Resource needs to read a Model to shape it, and resources
            // commonly compose other resources for nested relations.
            Ruleset::forLayer($httpResource)->accesses($model, $httpResource),

            // Composed SDK wrappers are allowed; reaching back into the
            // app (Model, Service, ...) is not - External is a leaf
            // otherwise.
            Ruleset::forLayer($external)->accesses($external),

            // A Policy reads Model state to make an authorization decision.
            Ruleset::forLayer($policy)->accesses($model),

            // A Job's handle() calls back into a Service to do the real
            // work, and may chain into a follow-up Job.
            Ruleset::forLayer($job)->accesses($service, $job),

            // Pure leaf: no outgoing dependencies allowed.
            Ruleset::forLayer($event),

            // A Listener orchestrates via Service and may dispatch a Job,
            // but must not fire a new Event or reach Model/External
            // directly - that goes through Service.
            Ruleset::forLayer($listener)->accesses($service, $job),
        );
};
