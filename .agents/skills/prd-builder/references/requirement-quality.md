# Requirement Quality

Read this when writing any functional, quality, or constraint requirement.

## Contents

- Classification (PRD-only subset)
- Atomic statement + fit criterion + MoSCoW
- Bad → good examples
- Anti-rationalization

## Classification

Classify each candidate as exactly one of: business requirement, user requirement, business rule, functional requirement, quality attribute, external interface requirement, constraint, data requirement, assumption, dependency, open question, solution idea.

Rules:

- Keep `solution idea` separate — never file it as a requirement.
- A named technology, UI control, or implementation approach is a `constraint` only with a non-negotiable stakeholder rationale. Otherwise it is a `solution idea`.
- Traceability (source + date) lives in elicitation/research files, not the PRD.

## Atomic statement + fit criterion + MoSCoW

Each committed requirement carries `ID + statement + fit criterion + priority`:

- `ID`: `FR-1`, `QA-1`, `C-1`, stable across drafts.
- Statement: positive, active, single need. No negatives, `i.e.`, `e.g.`, `A/B`, unexplained abbreviations, synonyms, or vague adverbs (`quickly`, `appropriately`, `significantly`).
- Fit criterion: how an independent reviewer verifies it — threshold + workload + percentile where applicable.
- Priority: `Must`, `Should`, `Could`, `Won't for this release`. Deferred → section 12 backlog, never deleted.

## Bad → good

- Bad: "Respond quickly to search."
  Good: `FR-4: Return job search results. Fit: 95% of queries < 800ms at 50 concurrent users. [Must]`
- Bad: "Support admin panel (e.g. users, reports, etc.)."
  Good: split into atomic `FR-5` (manage users), `FR-6` (export monthly report) each with own fit criterion.

## Completeness sweep (before Quality Check)

Check: exceptions/alternate flows; boundary + else cases; CRUD per material entity; interfaces; access/security; reporting; audit; backup/recovery; migration; operational, performance, usability, accessibility, legal, support.

## Anti-rationalization

- "No time for fit criteria" → write a placeholder `Fit: TBD — blocks acceptance (open question)` instead of skipping.
- "Two needs in one ID for brevity" → split. One ID = one test.
- "Client implied this metric" → label `assumption` or `open question`. Never present inference as requirement.
