# Beads configuration plan

Beads 1.2.2 already supports everything the design needs natively. The work is one config change plus writing the conventions into the repo's tracker docs. No workflow engine, no schemas, no scripts.

## 1. Configure beads (1 command + smoke test)

```bash
bd config set types.custom "wayfinder,spec,implementation,review"
```

Custom types are additive to built-ins (task, bug, feature, chore, epic, decision, spike...), so the design's "custom" slot and small-fix exceptions stay covered by native types.

Smoke test (tracker currently has 0 open issues, so this is clean):
```bash
bd create "Type smoke test" -t spec -l needs-triage
bd list -t spec --json          # confirm custom type + label filterable
bd label list <id> && bd close <id> --reason="Smoke test"
```

## 2. Type contract (the convention to adopt)

| Type | Purpose | Notes |
|---|---|---|
| `wayfinder` | exploration tickets (research, prototype, grilling, task) | closed = historical record; never a parent of implementation work |
| `spec` | the specification artifact | how specs are generated stays in the to-spec skill |
| `implementation` | executable engineering tasks | usually references a spec (below); bugs/small fixes use native `bug`/`chore` and may skip the spec |
| `review` | review tasks | |
| native types | everything else (bug, feature, chore, epic, decision, ...) | unchanged |

- **Map**: stays an `epic` with label `wayfinder:map`; wayfinder tickets are its children, typed `wayfinder` with a subtype label (`wayfinder:research|prototype|grilling|task`). This matches the wayfinder skill's existing vocabulary.
- **Spec linkage**: implementation tickets use bd's purpose-built field: `bd create ... -t implementation --spec-id simple-template-xxx`, filterable with `bd list --spec <prefix>`. Optional hard gating via a typed dep (`bd dep add <impl> <spec> -t blocks`) when the spec must land first.
- **Metadata**: only for pointers that fit no native field, e.g. `--metadata '{"spec_doc":"docs/specs/auth.md"}'`, filtered with `--metadata-field key=value` / `--has-metadata-key`. Deliberately minimal — spec refs and triage roles do not need it.
- **Triage labels become real labels** (local docs wrongly claim beads has no label field): `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, set with `bd create -l` / `bd label add`, filtered with `bd list -l ready-for-agent --status open`.

## 3. Views section (documented commands, no scripts)

Add to `docs/agents/issue-tracker.md`:

```text
Implementation agent view:
  bd ready -t implementation
  bd list -t spec -l ready-for-agent --status open

Wayfinder agent view:
  bd list -t wayfinder --status open
  bd ready --parent <map-id>

Triage view:
  bd list -l needs-triage --status open
```

Agents may always bypass views and query bd directly.

## 4. Doc updates (edit existing files, create none)

1. **docs/agents/issue-tracker.md** — add Ticket types, Labels, Spec linkage, and Views sections; update the `bd create` convention example to use the new types/labels; update the Wayfinding operations section (map = epic + `wayfinder:map` label, children typed `wayfinder`); fix stale facts while there: a git remote now exists (doc says none), and the store path is `.beads/embeddeddolt/`, not `.beads/dolt/`.
2. **docs/agents/triage-labels.md** — replace the "beads has no native label field / title suffix" workaround with native label commands and filters.
3. **AGENTS.md** (triage section) — drop the "no native label field" sentence, point at the updated mapping.
4. **.agents/skills/setup-ae-harness/templates/** (`AGENTS.md`, `docs-agents/triage-labels.md`, `docs-agents/issue-tracker.md`) — apply the same corrections so future installs ship the right text.
5. **.agents/skills/beads/SKILL.md** — update its `bd create` example to show `-t implementation` and `-l ready-for-agent`.

## 5. Verification

- `bd types` shows the four custom types; `bd list -t spec` / `bd ready -t implementation` accept them.
- Smoke-test issue created, filtered, closed.
- No PHP changes, so no `composer verify` needed; I will not commit unless you ask (workspace has unrelated uncommitted changes).
