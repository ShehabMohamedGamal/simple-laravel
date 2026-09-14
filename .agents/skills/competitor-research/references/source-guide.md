# Source Guide

Read this before searching. It defines what counts as evidence.

## Contents

- Source hierarchy
- Citation format
- Observed vs hypothesis + example

## Source hierarchy (in order)

1. First-party fact sources: official product pages, docs, changelogs, help centres, public demos, pricing pages, app-store listings owned by the product. Use for `Observed capability` only.
2. Independent reviews, blog posts, forums: use only to form `Hypothesis to validate`, never as capability fact.
3. Banned: login-walled content described from memory, guessed URLs, AI summaries cited as sources.

## Citation format

Every factual claim carries `URL + retrieval date`. Format:

```markdown
- AutoSoft supports SMS reminders ([auto.example/sms](https://auto.example/sms), retrieved 2026-09-03)
```

No URL → not an observed capability. Demote to hypothesis or drop.

## Observed vs hypothesis

- `Observed capability`: first-party source seen this session, cited above. It is still a fact about another product — never a requirement of the current client. Every row needs client validation before entering a brief or PRD.
- `Hypothesis to validate with the client`: pattern from reviews, UI analysis, or adjacent systems; needs client confirmation. UI/interface analysis reveals hypotheses, never requirements.

Mine complaints explicitly: repeated 1-3 star review themes go to the `limitation / complaint theme` column as hypotheses. Collect pricing only if the objective mentions monetization, pricing, or packaging — then a `pricing model` column holds observed facts with URL + date.

Example rows:

```markdown
| product | observed capabilities | limitation / complaint theme | target user | notable workflow | source |
|---|---|---|---|---|---|
| AutoSoft | SMS reminders, bay calendar | reviews cite slow support (hypothesis) | shop owners | drag job across bays | auto.example (2026-09-03) |

Pricing column only when the objective asks about monetization: `| product | observed capabilities | pricing model | limitation / complaint theme | target user | source |`.
```

```markdown
## 5. Neutral interview probes
- "How do you currently remind customers, and what fails about it?" (from SMS-reminder pattern — do not mention AutoSoft by name)
```
