---
name: implement-loop
description: "The implementer's session loop: lean prep, build with an on-demand toolbench, and wrap-up gates run as feedback through composer verify, capped fix rounds ending in commit and ticket close, or a beads issue carrying the full run log."
---

Work falls into three categories. Prep sets up the work in three steps. Build is the tdd loop plus a toolbench. Wrap-up runs the commit gate as feedback and spends at most three fix rounds on what it reports.

## Prep

1. Read the ticket (`bd show`) and its acceptance criteria.
2. Build the todo list with the todo tool. This is a hard requirement, never skipped: one todo per acceptance criterion, plus the wrap-up gates as final todos.
3. Pin the fixed point: record the current HEAD SHA. Self-review reviews the diff against it.

Nothing else. The session-log plugin runs on its own; never list it as a step.

## Build

The `tdd-lite` skill, as-is. One failing test per acceptance criterion, smallest steps that produce observable behavior, narrow checks (single test file, targeted larastan) after each step. Keep the todo list current as criteria go green.

The toolbench sits alongside the loop. It lists what exists and where the how lives; capabilities resolve from `docs/agents/registry.md`.

| Capability | Source |
| --- | --- |
| Laravel docs, schema and data questions, one-shot `pest --agent` checks, browser logs | `laravel` skill |
| Symbol tracing, references, repository questions | `codebase-index` CLI; retrieval commands only, `impact`, `diff-impact`, `architecture`, and `graph` are banned |
| Version-correct library docs | docs retrieval fallthrough, how in `docs/agents/docs-retrieval.md` |

## Wrap-up

1. Stage the work: `git add -A`, so the no-comments gate sees the staged diff.
2. `composer verify` — the commit gate, run as feedback. Three gates decide the result, each with its own label: the no-comments gate on the staged diff, pest , and type coverage at a minimum of 80 percent. The remaining steps print raw tool output under `report:` labels (pint, deptrac, phpstan, the mutation score on the session's new tests, CRAP values for staged app classes, phpmetrics, audit). The report output is feedback for you: act on it in the fix rounds, and never weaken a gate because of it. A failed chain ends with a `FAILED GATES:` line naming the gates to fix.
3. `/self-review` once, passing the pinned fixed point and the ticket.

## Fix rounds

At most three. Each round:

1. Fix the verify failures and the report and review findings worth fixing. Judgement-call findings (smells, naming) stay advisory; skip them without guilt.
2. Check the fix narrowly: the affected tests and targeted larastan.
3. When the findings are handled, run `composer verify` once more before commit.

## Success

Verify green, review findings fixed or consciously advisory-skipped:

1. Commit. The work is already staged.
2. Close the ticket per `docs/agents/issue-tracker.md`.
3. Delete the run log directory under `.opencode/logs/`.

## Failure

Red remains after round three:

1. Stop. Do not commit.
2. `bd create` an issue whose body is the run log (`<run-dir>/session.md` followed by `<run-dir>/categories.md`), labelled `ready-for-human`.
3. Report to the user what was attempted, what remains red, and the issue name.
