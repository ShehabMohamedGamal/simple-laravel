---
name: self-review
description: "The implementer's own review: one reviewer sub-agent runs three axes over the diff since the session's start (Standards, Spec, Correctness) and reports findings back. Report-only, never edits code, runs once per implement-loop."
---

Three-axis review of the working diff against a fixed point the caller supplies:

- **Standards**: does the code conform to this repo's documented coding standards?
- **Spec**: does the code faithfully implement the originating ticket / spec?
- **Correctness**: does the code contain bugs, and can its tests catch them?

One reviewer sub-agent runs all three axes in a single pass, so each axis benefits from the context the previous ones build, then this skill presents the report. The review is report-only: findings go back to the implementer, who fixes them in the implement-loop fix rounds.

The issue tracker should have been provided to you. If `docs/agents/issue-tracker.md` is missing, tell the user to run `/setup-ae-harness`.

## Process

### 1. Pin the fixed point

Whatever the caller said is the fixed point (a commit SHA, branch name, tag, `main`, `HEAD~5`, etc.). The implement-loop skill passes the commit the session started from. If nothing was supplied, ask for it.

Capture the diff command once: `git diff <fixed-point>` (working tree against the fixed point, so the session's uncommitted work is included). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here, not inside the reviewer.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. The ticket the implementer is working, via `bd show <id>` and the workflow in `docs/agents/issue-tracker.md`.
2. A path the caller passed as an argument.
3. A spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If nothing is found, the reviewer reports "no spec available" on the Spec axis.

### 3. Identify the standards sources

Anything in the repo that documents how code should be written, such as `CODING_STANDARDS.md` or `CONTRIBUTING.md`.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below: a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation. Like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 4. Spawn one reviewer sub-agent

Launch the three-axis review sub-agent once, resolved from the agents section of `docs/agents/registry.md` (default: `reviewer`), with `REVIEW_AXIS` covering all three axes. Its prompt should include:

- The full diff command and commit list.
- The list of standards-source files you found in step 3, **plus the smell baseline from step 3** pasted in full (the sub-agent has no other access to it).
- The path or fetched contents of the spec, or an explicit "no spec available".

The Correctness axis owns its own brief; the sub-agent's definition carries it. Do not paste a copy here.

### 5. Present the report

Present the report under `## Standards`, `## Spec`, and `## Correctness` headings, verbatim or lightly cleaned. Do **not** merge or rerank findings across axes: the axes are deliberately separate (see _Why three axes_).

End with a one-line summary: total findings per axis, and the worst issue _within each axis_ (if any). Don't pick a single winner across axes: that's the reranking the separation exists to prevent.

### 6. Deterministic checks (advisory)

Run before presenting. Check docblock coverage against the working tree:

```bash
php scripts/feedback/docs-coverage.php
```

The script always exits 0. Report every line it prints as a Standards-axis finding, marked advisory: the same output runs as a `report:` step in `composer verify`, so a finding here never blocks the change on its own.

Test-shape scope: tests must sit at recorded seams; flag coupled, tautological, overlapping, niche-edge-spam, library-testing, and trivial tests per the `tdd-lite` skill.

## Why three axes

A change can pass two axes and fail the third:

- Code that follows every standard and implements the ticket, but breaks on an edge case → **Standards pass, Spec pass, Correctness fail.**
- Code that follows every standard and handles its edge cases, but implements the wrong thing → **Standards pass, Spec fail, Correctness pass.**
- Code that does exactly what the ticket asked, in a shape the repo rejects → **Spec pass, Correctness pass, Standards fail.**

Reporting them separately stops one axis from masking another. The single sub-agent keeps the context shared: a spec gap found on the Spec axis is evidence for the Correctness axis, and a confirmed bug on the Correctness axis can excuse a Standards judgement call.
