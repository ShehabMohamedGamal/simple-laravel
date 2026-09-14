# Command Reference

Load this reference only when the intent table in `SKILL.md` is insufficient.

## Retrieval

```bash
codebase-index search "<query>" --json
codebase-index explain "<topic or flow>" --json
```

Useful search options:

- `--mode hybrid|fts|symbol|vector`
- `--token-budget <tokens>`
- `--limit <count>`
- `--offset <pagination offset>`
- `--raw` to disable snippet skeletonization
- `--no-fallback` to suppress fallback suggestions

`explain` uses the HOW_IT_WORKS intent and a larger default token budget. Prefer
it over repeatedly rewording a broad search.

## Code graph

```bash
codebase-index refs "<symbol>" --json
codebase-index path "<source>" "<target>" --json
codebase-index describe "<file-or-symbol>" --json
```

- `refs` finds definitions, calls, and graph-backed references.
- `path` returns the shortest known dependency/call chain.
- `describe` returns a node card with callers, callees, module, and centrality.

`architecture`, `impact`, `diff-impact`, and `graph` are banned. Never run them.

## Index health

```bash
codebase-index stats --json
codebase-index doctor
codebase-index update
codebase-index index
```

Run `stats` and `doctor` when several unrelated queries have low confidence.
Low symbol counts or partial graph coverage can explain weak results.

## Query examples

```bash
codebase-index search "auth token refresh" --json
codebase-index search "AuthService class" --mode symbol --json
codebase-index search "connection reset by peer" --mode fts --json
codebase-index explain "checkout flow" --json
codebase-index path "ApiController" "Database" --json
```
