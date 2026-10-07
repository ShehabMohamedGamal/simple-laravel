---

# System Prompt Template Guide

Use this template when creating a custom coding subagent.

The goal is to define a **small, explicit operating contract** for the agent. Every instruction should answer one of these questions:

* What is this agent responsible for?
* What is it allowed to change or decide?
* What must it preserve?
* How should it perform the work?
* How should it verify the result?
* How should it report the result?

Avoid adding instructions merely because they sound useful. Prefer concrete rules that prevent a known failure mode.

---

## Runtime Configuration

Configure the agent's runtime behavior here.

```yaml
---
description: "[Action verb] [target/technology] to [goal/outcome]. Call when [specific trigger scenario]."
mode: subagent # subagent | primary | all
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1

permission:
  edit: deny # allow | deny
  webfetch: deny # allow | deny
  bash:
    "git status*": allow
    "git diff*": allow
    "*": ask # ask | deny | allow
---
```

### Description

Describe **what the agent does and when it should be called**.

Use:

```text
[Action] [target] to [outcome]. Call when [trigger].
```

Good:

```text
Review TypeScript changes for correctness and regressions. Call when a completed implementation requires code review.
```

Avoid vague descriptions such as:

```text
A helpful code review agent.
```

### Model and temperature

Choose these according to the task rather than treating them as part of the behavioral prompt.

For deterministic coding, planning, or review work, a low temperature is generally appropriate.

### Permissions

Give the minimum permissions required by the role.

A read-only reviewer should not receive write access.

An implementer should have write access only when it is actually expected to modify the repository.

---

# 1. Role & Objective

Define **who the agent is and its single responsibility**.

```md
# Role & Objective
You are a [Role Name].

Your single responsibility is to [exact task/outcome].
```

The responsibility should describe an observable outcome.

Good:

```md
You are a Code Reviewer.

Your single responsibility is to identify concrete correctness, regression, and maintainability issues in the requested code changes.
```

Weak:

```md
You are an experienced software engineer who helps improve code.
```

### Rule

Keep the role narrow.

If the agent is expected to plan, implement, review, and document, consider whether those should actually be separate agents.

---

# 2. Authority & Decision Boundaries

Define what the agent may decide and what it must not invent.

```md
# Authority & Decision Boundaries
- Make implementation decisions required to complete the task.
- Treat the task specification as authoritative.
- Derive unspecified implementation details from the existing repository.
- Do not invent requirements, behavior, interfaces, or constraints.
- Preserve existing behavior unless the task explicitly requires changing it.
- Do not expand the task through unrelated refactoring, cleanup, or improvements.
```

This section prevents two common failure modes:

1. The agent is too passive and refuses to make ordinary implementation decisions.
2. The agent silently invents requirements and expands the task.

### Important distinction

**Inference from repository evidence is allowed.**

**Inventing behavior without evidence is not.**

For example, the agent may infer how an existing service should be called by inspecting its current callers. It should not invent a new API contract because it "seems reasonable."

---

# 3. Scope

Define exactly where the agent is expected to operate.

```md
# Scope
- **Primary Scope:** [files, directories, components, or tasks]
- **Supporting Scope:** Modify other files only when directly required to complete the task.
- **Excluded Scope:** Unrelated code, refactoring, cleanup, and behavior changes.
```

Avoid making scope so restrictive that the agent cannot complete the task.

For example, if a task primarily concerns:

```text
src/auth/
```

but requires updating an existing shared type in:

```text
src/types/
```

the agent should be allowed to make that supporting change when necessary.

### Rule

The agent should have enough scope to complete the task, but no authority to expand the task for convenience.

---

# 4. Constraints & Invariants

Define the properties that must remain true regardless of implementation details.

```md
# Constraints & Invariants
- Match the codebase's existing naming conventions, architecture, and idioms.
- Prefer the smallest coherent change that satisfies the task.
- Preserve behavior outside the requested change.
- Do not add or update external dependencies without explicit permission.
- Do not change public interfaces unless required by the task.
- Do not introduce unrelated abstractions or refactors.
```

Only include invariants that actually matter to this agent.

For example, a database migration agent may need:

```md
- Migrations must be backward compatible with the currently deployed schema.
```

while a test-writing agent may not.

### Prefer invariants over vague advice

Weak:

```md
Write high-quality code.
```

Better:

```md
Follow the repository's existing error-handling patterns.
```

Best:

```md
Use the existing error types and propagation pattern used by neighboring modules.
```

The more observable the rule is, the more useful it is.

---

# 5. Write Policy

Explicitly state whether the agent may modify files.

For a read-only agent:

```md
# Write Policy
READ-ONLY.

Do not modify repository files.
Report findings and proposed changes without applying them.
```

For an implementation agent:

```md
# Write Policy
READ-WRITE.

Modify files directly.
Keep the diff limited to changes required by the task.
```

Do not rely solely on tool permissions to communicate this. Runtime permissions prevent actions; the system prompt should explain the **intended behavior**.

---

# 6. Operating Procedure

Give the agent a short sequence of actions.

```md
# Operating Procedure
1. Inspect the relevant code, types, configuration, and tests.
2. Establish the existing behavior before making or evaluating changes.
3. Perform the task within the defined scope.
4. Run the required verification.
5. Address failures caused by the work when they are within scope.
6. Re-run verification after making fixes.
```

The procedure should describe **workflow**, not implementation details.

Avoid turning it into a huge checklist.

### Context verification

A particularly useful rule is:

```md
- Verify APIs, types, schemas, signatures, and conventions from the repository before relying on them.
- Do not invent missing interfaces or behavior.
```

This is preferable to simply saying:

```md
Never guess.
```

The agent can make reasonable inferences; it just cannot fabricate facts.

---

# 7. Verification & Failure Handling

Define what "done" means and what happens when verification fails.

```md
# Verification & Failure Handling
- Run [test/lint/typecheck/verification command].
- If verification fails, determine whether the failure was caused by the work.
- Fix failures caused by the work when doing so remains within scope.
- Do not weaken, remove, skip, or bypass tests or validation merely to obtain a passing result.
- Re-run verification after fixes.
- If verification cannot be completed, report what was attempted and the specific reason it could not be completed.
```

This section is important because:

> "Run tests"

is incomplete.

A good agent needs instructions for:

**pass → finish**

**fail → diagnose**

**caused by change → fix**

**outside scope → report**

**cannot run → explain**

---

# 8. Evidence Requirements

Use this section for reviewers, auditors, debugging agents, and other agents whose output depends on findings.

```md
# Evidence Requirements
- Base findings on concrete evidence from the repository.
- Identify the exact location relevant to each finding.
- Explain the specific behavior or invariant that is violated.
- Do not report speculative problems as confirmed findings.
- Distinguish actual defects from optional improvements.
```

This prevents low-value findings such as:

```text
This could potentially cause issues in the future.
```

without explaining what issue, where, or why.

A strong finding should answer:

```text
Where is the problem?
What is wrong?
Why is it wrong?
What behavior does it affect?
```

---

# 9. Output Format

Keep output requirements separate from the workflow.

```md
# Output
- Be concise, factual, and technical.
- Report only information relevant to the task.
- Do not include internal reasoning.
- Follow the role-specific structure below.
```

Then define the actual format.

### Example: Reviewer

```md
### Findings

- **Location:** `<path/to/file>:<line>`
- **Category:** [CRITICAL | WARNING | SUGGESTION]
- **Details:** [Concrete explanation of the issue and its impact]
```

### Example: Implementer

```md
### Summary
[1-2 sentences describing what was changed]

### Changes
- `<path/to/file>` — [what changed]

### Verification
- `[command]` — [result]
```

### Example: Auditor

```md
### Summary
[1-2 sentences summarizing the audit]

### Findings
- **Location:** `<path/to/file>:<line>`
- **Category:** [CRITICAL | WARNING | SUGGESTION]
- **Details:** [Evidence-based explanation]
```

Do not force every agent into the same output format.

The output structure should match the agent's role.

---

# 10. Category Definitions

If the output uses severity or finding categories, define them.

For example:

```md
### Category Definitions

- **CRITICAL:** A concrete issue that causes incorrect behavior, data loss, security problems, or a guaranteed failure.
- **WARNING:** A concrete defect or significant correctness/reliability risk that should be addressed.
- **SUGGESTION:** An optional improvement that does not affect correctness.
```

Avoid mixing different concepts into the same category system.

For example:

```text
CRITICAL | WARNING | SUGGESTION | CHANGE
```

mixes **severity** with **action/state**.

If `CHANGE` means "the agent changed the code," it belongs in an implementation output rather than a review severity scale.

---

# 11. Prompt-Specific Rules

Add additional rules only when they address a real requirement of this agent.

```md
# Task-Specific Rules
- [Specific rule]
- [Specific invariant]
- [Specific domain constraint]
```

Examples:

```md
- Do not change database schema behavior without a migration.
- Preserve API response compatibility.
- Use existing repository abstractions instead of introducing alternatives.
- Tests must cover the newly introduced behavior.
```

Avoid filling this section with generic software-engineering advice.

---

# Recommended Complete Structure

A production system prompt will usually work well with this order:

```md
# Role & Objective

# Authority & Decision Boundaries

# Scope

# Constraints & Invariants

# Write Policy

# Operating Procedure

# Verification & Failure Handling

# Evidence Requirements

# Output

# Category Definitions

# Task-Specific Rules
```

Not every agent needs every section.

A simple agent might only need:

```text
Role
Scope
Constraints
Procedure
Output
```

A more autonomous implementation agent may need the full structure.

---

# Authoring Principles

When writing a custom system prompt, follow these principles:

### 1. One responsibility

Give the agent one clear job.

### 2. Concrete over generic

Prefer:

```text
Preserve existing API behavior.
```

over:

```text
Write robust code.
```

### 3. Evidence over assumptions

Tell the agent where it should obtain missing information.

```text
Inspect existing callers before changing an interface.
```

### 4. Boundaries over exhaustive instructions

Define what the agent must not do rather than trying to describe every possible implementation.

### 5. Smallest coherent change

Prefer the smallest change that correctly satisfies the task, not the smallest textual diff at any cost.

### 6. Separate authority from procedure

"May modify tests" is an authority rule.

"Run tests after implementation" is a procedure rule.

Keep those concepts separate.

### 7. Define failure behavior

Every important action should have a reasonable failure path.

### 8. Make completion observable

The agent should know what evidence demonstrates that the task is finished.

### 9. Keep output role-specific

A reviewer, planner, implementer, and auditor should not all report the same way.

### 10. Avoid speculative instructions

Do not add rules for hypothetical problems unless the agent has actually demonstrated that failure mode.

### 11. Avoid redundant instructions

If two rules express the same constraint, combine them.

### 12. Prefer a short strong prompt over a long defensive prompt

The objective is not to cover every conceivable behavior.

The objective is to make the intended behavior **unambiguous**.

---

# Final Checklist

Before using a custom system prompt, verify:

* [ ] Is the agent's single responsibility obvious?
* [ ] Is the expected outcome concrete?
* [ ] Is its decision-making authority clear?
* [ ] Is its scope clear?
* [ ] Can it modify everything it actually needs to modify?
* [ ] Are important invariants explicitly stated?
* [ ] Are unrelated changes prohibited?
* [ ] Are dependencies governed explicitly?
* [ ] Does it inspect the repository before acting?
* [ ] Does it know how to handle ambiguity?
* [ ] Does it know what verification to run?
* [ ] Does it know what to do when verification fails?
* [ ] Are findings required to have concrete evidence?
* [ ] Is the output format appropriate for the role?
* [ ] Are severity/category definitions unambiguous?
* [ ] Are there any redundant or vague instructions?
* [ ] Does every instruction prevent a real failure mode?
* [ ] Can any section be removed without changing intended behavior?

If several instructions fail the last question, the prompt is probably becoming unnecessarily large.

---

# Minimal Starting Template

When creating a new agent, start here rather than copying the full template blindly:

```md
# Role & Objective
You are a [Role].

Your single responsibility is to [exact outcome].

# Authority & Decision Boundaries
- Make decisions required to complete the task.
- Treat the task specification as authoritative.
- Derive unspecified implementation details from the repository.
- Do not invent requirements or behavior.
- Do not expand scope through unrelated work.

# Scope
- **Primary Scope:** [target]
- **Supporting Scope:** Files directly required to complete the task.
- **Excluded Scope:** Unrelated code and behavior.

# Constraints & Invariants
- Match existing architecture, naming, and idioms.
- Prefer the smallest coherent change that satisfies the task.
- Preserve behavior outside the requested change.
- [Task-specific invariants]

# Write Policy
[READ-ONLY or READ-WRITE policy]

# Operating Procedure
1. Inspect the relevant repository context.
2. Establish existing behavior.
3. Perform the task within scope.
4. Run required verification.
5. Fix failures caused by the work when within scope.
6. Re-run verification.

# Verification & Failure Handling
- Do not bypass or weaken verification.
- If verification cannot be completed, report what was attempted and why.
- If required information cannot be determined from the task or repository, report the specific ambiguity.

# Output
- Be concise and factual.
- Report only task-relevant information.
- Follow the role-specific output format.

[ROLE-SPECIFIC OUTPUT FORMAT]
```
