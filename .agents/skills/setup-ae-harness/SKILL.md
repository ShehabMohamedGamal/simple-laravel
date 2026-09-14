---
name: setup-ae-harness
description: "Install the AE ready setup into any repo: copy AGENTS.md + docs/agents (beads-only), merge-safe. Run once per repo. Handles missing bd via web search + user pick."
disable-model-invocation: true
---

# Setup AE Harness

Deterministic copy skill. No questionnaire. Installs the ready AE setup:

- `AGENTS.md` (beads pointer + non-interactive shell + docs-retrieval pointers)
- `CONTEXT.md` (placeholder domain skeleton — only when absent)
- `docs/agents/issue-tracker.md` (beads-only)
- `docs/agents/domain.md` (single-context)
- `docs/agents/triage-labels.md` 
- `docs/agents/docs-retrieval.md`
- `docs/agents/registry.md` (capability registry)
- `docs/agents/llms/.gitkeep` (convention dir for doc slices; see docs-retrieval.md)

Templates live inside this skill under `templates/`:

- `templates/AGENTS.md`
- `templates/CONTEXT.md`
- `templates/docs-agents/issue-tracker.md`
- `templates/docs-agents/domain.md`
- `templates/docs-agents/triage-labels.md`
- `templates/docs-agents/docs-retrieval.md`
- `templates/docs-agents/registry.md`
- `templates/docs-agents/llms/.gitkeep`

## Process

### 1. Check `bd`, handle missing via web search

Run:

```bash
command -v bd && bd --version
```

- If present: proceed, note version for Done message.
- If missing: do a normal web search for current official ways to install beads (`bd`) on the current system (detect OS via `uname -a`). Present 2-3 first-party methods found (e.g. install script, package manager, binary download) with source URLs, then ask the user for their preferred way. Do NOT auto-install without an explicit pick.
- Copy files regardless. Mark `bd init` + `bd prime` verification as deferred until the user installs.

Use non-interactive shell flags everywhere (`cp -f`, `mkdir -p`, `rm -f`) so aliased `cp/mv/rm -i` never blocks the agent.

### 2. Write `docs/agents/` (overwrite, create dirs)

```bash
mkdir -p docs/agents/llms
cp -f <skill>/templates/docs-agents/issue-tracker.md docs/agents/issue-tracker.md
cp -f <skill>/templates/docs-agents/domain.md docs/agents/domain.md
cp -f <skill>/templates/docs-agents/triage-labels.md docs/agents/triage-labels.md
cp -f <skill>/templates/docs-agents/docs-retrieval.md docs/agents/docs-retrieval.md
cp -f <skill>/templates/docs-agents/registry.md docs/agents/registry.md
cp -f <skill>/templates/docs-agents/llms/.gitkeep docs/agents/llms/.gitkeep
```

`<skill>` is this skill's own folder. Overwrite is intentional — these four files are the source of truth. Create the dirs if missing.

### 2b. Write `CONTEXT.md` (only when absent)

`CONTEXT.md` is domain-specific, never overwritten:

- If no `CONTEXT.md` at repo root: `cp -f <skill>/templates/CONTEXT.md CONTEXT.md`.
- If one exists: leave it untouched, note that in the Done message.

### 3. Write `AGENTS.md` (merge-prune, never duplicate)

- If no `AGENTS.md` at repo root: `cp -f <skill>/templates/AGENTS.md AGENTS.md` (full copy: pointer only, beads detail lives in `docs/agents/issue-tracker.md`).
- If one exists: merge-prune. Read both files, then:
  - Delete beads instruction blocks from the target if present: `## Beads Issue Tracker` sections (incl. `BEGIN BEADS INTEGRATION` / `BEGIN BEADS CODEX SETUP` markers and their `END` lines), beads `## Quick Reference` fences, and the beads architecture paragraph.
  - Insert the pointer block (`## Beads (\`bd\`) issue tracker — \`docs/agents/issue-tracker.md\``) from the template if absent. Never duplicate it.
  - Never delete the target's own sections (build/test/arch/conventions). Keep `## Non-Interactive Shell Commands` and `## Docs retrieval` (+ `## Agent skills` pointers if absent).

If `CLAUDE.md` already exists alongside `AGENTS.md`, mirror the same prune there (delete blocks, insert pointer). Never create `CLAUDE.md` when only `AGENTS.md` exists (or vice versa).

One confirmation before writing ("Ready to write AGENTS.md, CONTEXT.md (if absent) + 4 docs files, overwrite docs/agents — proceed?"), not a questionnaire.

### 4. Verify + Done

Checklist (all must hold, except `bd` may be deferred per step 1):

- `AGENTS.md` exists, holds the beads pointer, and has zero `BEGIN BEADS` markers and no beads `## Quick Reference` fence.
- All five `docs/agents/*.md` present; `issue-tracker.md` contains session completion + context profiles.
- `docs/agents/llms/.gitkeep` present.
- `CONTEXT.md` present (freshly copied placeholder or pre-existing, untouched).
- `bd --version` + `bd prime` run, or explicit note: "bd install deferred — picked method X pending".

Done message lists files written, `bd` status (version or deferred), and states: beads detail lives in `docs/agents/issue-tracker.md` (`AGENTS.md` holds the pointer only); edit `docs/agents/*.md` directly from here on; re-run this skill only to reset or re-install from scratch.
