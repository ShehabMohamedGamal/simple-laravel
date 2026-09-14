---
name: prd-builder
description: Turns SWE-returned elicitation evidence into a draft or final Volere-lite PRD with fit criteria and MoSCoW priorities. Use when the user explicitly invokes prd-builder for requirements/prd-draft.md or requirements/prd-phN.md. Do not use for session prep or market research.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
---

## What I do

- Draft: clarify evidence gaps that change the draft, then write `requirements/prd-draft.md`.
- Finalise: only on explicit "finalise + project folder", then write `requirements/prd-phN.md`.
- Retain uncertainty as `## Open Questions` — never fabricate client facts.

## Required inputs

| Input | Rule |
|---|---|
| `mode` | `draft` or `finalise`. If ambiguous, assume `draft`. |
| `phase` | optional increment label (`ph1`, `ph2`…). Draft always covers the current phase; backlog queues the rest. |
| `evidence` | paths under `requirements/elicitation/` and `requirements/research/`. Read what exists; never assume live client access. Research = prior solutions; needs elicitation evidence for Must/Should. |
| `project folder` | required for `finalise` only. If missing, stay in `draft`. |

## Procedure

1. Read evidence files present. Do not create `analysis.md`.
2. Clarify with `grill-me` only while an answer materially changes the draft:
   - Draft rounds: business goal → scope → stakeholders → main journeys → decisive constraints. Stop when further answers only add detail.
   - Finalise rounds: necessary closing gaps only.
3. Select PRD sections using the applicability tree below. Load refs conditionally:
   - Writing any requirement → read `references/requirement-quality.md`.
   - Writing the document skeleton → read `references/volere-lite.md`.
4. If open questions hit scope, interfaces, security/compliance, acceptance, data ownership, or release: alert the SWE before writing, but proceed unless told to stop.
5. Write the PRD, end with `## Quality Check`, report file + open questions.
6. Iterative rule — one rolling draft, separate per-phase contracts: `requirements/prd-draft.md` always holds the current phase + Open Questions + Backlog (next phases). On `finalise` for phase N: move settled requirements out to immutable `requirements/prd-phN.md`, prune the draft back to live-phase content only, and move `requirements/elicitation/` files to `requirements/archive/phN/` (archive, never delete — traceability). §12 backlog is the next-increment queue: every deferred item gets a phase (`later → phN`), never parks unowned.

## Applicability decision tree

```
mode = finalise AND explicit request + folder? → requirements/prd-phN.md (immutable contract for phase N; restate shared context only if the phase touches it, else one-line pointer to ph1)
else → requirements/prd-draft.md (current phase + open questions + backlog)

Include ALWAYS: 1 problem/goals, 2 scope, 3 stakeholders, 6 journeys/use-cases,
  7 functional, 10 constraints/assumptions/risks, 11 open questions, 13 quality check.
Include IF:
  terms disputed or >5 domain terms? → 4 glossary, else skip.
  replacement OR external system touched? → 5 current context + boundary, else skip.
  data stored OR integration exists? → 8 data + interfaces, else mark N/A.
  performance/usability/security/compliance mentioned? → 9 quality attributes, else N/A.
   deferred items exist OR working in phases? → 12 backlog (next-increment queue, each item phased), else skip.
Mermaid per agent style.
```

Mermaid, glossary, and backlog are the three most over-generated sections — default to skip.

## Stop rules

- STOP inventing: metrics, decisions, dates, owners without evidence → `Open Questions` with `blocks / risks`.
- Do not block finalisation solely because questions remain.
- Only `requirements/prd-draft.md` or `requirements/prd-phN.md`; nothing else.

## Completion evidence

Return: path written, requirement count (Must/Should/Could/Won't), open-question count + which areas they block. Example: `Wrote requirements/prd-draft.md. 12 Must, 5 Should. 3 open questions (scope, data ownership).`
