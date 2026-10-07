<?php

namespace App\Http\Controllers;

/**
 * Base class for all HTTP controllers.
 *
 * The base stays empty on purpose: controllers stay HTTP only, and
 * cross-cutting behavior belongs in middleware and services, not in
 * an inheritance chain.
 */
abstract class Controller
{
    //
}
