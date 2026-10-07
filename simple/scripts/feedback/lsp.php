<?php

// Report-only: prints laravel-lsp diagnostics for the staged app files.
// The server speaks LSP over stdio and gives no done signal, so the run
// ends when every staged file has published diagnostics or on timeout.
// Exit 0 in every path; never fails the verify chain.

$staged = array_values(array_filter(
    explode("\n", (string) shell_exec('git diff --cached --name-only --relative --diff-filter=ACM -- app')),
    fn (string $f): bool => str_ends_with($f, '.php') && is_file($f),
));

if ($staged === []) {
    echo "lsp: no app files staged; nothing to report.\n";
    exit(0);
}

$bin = getenv('LARAVEL_LSP_BIN') ?: 'laravel-lsp';
$bin = trim((string) shell_exec('command -v '.escapeshellarg($bin).' 2>/dev/null'))
    ?: implode('/', [getenv('HOME'), '.config/composer/vendor/bin', basename($bin)]);
if (! is_executable($bin)) {
    echo "lsp: laravel-lsp not installed; nothing to report.\n";
    exit(0);
}

$root = getcwd();
$uri = fn (string $file): string => 'file://'.str_replace(' ', '%20', $root.'/'.$file);

// Frames one JSON-RPC message with LSP Content-Length headers.
$send = function ($out, array $message): void {
    $body = json_encode($message, JSON_UNESCAPED_SLASHES);
    fwrite($out, 'Content-Length: '.strlen($body)."\r\n\r\n".$body);
};

// Reads up to $n bytes, honouring the deadline; null on timeout or EOF.
$read = function ($stream, int $n, float $deadline): ?string {
    $data = '';
    while (strlen($data) < $n) {
        $remaining = $deadline - microtime(true);
        if ($remaining <= 0) {
            return null;
        }
        $secs = (int) $remaining;
        $r = [$stream];
        if (! stream_select($r, $unusedW, $unusedE, $secs, (int) (($remaining - $secs) * 1000000))) {
            return null;
        }
        $chunk = fread($stream, $n - strlen($data));
        if ($chunk === false || $chunk === '') {
            return strlen($data) > 0 ? $data : null;
        }
        $data .= $chunk;
    }

    return $data;
};

// Reads one framed message; null on timeout or EOF.
$recv = function ($stream, float $deadline) use ($read): ?array {
    $head = '';
    while (! str_contains($head, "\r\n\r\n")) {
        $byte = $read($stream, 1, $deadline);
        if ($byte === null) {
            return null;
        }
        $head .= $byte;
    }
    preg_match('/Content-Length: (\d+)/', $head, $m);
    $body = $read($stream, (int) ($m[1] ?? 0), $deadline);

    return $body === null ? null : json_decode($body, true);
};

// Answers a server-to-client request with null (empty items for
// workspace/configuration) so the server never blocks waiting on us.
$answer = function ($stdin, array $message) use ($send): void {
    if (! isset($message['id']) || ($message['method'] ?? '') === '') {
        return;
    }
    $items = $message['params']['items'] ?? [];
    $result = $message['method'] === 'workspace/configuration'
        ? array_fill(0, count($items), null)
        : null;
    $send($stdin, ['jsonrpc' => '2.0', 'id' => $message['id'], 'result' => $result]);
};

$process = proc_open(
    escapeshellcmd($bin).' 2>/dev/null',
    [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
    $pipes,
    $root,
);

if (! is_resource($process)) {
    echo "lsp: failed to start laravel-lsp.\n";
    exit(0);
}

$diagnostics = [];
try {
    $stdin = $pipes[0];
    $stdout = $pipes[1];
    $deadline = microtime(true) + 60;

    $send($stdin, [
        'jsonrpc' => '2.0',
        'id' => 1,
        'method' => 'initialize',
        'params' => [
            'processId' => getmypid(),
            'rootUri' => $uri(''),
            'capabilities' => new stdClass,
            'initializationOptions' => new stdClass,
        ],
    ]);

    $ready = false;
    while (! $ready && microtime(true) < $deadline) {
        $message = $recv($stdout, $deadline);
        if ($message === null) {
            break;
        }
        if (($message['id'] ?? null) === 1 && ! isset($message['method'])) {
            $ready = true;

            continue;
        }
        $answer($stdin, $message);
    }

    $pending = [];
    if ($ready) {
        $send($stdin, ['jsonrpc' => '2.0', 'method' => 'initialized', 'params' => new stdClass]);
        $pending = array_map($uri, $staged);
        foreach ($staged as $file) {
            $send($stdin, [
                'jsonrpc' => '2.0',
                'method' => 'textDocument/didOpen',
                'params' => [
                    'textDocument' => [
                        'uri' => $uri($file),
                        'languageId' => 'php',
                        'version' => 1,
                        'text' => (string) file_get_contents($file),
                    ],
                ],
            ]);
        }
    }

    // Wait for one publishDiagnostics per staged file with a fresh
    // idle deadline; the server may publish an empty set, which counts.
    $deadline = microtime(true) + 60;
    while ($pending !== [] && microtime(true) < $deadline) {
        $message = $recv($stdout, $deadline);
        if ($message === null) {
            break;
        }
        if (($message['method'] ?? '') === 'textDocument/publishDiagnostics') {
            $u = $message['params']['uri'] ?? '';
            $diagnostics[$u] = $message['params']['diagnostics'] ?? [];
            $pending = array_values(array_diff($pending, [$u]));

            continue;
        }
        $answer($stdin, $message);
    }
} catch (Throwable $e) {
    echo "lsp: protocol failure ({$e->getMessage()}); partial results only.\n";
} finally {
    $send($stdin, ['jsonrpc' => '2.0', 'id' => 2, 'method' => 'shutdown']);
    $send($stdin, ['jsonrpc' => '2.0', 'method' => 'exit']);
    fclose($stdin);
    proc_terminate($process);
    proc_close($process);
}

$rows = [];
foreach ($diagnostics as $u => $items) {
    $file = str_starts_with($u, 'file://'.$root.'/') ? substr($u, strlen($root) + 8) : $u;
    foreach ($items as $d) {
        $rows[] = sprintf('lsp=%s:%d: %s', $file, ($d['range']['start']['line'] ?? 0) + 1, trim((string) ($d['message'] ?? '')));
    }
}

if ($rows === []) {
    echo "lsp: no diagnostics.\n";
    exit(0);
}
sort($rows);
echo implode("\n", $rows), "\n";
exit(0);
