<?php

require __DIR__.'/../vendor/autoload.php';

use Dotenv\Dotenv;

Dotenv::createImmutable(dirname(__DIR__))->safeLoad();

$token = getenv('TEST_TOKEN');

if ($token === false || $token === '' || ($_ENV['DB_CONNECTION'] ?? null) !== 'pgsql') {
    return;
}

$database = 'testing_'.$token;

$pdo = new PDO(
    sprintf('pgsql:host=%s;port=%s;dbname=postgres', $_ENV['DB_HOST'], $_ENV['DB_PORT']),
    $_ENV['DB_USERNAME'],
    $_ENV['DB_PASSWORD'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);

$exists = $pdo->query('SELECT 1 FROM pg_database WHERE datname = '.$pdo->quote($database))->fetchColumn();

if (! $exists) {
    try {
        $pdo->exec('CREATE DATABASE "'.$database.'"');
    } catch (PDOException $e) {
        if (! str_contains($e->getMessage(), 'already exists')) {
            throw $e;
        }
    }
}

putenv("DB_DATABASE=$database");
$_ENV['DB_DATABASE'] = $database;
$_SERVER['DB_DATABASE'] = $database;
