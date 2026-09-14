---
name: codebase-index
description: Use before answering repository questions about implementation, symbols, references, dependencies, data flow, or bugs. Query the local hybrid index first so the agent reads only evidence-bearing file:line ranges instead of scanning the repository.
allowed-tools: Bash(codebase-index search *), Bash(codebase-index explain *), Bash(codebase-index symbol *), Bash(codebase-index refs *), Bash(codebase-index path *), Bash(codebase-index describe *), Bash(codebase-index stats *), Bash(codebase-index doctor *), Bash(codebase-index update *), Bash(codebase-index index *), Bash(cbx *), Read, Grep, Glob
---

# Codebase Index

Use the local index before reading repository files.

The operating principle is **Find → Trace**:

- **Find** the implementation with ranked retrieval.
- **Trace** behavior through definitions, callers, dependencies, and paths.

`impact`, `diff-impact`, `architecture`, and `graph` are banned. Never run them.

## Route the question

| Intent | Command |
|---|---|
| Where is X implemented? | `codebase-index search "X" --json` |
| How does X work? | `codebase-index explain "X" --json` |
| Find a named symbol | `codebase-index symbol "X" --json` |
| Who calls or references X? | `codebase-index refs "X" --json` |
| How are X and Y connected? | `codebase-index path "X" "Y" --json` |
| Describe X and its neighborhood | `codebase-index describe "X" --json` |

Use `search --mode symbol` for exact symbol work, `--mode fts` for text and
error messages, and the default `hybrid` mode for mixed questions. Use pure
`vector` mode only when embeddings are enabled and exact vocabulary is unknown.

Read [references/commands.md](references/commands.md) only when command options
or routing remain unclear.

## Evidence protocol

1. Run the best-matching command with `--json`.
2. Check `index` before trusting the payload:
   - missing → run `codebase-index index`, then repeat;
   - stale with fewer than 20 changed files → run `codebase-index update`;
   - stale with 20 or more changed files → run `codebase-index index`;
   - fresh → continue.
3. Start with ranks 1–3. Read only `recommended_reads` line ranges.
4. Trace one additional hop only when the question requires behavior or
   ownership.
5. Answer with `file:line` evidence and state uncertainty explicitly.

Do not open whole files when a line range is available. A snippet may already
be sufficient. `skeletonized: true` means the response intentionally folded
unrelated body lines; read the supplied range when the missing body matters.

## Confidence contract

- **high** — answer from the indexed evidence.
- **medium** — read the recommended ranges and confirm the key claim with one
  targeted lookup if necessary.
- **low** or no results — follow `fallback_suggestions`, then use a narrow
  Grep/Glob fallback.

On `refs`, inspect `coverage`. If `coverage.partial` is true, an
empty result is inconclusive; confirm with targeted Grep before saying that
nothing references the target.

Edges carry `confidence`:

- `extracted` — exact parser evidence;
- `inferred` — heuristic resolution;
- `ambiguous` — unresolved or non-unique.

Never present an inferred or ambiguous chain as certain.

## Answer contract

Structure repository answers around:

1. **Answer** — the direct conclusion.
2. **Evidence** — the minimum supporting `file:line` references.
3. **Confidence** — only when evidence is partial, inferred, stale, or missing.
4. **Next check** — only when another check would materially reduce uncertainty.

Do not narrate every search step. Do not claim absence from a partial graph.
Do not replace evidence with a generated HTML graph.

For payload fields and failure handling, read
[references/response-contract.md](references/response-contract.md).
