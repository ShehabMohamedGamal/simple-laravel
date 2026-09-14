#!/usr/bin/env sh
# Deterministic no-comments gate. Single source of truth; the plugin
# (interactive feedback) and code-review (authoritative check) both
# defer to this script.
#
# Comment detection is token-based for PHP files: the post-image is run
# through PHP's tokenizer and only real T_COMMENT / T_DOC_COMMENT tokens
# on added lines count, so string or heredoc content starting with // or
# # never trips the gate. Blade files match the unambiguous {{-- opener
# on added diff lines. Only files matched by the config pathspecs are
# checked.
#
# Usage:
#   no-comments.sh --config            Worktree diff.
#   no-comments.sh --staged --config   Staged diff (verify chain).
# Exit 0 CLEAN, 1 COMMENTS_FOUND.
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
config="$script_dir/no-comments.config.json"

diff_args=''
if [ "${1:-}" = '--staged' ]; then
  diff_args='--cached'
  shift
fi
if [ "${1:-}" = '--config' ]; then
  shift
fi

specs=$(php -r '
  $cfg = json_decode(file_get_contents($argv[1]), true);
  echo implode(" ", array_merge($cfg["include"] ?? [], $cfg["exclude"] ?? []));
' "$config")
blade=$(php -r '
  $cfg = json_decode(file_get_contents($argv[1]), true);
  $leaders = implode("|", array_map(static fn (string $l): string => preg_quote($l, "/"), $cfg["blade_leaders"] ?? ["{{--"]));
  echo "^\\+\\s*(" . str_replace("\\-", "-", $leaders) . ")";
' "$config")

# shellcheck disable=SC2086
set -f
hits=$(git diff $diff_args --diff-filter=ACM --name-only -- $specs | grep '\.php$' | while IFS= read -r file; do
  case "$file" in
    *.blade.php)
      if git diff $diff_args --unified=0 -- "$file" | grep -qE "$blade"; then
        echo "$file: added blade comment line"
      fi
      ;;
    *.php)
      lines=$(git diff $diff_args --unified=0 -- "$file" \
        | awk '/^@@ /{ split(substr($3, 2), a, ","); s = a[1] + 0; c = (a[2] == "" ? 1 : a[2] + 0); for (i = 0; i < c; i++) print s + i }' \
        | paste -sd, -)
      [ -n "$lines" ] || continue
      if [ -n "$diff_args" ]; then post=$(git show :"$file"); else post=$(cat "$file"); fi
      printf '%s' "$post" | php -r '
        $added = array_flip(explode(",", $argv[1]));
        foreach (token_get_all(stream_get_contents(STDIN)) as $tok) {
            if (!is_array($tok) || ($tok[0] !== T_COMMENT && $tok[0] !== T_DOC_COMMENT)) {
                continue;
            }
            foreach (explode("\n", $tok[1]) as $i => $text) {
                $line = $tok[2] + $i;
                if (isset($added[$line])) {
                    echo $argv[2], ":", $line, ": ", trim($text), "\n";
                }
            }
        }
      ' "$lines" "$file"
      ;;
  esac
done)
set +f

if [ -n "$hits" ]; then
  printf '%s\n%s\n' "$hits" COMMENTS_FOUND
  exit 1
fi
echo CLEAN
