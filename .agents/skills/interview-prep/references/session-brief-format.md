# Session Brief Format

Read this only when writing `session-brief.md`.

## Contents

- Brief schema (fixed headers)
- Time-scaling rule
- Question shape
- Deferred appendix (replaces separate theme-cards file)

## Brief schema

Use these headers verbatim, one page max plus appendix:

```markdown
# Session Brief — <objective>
Objective:
Scope (in / out):
Duration:
Opening (2 lines max):
Agenda (timeboxed):
Primary questions (4-10, highest-risk first):
Decision points:
Recap plan (last 10%):
Closing: What did you expect me to ask?
## Deferred (appendix, only if topics deferred)
```

## Time-scaling rule

- Duration given → scale question count: 30 min = 4-5, 45-60 min = 6-8, 90+ min = up to 10. Reserve final 10% for recap + closing.
- Duration omitted → assume 45-60, write `Duration: 45-60 (assumed)` and 6-8 questions.
- Excess questions → move to `## Deferred (appendix)`, never append to the primary list.

## Question shape

Each question asks one thing. Prefer task/outcome/exception form:

- Good: "What happens when a part is out of stock mid-repair?"
- Bad: "Can you describe your process, roles, and what tools you use and why?"

Probe exceptions, boundary values, handoffs, failure paths. End the brief with the closing question verbatim.

Some questions come from patterns seen in other tools. Ask neutrally — never name the tool. Mark them `[pattern]` so the SWE knows why the question is asked. One line at the top of the generated brief explains: `` `[pattern]` = asked because other tools do this, not because you need it. ``

## Deferred appendix (deferred themes only, no separate file)

One subsection per deferred theme, directly in the brief. Each carries a status: `ask now`, `covered`, or `later → phN`. Later sessions roll statuses forward — mark what got covered, add new defers.

```markdown
## Deferred (appendix)
### <Theme> — <status>
Primary: <one question>
Fallback: <max two probes>
```

One primary, max two fallbacks per theme. No background paragraphs.
