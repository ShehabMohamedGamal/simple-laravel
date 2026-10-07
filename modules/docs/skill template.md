# Agent Skills Guide and Template

This guide explains how to write effective AI agent skills, provides a prioritized template, and shows when each part is necessary or optional. It is designed for engineering and planning skills but applies to any domain. [github](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx)

***

## Part 1 — What a skill is and when to use one

### 1.1 Definition

A skill is a **reusable capability** packaged as a folder with a required `SKILL.md` file. The `SKILL.md` contains:

- YAML frontmatter with metadata (only `name` and `description` are required).
- Markdown body with instructions, constraints, and workflow. [github](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx)

Supporting files (`scripts/`, `references/`, `assets/`) are optional and used only when needed. [github](https://github.com/addyosmani/agent-skills/blob/main/docs/skill-anatomy.md)

### 1.2 When to create a skill

Create a skill when:

- The same type of work recurs across projects.
- The work benefits from a repeatable, testable workflow.
- You want to constrain an agent’s behavior in a specific domain.
- You want to encode lessons from past failures into a reusable pattern. 

Do not create a skill when:

- The task is a one-off with no reusable pattern.
- The work is too broad or vague to define clearly.
- The behavior is better expressed as a simple system prompt or instruction.

### 1.3 What makes a skill great

A great skill:

- Has a **narrow, well-defined job** (e.g., `review-api-contract`, not `engineering-helper`).
- Clearly states **when to activate** and **when not to**.
- Defines **observable success criteria** and required artifacts.
- Specifies **boundaries, authority, and side effects**.
- Provides a **repeatable procedure** with verification steps.
- Produces **structured output** that is easy to review or chain. 

***

## Part 2 — File and folder structure

```text
<skill-name>/
├── SKILL.md                  # Required: metadata + core instructions
├── scripts/                  # Optional: automation helpers
├── references/               # Optional: heavy documentation
└── assets/                   # Optional: templates and output resources
```

Only `SKILL.md` is required. Add other directories only when the skill actually needs them. [github](https://github.com/addyosmani/agent-skills/blob/main/docs/skill-anatomy.md)

**Best practice:** keep the `SKILL.md` body focused on core procedural instructions. Move detailed reference material, schemas, and examples into `references/`. 

***

## Part 3 — YAML frontmatter (metadata)

Only two fields are strictly required by the Agent Skills standard: `name` and `description`. All other fields are optional or experimental. [github](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx)

```yaml
---
# REQUIRED (P0)
name: <kebab-case-skill-name>

# REQUIRED (P0)
description: >
  <Verb> <specific object or outcome>.
  Use when <clear trigger or task type>.
  Do not use when <important exclusion or adjacent skill>.

# OPTIONAL (P3)
license: <MIT or path to LICENSE.txt>

# CONDITIONAL (P2)
compatibility: <environment requirements: product, packages, network policy, etc.>

# OPTIONAL (P3)
metadata:
  owner: <team or person>
  version: <semantic version>

# CONDITIONAL (P2, experimental)
allowed-tools: <space-separated list of pre-approved tools>
---
```

### Field-by-field guidance

| Field | Priority | When to use | When unnecessary |
|---|---:|---|---|
| `name` | **P0 (required)** | Always. Must match the folder name and follow format rules (lowercase, hyphens, no leading/trailing hyphens).  [github](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx) | Never. |
| `description` | **P0 (required)** | Always. This is the main selection trigger. It must say what the skill does and when to use it.  [github](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx) | Never. |
| `license` | **P3 (optional)** | When sharing or distributing the skill, or when your organization requires explicit licensing.  [github](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx) | Internal-only skills with no distribution. |
| `compatibility` | **P2 (conditional)** | When the skill requires a specific product, runtime, packages, network access, or repository type.  [github](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx) | When it works in the default agent environment. |
| `metadata` | **P3 (optional)** | When you or your tooling need owner, version, or custom labels.  [github](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx) | When no downstream tool reads these fields. |
| `allowed-tools` | **P2 (conditional, experimental)** | When you must restrict which tools the skill may call (e.g., read-only skills, no-shell skills).  [github](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx) | When the skill uses the agent’s default tool set. |

**When to skip optional frontmatter:** if it does not change behavior or improve selection, omit it. Keep frontmatter minimal. 

***

## Part 4 — Core body sections (inside `SKILL.md`)

Below is the prioritized structure. You do not need every section for every skill. Use only what your skill actually requires.

### 4.1 Purpose and success criteria — **P0 (always use)**

**When to use:** for every skill. This defines the job and what “done” looks like.

**When unnecessary:** never. Even simple skills should state their outcome.

```md
## Purpose

You are responsible for:
- <Primary outcome>
- <Secondary outcome, only if essential>

Success means:
- <Observable acceptance criterion>
- <Required artifact or evidence>
```

***

### 4.2 Use when / Do not use when — **P0 (always use)**

**When to use:** for every skill. This is the main activation logic.

**When unnecessary:** never. If you cannot write this clearly, the skill is probably too broad.

```md
## Use when

Invoke this skill when:
- <Concrete trigger 1>
- <Concrete trigger 2>

## Do not use when

Do not invoke this skill when:
- <Exclusion 1>
- <Exclusion 2>
- <Another skill owns this task>
```

You may merge these into the `description` if you prefer, but keep the logic explicit. [github](https://github.com/jeremylongshore/claude-code-plugins-plus-skills/wiki/SKILL-md-Specification)

***

### 4.3 Inputs — **P1 (use when inputs are not obvious)**

**When to use:** when the skill needs specific information, files, or context before acting.

**When unnecessary:** for trivial skills where the required input is obvious from the task (e.g., “summarize this file”).

```md
## Inputs

Before acting, identify:
- <Required input>
- <Optional input and default>
- <Ambiguity that requires clarification>

If a required input is missing, <ask one focused question / stop and report blocker>.
```

***

### 4.4 Boundaries and authority — **P1 (use for any non-trivial or side-effecting skill)**

**When to use:** for engineering, planning, or any skill that may change files, run commands, access the network, or affect other people.

**When unnecessary:** for purely informational or read-only skills with no side effects.

```md
## Boundaries and authority

You may:
- <Allowed decision or action>

You must not:
- <Forbidden action>
- <Assumption the agent may not make>
- <Out-of-scope responsibility>

Preserve:
- <Compatibility, security, public APIs, existing behavior, etc.>
```

***

### 4.5 Procedure — **P0 (always use)**

**When to use:** for every skill. This is the step-by-step workflow.

**When unnecessary:** never. Even simple skills benefit from a short, explicit procedure.

```md
## Procedure

1. Inspect <specific sources of truth>.
2. State or record <assumptions / plan / constraints>.
3. Perform <the bounded work>.
4. Check <requirements or invariants>.
5. Verify using <tests, commands, review method, or rubric>.
6. Stop and escalate if <stop condition>.
```

Keep this under ~500 lines total for the whole `SKILL.md` when possible. 

***

### 4.6 Verification — **P1 (use for any skill where correctness matters)**

**When to use:** for engineering, planning, research, or any skill where wrong results are costly.

**When unnecessary:** for trivial transformations with obvious correctness (e.g., “convert this list to JSON”).

```md
## Verification

Run or perform:
- `<command or test>` — proves <what it proves>
- <manual review check> — confirms <what it confirms>

Classify verification as:
- `PASSED`
- `FAILED — INTRODUCED`
- `FAILED — PRE-EXISTING / OUT OF SCOPE`
- `NOT RUN` — include the reason
```

***

### 4.7 Output format — **P1 (use when results will be reviewed or chained)**

**When to use:** when the skill’s result will be read by humans, other agents, or evaluation tooling.

**When unnecessary:** for internal helper skills whose only output is side effects (e.g., “run these tests and update a file”).

```md
## Output format

Return:

### Result
<One or two sentences describing what changed or was decided.>

### Evidence
- <Files changed / commands run / artifacts produced>
- <Test or validation result>

### Risks and follow-ups
- <Known risk, trade-off, uncertainty, or “None”>

### Blockers
- <Specific missing information or “None”>
```

***

### 4.8 Side-effect policy — **P1 (use when the skill changes external state)**

**When to use:** when the skill may create, update, or delete files, issues, branches, infrastructure, or data.

**When unnecessary:** for read-only or purely analytical skills.

```md
## Side-effect policy

Before making changes:
- Confirm the scope and destination with the user when required.
- Do not create external artifacts for one-session efforts unless requested.
- Do not close, delete, or re-scope items owned by another person or session
  without explicit authorization, unless autonomous maintenance is enabled.

Never:
- <List irreversible or high-risk actions that are out of scope>
```

***

### 4.9 Preconditions and capability checks — **P2 (use when the skill depends on specific tooling)**

**When to use:** when the skill assumes a particular tracker, tool, API, or environment.

**When unnecessary:** when the skill works in the default agent environment with no special setup.

```md
## Preconditions

Before acting:
1. Identify the active <tracker / tool / environment>.
2. Confirm supported operations (e.g., child issues, dependencies, assignment).
3. Confirm whether autonomous writes are authorized.
4. If a required operation is unavailable, use the documented fallback.
5. If no fallback exists, stop and report the blocker.
```

***

### 4.10 Recovery and failure handling — **P2 (use for complex or long-running skills)**

**When to use:** for multi-step workflows, concurrent work, or skills that may fail partway.

**When unnecessary:** for simple, atomic skills.

```md
## Recovery and failure handling

If <operation> fails:
- <Retry policy>
- <Fallback behavior>
- <How to report the failure>

If the map, plan, or state becomes inconsistent:
- <Validation or repair steps>
- <When to ask the user for direction>
```

***

### 4.11 References — **P2 (use when you have heavy or conditional material)**

**When to use:** when the skill needs detailed frameworks, examples, or domain rules that would bloat the core file.

**When unnecessary:** when all necessary material fits comfortably in the main body.

```md
## References

Read only when relevant:
- `references/<topic>.md` — use for <condition>
- `assets/<template-file>` — use for <condition>
- `scripts/<script-name>` — run only when <condition>
```

Keep the core `SKILL.md` focused; move detailed reference material, schemas, and examples into `references/`. 

***

## Part 5 — Priority summary

| Section | Priority | Use for |
|---|---:|---|
| `name` + `description` (frontmatter) | **P0** | Every skill.  [github](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx) |
| Purpose and success criteria | **P0** | Every skill. |
| Use when / Do not use when | **P0** | Every skill. |
| Procedure | **P0** | Every skill. |
| Inputs | **P1** | Non-trivial skills or unclear inputs. |
| Boundaries and authority | **P1** | Any skill with decisions or side effects. |
| Verification | **P1** | Any skill where correctness matters. |
| Output format | **P1** | Skills whose results are reviewed or chained. |
| Side-effect policy | **P1** | Skills that change external state. |
| Preconditions | **P2** | Skills that depend on specific tooling or environment. |
| Recovery and failure handling | **P2** | Complex or long-running skills. |
| References | **P2** | Skills with heavy or conditional documentation. |
| `license`, `metadata` | **P3** | Only when distribution or tooling requires them. |
| `compatibility`, `allowed-tools` | **P2–P3** | When environment or tool restrictions matter. |

***

## Part 6 — Minimal template (copy-paste)

Use this for simple, atomic skills. Add other sections only when needed.

```md
---
name: <kebab-case-skill-name>
description: >
  <Verb> <specific object or outcome>.
  Use when <clear trigger or task type>.
  Do not use when <important exclusion or adjacent skill>.
---

## Purpose

You are responsible for:
- <Primary outcome>

Success means:
- <Observable acceptance criterion>

## Use when

Invoke this skill when:
- <Concrete trigger>

## Do not use when

Do not invoke this skill when:
- <Exclusion>

## Procedure

1. Inspect <sources of truth>.
2. State or record <assumptions / plan>.
3. Perform <the bounded work>.
4. Check <requirements or invariants>.
5. Verify using <method>.
6. Stop and escalate if <stop condition>.
```

***

## Part 7 — Full template (comprehensive)

Use this for complex, side-effecting, or environment-dependent skills.

```md
---
name: <kebab-case-skill-name>
description: >
  <Verb> <specific object or outcome>.
  Use when <clear trigger or task type>.
  Do not use when <important exclusion or adjacent skill>.
license: <OPTIONAL>
compatibility: <OPTIONAL>
metadata:
  owner: <OPTIONAL>
  version: <OPTIONAL>
allowed-tools: <OPTIONAL>
---

## Purpose

You are responsible for:
- <Primary outcome>
- <Secondary outcome, only if essential>

Success means:
- <Observable acceptance criterion>
- <Required artifact or evidence>

## Use when

Invoke this skill when:
- <Concrete trigger 1>
- <Concrete trigger 2>

## Do not use when

Do not invoke this skill when:
- <Exclusion 1>
- <Exclusion 2>
- <Another skill owns this task>

## Inputs

Before acting, identify:
- <Required input>
- <Optional input and default>
- <Ambiguity that requires clarification>

If a required input is missing, <ask one focused question / stop and report blocker>.

## Boundaries and authority

You may:
- <Allowed decision or action>

You must not:
- <Forbidden action>
- <Assumption the agent may not make>
- <Out-of-scope responsibility>

Preserve:
- <Compatibility, security, public APIs, existing behavior, etc.>

## Procedure

1. Inspect <specific sources of truth>.
2. State or record <assumptions / plan / constraints>.
3. Perform <the bounded work>.
4. Check <requirements or invariants>.
5. Verify using <tests, commands, review method, or rubric>.
6. Stop and escalate if <stop condition>.

## Verification

Run or perform:
- `<command or test>` — proves <what it proves>
- <manual review check> — confirms <what it confirms>

Classify verification as:
- `PASSED`
- `FAILED — INTRODUCED`
- `FAILED — PRE-EXISTING / OUT OF SCOPE`
- `NOT RUN` — include the reason

## Output format

Return:

### Result
<One or two sentences describing what changed or was decided.>

### Evidence
- <Files changed / commands run / artifacts produced>
- <Test or validation result>

### Risks and follow-ups
- <Known risk, trade-off, uncertainty, or “None”>

### Blockers
- <Specific missing information or “None”>

## Side-effect policy

Before making changes:
- Confirm the scope and destination with the user when required.
- Do not create external artifacts for one-session efforts unless requested.
- Do not close, delete, or re-scope items owned by another person or session
  without explicit authorization, unless autonomous maintenance is enabled.

Never:
- <List irreversible or high-risk actions that are out of scope>

## Preconditions

Before acting:
1. Identify the active <tracker / tool / environment>.
2. Confirm supported operations (e.g., child issues, dependencies, assignment).
3. Confirm whether autonomous writes are authorized.
4. If a required operation is unavailable, use the documented fallback.
5. If no fallback exists, stop and report the blocker.

## Recovery and failure handling

If <operation> fails:
- <Retry policy>
- <Fallback behavior>
- <How to report the failure>

If the map, plan, or state becomes inconsistent:
- <Validation or repair steps>
- <When to ask the user for direction>

## References

Read only when relevant:
- `references/<topic>.md` — use for <condition>
- `assets/<template-file>` — use for <condition>
- `scripts/<script-name>` — run only when <condition>
```

***

## Part 8 — Writing process

### 8.1 Start from failure evidence

Begin with real tasks where the agent failed or needed correction. Add the smallest instruction or constraint that addresses that gap. This keeps skills lean and effective. 

### 8.2 Keep the core file short

Aim for under 500 lines in `SKILL.md`. Move detailed frameworks, examples, and domain rules into `references/`. This improves readability and reduces token usage. 

### 8.3 Test before shipping

Dry-run the skill against 3–5 representative tasks:

- Does the agent select it correctly from the description alone?
- Does it decline or redirect an adjacent but out-of-scope task?
- Does every instruction serve its stated purpose?
- Are all write actions and tool permissions explicit?
- Can it operate if a reference file, script, or input is unavailable?
- Does its verification catch a deliberately planted mistake?
- Does its output distinguish facts, assumptions, failures, and blockers?
- Can another engineer grade its result using a simple pass/fail rubric? 

***

## Part 9 — Example: engineering review skill

```md
---
name: review-api-contract
description: >
  Review a proposed or changed HTTP API contract for breaking changes,
  ambiguity, validation gaps, and compatibility risks.
  Use when designing, modifying, or reviewing public API endpoints.
  Do not use for internal refactoring with no externally observable API change.
compatibility: Requires access to the API specification and relevant implementation or tests.
---

## Purpose

Identify contract risks before implementation or release.

Success means:
- Every endpoint change is classified as compatible, potentially breaking, or breaking.
- The result includes concrete evidence and recommended corrections.

## Use when

Invoke this skill when:
- A new or changed HTTP endpoint is proposed.
- An existing endpoint is being modified.
- A release is being prepared and API stability must be verified.

## Do not use when

Do not invoke this skill when:
- The change is purely internal with no externally observable API impact.
- The work is limited to documentation or comments.
- Another skill (e.g., `security-review`) owns the task.

## Inputs

Before acting, identify:
- The API specification (OpenAPI, GraphQL schema, or equivalent).
- The implementation or tests that demonstrate the change.
- Any existing client usage or contracts.

If a required input is missing, ask one focused question and stop until it is provided.

## Boundaries and authority

You may inspect specifications, routes, controllers, tests, and client usage.

You must not modify implementation files or claim that a change is safe without citing the relevant contract evidence.

Preserve backward compatibility unless an explicit breaking-change decision is documented.

## Procedure

1. Identify changed endpoints, request fields, response fields, status codes, and authentication rules.
2. Compare them with the previous contract and existing client expectations.
3. Check naming, validation, pagination, error shapes, idempotency, and versioning.
4. Classify each issue by severity.
5. Verify conclusions against tests or client call sites when available.

## Verification

Run or perform:
- Review the API specification diff — proves what changed.
- Check test coverage for changed endpoints — confirms behavior is validated.

Classify verification as:
- `PASSED`
- `FAILED — INTRODUCED`
- `FAILED — PRE-EXISTING / OUT OF SCOPE`
- `NOT RUN` — include the reason

## Output format

Return:

### Result
One or two sentences describing the overall risk level and whether the change is acceptable.

### Evidence
- Files or specifications inspected.
- Tests or call sites checked.
- Specific lines or sections that support the classification.

### Risks and follow-ups
- Known risks, trade-offs, or uncertainties, or “None”.

### Blockers
- Specific missing information or “None”.
```

***

## Part 10 — Common mistakes to avoid

| Mistake | Why it hurts | Fix |
|---|---|---|
| Broad skill name and description | The agent selects it for unrelated tasks. | Use narrow, action-oriented names and precise triggers. |
| No explicit exclusions | The skill fires when another skill should. | Add a `Do not use when` section. |
| Vague success criteria | You cannot tell if the skill succeeded. | Define observable artifacts and acceptance criteria. |
| Missing boundaries | The agent makes unauthorized changes. | State what it may and must not do. |
| No verification | Wrong results go undetected. | Add explicit checks and classification. |
| Overlong `SKILL.md` | Important instructions get lost in noise. | Move heavy material to `references/`. |
| No failure handling | The skill breaks silently or loops. | Add recovery and escalation rules. |
| Hidden dependencies | The skill assumes unavailable tooling. | Add preconditions and fallbacks. |

***

Use this guide as a reference when designing new skills or improving existing ones. Start with the minimal template, then add sections only when the skill’s complexity, side effects, or environment justify them.
