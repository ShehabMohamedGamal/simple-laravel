# Volere-Lite Skeleton

Read this when assembling the PRD document. Section numbers are stable — skip inapplicable sections, do not renumber.

## Contents

- The 13 sections with include/skip rules
- Quality Check table

## Sections

```markdown
## 1. Problem, goals, and success measures — ALWAYS
## 2. Scope and out of scope — ALWAYS
## 3. Stakeholders and user groups — ALWAYS
## 4. Glossary — IF terms disputed or >5 domain terms, else skip
## 5. Current context and product boundary — IF replacement or external system touched, else skip
## 6. User journeys or product use cases — ALWAYS (strawmen marked "assumption to correct")
## 7. Functional requirements — ALWAYS (ID + statement + fit + MoSCoW)
## 8. Data and interfaces — IF data stored or integration exists, else mark N/A in Quality Check
## 9. Quality attributes — IF performance/usability/security/compliance mentioned, else N/A
## 10. Constraints, assumptions, and risks — ALWAYS
## 11. Open questions — ALWAYS (even if "none"; format: question | affected area | blocks/risks)
## 12. Deferred backlog — IF Won't/Could-deferred exist (waiting room), else skip
## 13. Quality check — ALWAYS (table below)
```

Keep each section compact. Tables over paragraphs. No traceability columns in the PRD.

## Quality Check (end of document, verbatim labels)

```markdown
## Quality Check
| Check | Status |
|---|---|
| ambiguity | passed / open question / not applicable |
| atomicity | passed / open question / not applicable |
| fit criteria | passed / open question / not applicable |
| conflicts | passed / open question / not applicable |
| exceptions / boundaries | passed / open question / not applicable |
| CRUD / data coverage | passed / open question / not applicable |
| interfaces | passed / open question / not applicable |
| quality attributes | passed / open question / not applicable |
| priority | passed / open question / not applicable |
```
