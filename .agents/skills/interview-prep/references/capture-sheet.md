# Capture Sheet

Read this only when writing `capture-sheet.md`.

File: `requirements/elicitation/capture-sheet.md`. Bullets, not tables — fill during the call, one `Date` + `Session` line for the whole file. `Source` only when it matters, inline as `(src: …)`.

Where to put it: heard a decision or need → `Needed`. Unsure, assumed, or conflicting → `Unsure` (conflicts flagged inline with `⚠ conflicts with …`). Task for someone → `Next`. Off-topic → `Later`.

```markdown
Date:
Session:

## Needed (decisions + requirement candidates)
- _e.g. Invoices go out on job close — owner: shop owner_
- ⚠ _e.g. SMS reminders required — conflicts with "no-shows are rare" above_

## Unsure (assumptions + open questions)
- _e.g. Assume dispatcher owns the bay calendar until told otherwise_
- _e.g. Do parts get reserved at booking or at job start? blocks scheduling_

## Next (actions, owner inline)
- _e.g. Send sample invoice — shop owner, by Friday_

## Later (parking lot)
- _e.g. Loyalty programme — out of MVP scope_
```
