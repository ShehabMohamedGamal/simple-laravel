<?php

it('asserts that true is true', function () {
    $value = boolval(config('app.env'));

    expect($value)->toBeTrue();
});
