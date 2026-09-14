---
name: interview-prep
description: Prepares a live client interview brief, strawman, capture sheet, or coverage ledger for an SWE who meets the client alone. Use when the user explicitly invokes interview-prep to prepare a client interview. Do not use for market research or PRD writing.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
---

## What I do

- Produce live-usable material for `requirements/elicitation/`: `session-brief.md`, `strawman.md`, `capture-sheet.md`.
- After inputs, always suggest the artifact menu below and confirm before writing. Never assume the user remembers the list.
- Interviews only. Never simulate a client conversation. Never write requirements or a PRD.

## Required inputs (ask once, then proceed)

| Input | Example |
|---|---|
| `objective` | "Confirm scope for repair-shop MVP" |
| `roles` | "shop owner, dispatcher" |
| `duration` | "60 min" (if omitted, assume 45-60 and state the assumption) |
| `context` | existing system, project folder, prior research path if any |

If `objective` or `roles` is missing: ask once in a single message, then proceed with stated assumptions. Do not block on `context`.

## Procedure

1. Validate inputs per table above.
2. Auto-detect context — do not ask for what already exists:
    - If `requirements/research/market-landscape.md` exists, read it for strawman ideas. Research = prior solutions (agent Evidence). Hypotheses only; mark derived questions `[pattern]` per the brief format.
    - If `requirements/elicitation/` already holds prior briefs, read the latest `session-brief*.md` and carry its Deferred appendix forward (mark covered, add new defers). If `requirements/prd-draft.md` exists, read it so settled topics are never re-asked.
3. Suggest artifacts with this menu (after inputs, before writing). Recommend a default with one line of why, then ask to confirm:
    - `session-brief.md` — 1-page live brief with highest-risk questions + deferred appendix (recommended: always).
    - `capture-sheet.md` — bullet notes for live use (recommended: always with a brief).
    - `strawman.md` — draft use-case list / flow marked as assumption (recommended: if replacement or workflow-heavy).
   If the user named artifacts explicitly, confirm that selection instead of re-suggesting. If they confirm the recommendation or say "all" / "default", proceed. Default when they skip the choice: `session-brief.md` + `capture-sheet.md`.
4. Load reference files conditionally — only for selected artifacts:
    - Writing `session-brief.md` → read `references/session-brief-format.md`.
    - Writing `capture-sheet.md` → read `references/capture-sheet.md`.
    - Writing `strawman.md` → no reference file; follow the 3 strawman rules in the tree.
5. Create `requirements/elicitation/` if needed. Write selected files.
6. Report files written + topics deferred from the live brief + whether research context was used.

## Artifact decision tree

```
requested artifact explicitly named? → write exactly that, nothing else.
else → session-brief.md + capture-sheet.md.

session-brief.md → ALWAYS when preparing an interview (1 page, live-use). Deferred themes go to a `## Deferred (appendix)` section at the end of the brief with a status each (`ask now` / `covered` / `later → phN`) — never a separate file. Next session rolls statuses forward.
strawman.md → IF user requests it AND (replacement system OR workflow-heavy).
  Rules: use-case list by default; Mermaid per agent style.
  Label header: "Assumption to correct — not agreed design."
capture-sheet.md → ALWAYS alongside a brief (bullet notes for live use).
```

## Stop rules

- STOP after writing files. Only requested artifacts under `requirements/elicitation/`; nothing else.
- Do not add facilitation theory or requirement classifications.

## Completion evidence

Return: files written (paths), assumption made about duration if any, topics deferred (list). Example: `Wrote requirements/elicitation/session-brief.md, capture-sheet.md. Deferred: reporting, migration.`
