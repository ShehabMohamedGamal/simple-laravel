<?php

// Report-only helper: strips noise from tool JSON arriving on stdin.
// Drops pint's "about" header and the TIA "Experimental mode" prefix in
// pao raw lines, keeping the useful affected-tests part. Non-JSON input
// passes through unchanged. Exit 0 always.

$in = trim((string) stream_get_contents(STDIN));
$data = json_decode($in, true);

if (! is_array($data)) {
    echo $in === '' ? '' : $in."\n";
    exit(0);
}

unset($data['about']);

$raw = $data['raw'] ?? null;
if (is_array($raw)) {
    $kept = [];
    foreach ($raw as $line) {
        $line = trim((string) $line);
        if ($line === 'Experimental TIA mode enabled.') {
            continue;
        }
        $kept[] = str_replace('Experimental TIA mode enabled / ', '', $line);
    }
    $data['raw'] = array_values($kept);
}

echo json_encode($data, JSON_UNESCAPED_SLASHES), "\n";
exit(0);
