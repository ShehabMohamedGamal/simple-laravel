# Issue tracker: Beads (`bd`)

Issues and specs for this repo live in **beads**, a local Dolt database at
`.beads/embeddeddolt/`, operated via the `bd` CLI. Run `bd prime` for full workflow
context. `.beads/issues.jsonl` is a passive export, not the source of truth.

Cross-machine sync uses `bd dolt push/pull` (a git-compatible protocol stored
under `refs/dolt/data` on the git remote), separate from `refs/heads/*`
where code lives. The sync remote is configured in `.beads/config.yaml`
(`sync.remote`). Never push without the user's approval (see Session completion).

## Conventions

- **Find available work**: `bd ready`
- **Read an issue**: `bd show <id>` (includes dependencies/blockers)
- **Create an issue**: `bd create --title="..." --description="..." --type=<type> --priority=2`
  - Priority: 0-4 (0=critical, 2=medium, 4=backlog)
  - Type: pick from the ticket types below (custom types `wayfinder`, `spec`, `implementation`, `review`, plus built-ins `task`, `bug`, `feature`, `chore`, `epic`, `decision`, `spike`). Run `bd types` for the live list.
  - Labels: `-l ready-for-agent` (comma-separated for several); children inherit parent labels unless `--no-inherit-labels`
  - Hierarchy: `bd create ... --parent=<id>` for child issues
- **Claim work**: `bd update <id> --claim`
- **Update fields**: `bd update <id> --title/--description/--notes/--design`
- **Dependencies**: `bd dep add <issue> <depends-on>` (issue is blocked by depends-on)
- **List / search**: `bd list --status=open`, `bd list --status=in_progress`, `bd search <query>`, `bd blocked`
- **Close**: `bd close <id>` (or `bd close <id1> <id2> ...`), with `--reason="..."` where useful
- **Memory**: banned. `bd memory` / `bd remember` are blocked by a deterministic gate (`.opencode/gates/no-memory.sh`); record durable knowledge on issues instead (`bd update <id> --notes`, or `bd create` when no issue fits)
- **Health**: `bd stats`, `bd doctor`, `bd stale`, `bd orphans`
- **Sync**: `bd dolt push` / `bd dolt pull` (beads data only, under `refs/dolt/data`)

Do NOT use TodoWrite, TaskCreate, or markdown TODO files for task tracking.
Never run `bd edit` (opens $EDITOR and blocks agents).

## Ticket types

Ticket types are the contract between humans, agents, and external skills. Beads stays a graph issue tracker; it does not execute skills or enforce workflows.

| Type | Purpose | Lifecycle |
| --- | --- | --- |
| `wayfinder` | exploration: mapping unknown areas, discovery, decision tickets | closed means historical record; a wayfinder ticket is never the parent of implementation work |
| `spec` | the specification artifact | how specs are generated belongs to the spec skill, not beads |
| `implementation` | executable engineering tasks | usually references a spec (see Spec linkage); bugs and small fixes may skip it |
| `review` | review tasks | |
| built-ins (`task`, `bug`, `feature`, `chore`, `epic`, `decision`, `spike`, ...) | everything else | unchanged |

Custom types are configured with `bd config set types.custom "wayfinder,spec,implementation,review"` and are additive to the built-ins.

### Spec linkage

An implementation ticket references its spec with the native field:

```bash
bd create "Title" -t implementation --spec-id simple-template-xxx --description="..."
bd list --spec simple-template-xxx   # everything linked to that spec
```

Exceptions (bugs, small fixes, maintenance) use the built-in `bug` or `chore` type and may omit `--spec-id`. When the spec must land before implementation starts, add a typed dependency: `bd dep add <impl> <spec> -t blocks`.

### Metadata

Use metadata only for pointers that fit no native field:

```bash
bd create "Title" -t implementation --metadata '{"spec_doc":"docs/specs/auth.md"}'
bd list --metadata-field spec_doc=docs/specs/auth.md
bd list --has-metadata-key spec_doc
```

Spec references, triage roles, and wayfinder subtypes do not need metadata; they use `--spec-id` and labels.

## Labels

Labels are native and filterable everywhere (`bd list`, `bd ready`, `--json` output).

- **Triage roles**: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
- **Wayfinder subtypes**: `wayfinder:map` on the map epic; `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task` on wayfinder tickets.

## Views

Agent-specific views are queries, not scripts. Use them as-is or bypass them and query `bd` directly.

```bash
# Implementation agent view
bd ready -t implementation
bd list -t spec -l ready-for-agent --status open

# Wayfinder agent view
bd list -t wayfinder --status open
bd ready --parent <map-id>

# Triage view
bd list -l needs-triage --status open
```

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

## When a skill says "publish to the issue tracker"

Create a beads issue with `bd create`. Create the issue BEFORE writing code,
claim it with `bd update <id> --claim` when starting, and `bd close <id>` when done.

## When a skill says "fetch the relevant ticket"

Run `bd show <id>`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single `epic` issue labelled `wayfinder:map` with **child** issues as tickets.

- **Map**: a single epic with the `wayfinder:map` label, holding the Notes / Decisions-so-far / Fog body (`bd create ... -t epic -l wayfinder:map`; children link back via `--parent`).
- **Child ticket**: an issue created with `bd create ... -t wayfinder -l wayfinder:research|wayfinder:prototype|wayfinder:grilling|wayfinder:task --parent=<map-id>` with the question in the body.
- **Blocking**: `bd dep add <child> <blocker>`. A ticket is unblocked when every blocker is closed (`bd close <blocker> --suggest-next` shows newly unblocked work).
- **Frontier query**: `bd ready --parent <map-id>` (open, unblocked, unclaimed children); first in map order wins.
- **Claim**: `bd update <id> --claim`, the session's first write.
- **Resolve**: record the answer in `--notes`/`--design`, then `bd close <id>`, then append a context pointer to the map's Decisions-so-far.

## Session completion

When ending a Beads implementation workflow (subordinate to explicit user, repository, or orchestrator instructions):

1. **File issues for remaining work.** Create beads for anything needing follow-up.
2. **Run quality gates (if code changed).** Tests, linters, builds.
3. **Update issue status.** Close finished work, update in-progress items.
4. **Handle git/sync by active profile.** Commit freely without asking. Report `git status` and proposed push/sync commands, wait for approval: never `git push`, `git pull --rebase`, or `bd dolt push` unless the user asks. A current "do not commit" / "do not push" instruction always wins.
5. **Hand off.** Summarize changes, validation, issue status, and any blocked sync/commit/push step.

## Agent context profiles

The above is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: use `bd` for task tracking. Commit freely; no pushes or Dolt remote sync unless asked.
- **Minimal**: keep tool instruction files as pointers to `bd prime`; same git policy (commit freely, push only when asked) unless active instructions say otherwise.
- **Team-maintainer**: as conservative, plus: only when the repository explicitly opts in, close beads, run quality gates, and push as part of session close.
