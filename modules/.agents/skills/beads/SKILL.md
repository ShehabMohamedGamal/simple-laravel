---
name: beads
description: Use when working in a repository that uses bd or Beads for durable project task tracking, issue dependencies, blocker management, multi-session handoff, or shared work memory. Trigger when the user asks to find ready work, claim or close tasks, create follow-up work, inspect blockers, recover project context, or choose between local planning and persistent project tracking.
---

# Beads

Use Beads as the shared project task system. Local plans, scratch files, and personal memories are useful, but they are not the durable source of truth for project work.

## First Step

Run:

```bash
bd prime
```

If that prints nothing, check whether the repository has an active Beads workspace:

```bash
bd where
```

## Commands

The full command conventions (find, read, claim, create with types, labels, and spec linkage, update, dependencies, close, views, session completion, context profiles) live in `docs/agents/issue-tracker.md`. It is the single source; follow it. Its rules bind here too: never run `bd edit`, never use `bd memory`, do not use markdown TODO files as the source of truth, and prefer `--json` when parsing `bd` output programmatically.

If hooks are installed, `bd prime` may already be injected. Run it manually when context is missing.

## What Belongs In Beads

Use Beads for:

- shared project tasks
- blockers and dependencies
- discovered follow-up work
- work that must survive thread reset, compaction, or handoff
- status that another person or agent should be able to resume

Use agent-local planning tools only for the current turn's execution checklist. Do not treat them as shared project state. Do not auto-close or mutate tasks unless the work is actually complete.
