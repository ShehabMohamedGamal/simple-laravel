<?php

// Report-only: prints app/ classes, interfaces, traits, enums, methods,
// and properties missing a docblock, then a coverage summary. A docblock
// attaches when it is the nearest preceding doc comment and only
// modifiers, attributes, comments, or blank lines sit between it and the
// declaration. Anonymous classes, closures, arrow functions, and
// promoted constructor parameters are never reported. Exit 0 always;
// never fails the verify chain.

$root = getcwd();
$files = [];
$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($root.'/app', FilesystemIterator::SKIP_DOTS),
);
foreach ($iterator as $file) {
    if ($file->isFile() && $file->getExtension() === 'php') {
        $files[] = substr($file->getPathname(), strlen($root) + 1);
    }
}
sort($files);

$missing = [];
$total = 0;
foreach ($files as $file) {
    $tokens = token_get_all((string) file_get_contents($root.'/'.$file));
    foreach (symbolAnchors($tokens) as $anchor) {
        $total++;
        if (! hasAttachedDocblock($tokens, $anchor['index'])) {
            $missing[] = sprintf('%s:%d: %s %s docblock missing', $file, $anchor['line'], $anchor['kind'], $anchor['name']);
        }
    }
}

foreach ($missing as $line) {
    echo $line, "\n";
}
$percent = $total === 0 ? 100 : (int) round(($total - count($missing)) / $total * 100);
printf("coverage: %d/%d symbols documented (%d%%)\n", $total - count($missing), $total, $percent);
exit(0);

// Maps every tracked declaration to its anchor token: the class,
// interface, trait, enum, or function keyword, or the property variable.
function symbolAnchors(array $tokens): array
{
    $anchors = [];
    $kindByToken = [
        T_CLASS => 'CLASS',
        T_INTERFACE => 'INTERFACE',
        T_TRAIT => 'TRAIT',
        T_ENUM => 'ENUM',
    ];
    $brace = 0;
    $paren = 0;
    $awaitBody = false;
    $bodies = [];

    $count = count($tokens);
    for ($i = 0; $i < $count; $i++) {
        $token = $tokens[$i];
        if (is_string($token)) {
            if ($token === '{') {
                $brace++;
                if ($awaitBody) {
                    $bodies[] = $brace;
                    $awaitBody = false;
                }
            } elseif ($token === '}') {
                $brace--;
                while ($bodies !== [] && $brace < $bodies[count($bodies) - 1]) {
                    array_pop($bodies);
                }
            } elseif ($token === '(') {
                $paren++;
            } elseif ($token === ')') {
                $paren--;
            }

            continue;
        }
        [$id, $text, $line] = $token;
        if (in_array($id, [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
            continue;
        }
        if ($id === T_ATTRIBUTE) {
            $i = attributeEnd($tokens, $i);

            continue;
        }
        if (isset($kindByToken[$id])) {
            if ($id === T_CLASS && classConstantContext($tokens, $i)) {
                continue;
            }
            $nameIndex = nextSignificant($tokens, $i + 1);
            if ($nameIndex !== null && is_array($tokens[$nameIndex]) && $tokens[$nameIndex][0] === T_STRING) {
                $anchors[] = ['kind' => $kindByToken[$id], 'name' => $tokens[$nameIndex][1], 'line' => $line, 'index' => $i];
            }
            $awaitBody = true;

            continue;
        }
        if ($id === T_FUNCTION) {
            $nameIndex = nextSignificant($tokens, $i + 1);
            if ($nameIndex !== null && is_array($tokens[$nameIndex]) && in_array($tokens[$nameIndex][0], [T_AMPERSAND_NOT_FOLLOWED_BY_VAR_OR_VARARG, T_AMPERSAND_FOLLOWED_BY_VAR_OR_VARARG], true)) {
                $nameIndex = nextSignificant($tokens, $nameIndex + 1);
            }
            $inBody = $bodies !== [] && $brace === $bodies[count($bodies) - 1] && $paren === 0;
            if ($nameIndex !== null && is_array($tokens[$nameIndex]) && $tokens[$nameIndex][0] === T_STRING && $inBody) {
                $anchors[] = ['kind' => 'METHOD', 'name' => $tokens[$nameIndex][1], 'line' => $line, 'index' => $i];
            }

            continue;
        }
        if ($id === T_VARIABLE && $bodies !== [] && $brace === $bodies[count($bodies) - 1] && $paren === 0) {
            $anchors[] = ['kind' => 'PROPERTY', 'name' => ltrim($text, '$'), 'line' => $line, 'index' => $i];
        }
    }

    return $anchors;
}

// True when the docblock directly before the anchored declaration is the
// nearest one and nothing but modifiers, attributes, property types,
// comments, or blank lines separates them. The walk never crosses a
// statement boundary (; { }), so type tokens can only belong to the
// anchored property.
function hasAttachedDocblock(array $tokens, int $index): bool
{
    $typeTokens = [T_STRING, T_ARRAY, T_CALLABLE, T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED, T_NS_SEPARATOR, T_STATIC, T_AMPERSAND_NOT_FOLLOWED_BY_VAR_OR_VARARG, T_AMPERSAND_FOLLOWED_BY_VAR_OR_VARARG];
    $nest = 0;
    for ($i = $index - 1; $i >= 0; $i--) {
        $token = $tokens[$i];
        if ($nest > 0) {
            if (is_string($token)) {
                if ($token === ']') {
                    $nest++;
                } elseif ($token === '[') {
                    $nest--;
                }
            } elseif ($token[0] === T_ATTRIBUTE) {
                $nest--;
            }

            continue;
        }
        if (is_string($token)) {
            if ($token === ']') {
                $nest = 1;

                continue;
            }
            if (in_array($token, ['?', '|', '&', '(', ')'], true)) {
                continue;
            }

            return false;
        }
        if (in_array($token[0], [T_WHITESPACE, T_COMMENT, T_PUBLIC, T_PROTECTED, T_PRIVATE, T_STATIC, T_READONLY, T_VAR, T_ABSTRACT, T_FINAL], true)) {
            continue;
        }
        if ($token[0] === T_ATTRIBUTE) {
            $nest = 1;

            continue;
        }
        if (in_array($token[0], $typeTokens, true)) {
            continue;
        }

        return $token[0] === T_DOC_COMMENT;
    }

    return false;
}

// Index of the token closing the attribute that opens at $open.
function attributeEnd(array $tokens, int $open): int
{
    $nest = 1;
    $count = count($tokens);
    for ($i = $open + 1; $i < $count; $i++) {
        $token = $tokens[$i];
        if (is_string($token)) {
            if ($token === '[') {
                $nest++;
            } elseif ($token === ']' && --$nest === 0) {
                return $i;
            }
        }
    }

    return $count - 1;
}

// Index of the next token that is not whitespace or a comment; null at
// end of stream.
function nextSignificant(array $tokens, int $from): ?int
{
    $count = count($tokens);
    for ($i = $from; $i < $count; $i++) {
        $token = $tokens[$i];
        if (is_string($token) || ! in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
            return $i;
        }
    }

    return null;
}

// True when the class keyword at $index is the ::class constant, not a
// declaration.
function classConstantContext(array $tokens, int $index): bool
{
    for ($i = $index - 1; $i >= 0; $i--) {
        $token = $tokens[$i];
        if (is_string($token)) {
            return $token === '::';
        }
        if (in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
            continue;
        }

        return false;
    }

    return false;
}
