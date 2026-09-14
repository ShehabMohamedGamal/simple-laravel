---
name: competitor-research
description: Researches public competitor and alternative systems into cited market-landscape evidence for an SWE. Use when the user explicitly invokes competitor-research to map observed capabilities before client elicitation. Do not use for PRDs, requirements, or client interviews.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
---

## What I do

- Write `requirements/research/market-landscape.md`: observed capabilities, patterns, gaps, neutral probes. Prior solutions only (agent Evidence) — never client wants.
- Separate `Observed capability` (cited fact about another product) from `Hypothesis to validate` (needs client confirmation).
- Feed `interview-prep` strawmen — never state client requirements.

## Required inputs (ask once, then proceed)

| Input | Example |
|---|---|
| `domain` | "repair-shop scheduling" |
| `users` | "shop owners, dispatchers" |
| `geography` | "EG" or "any" |
| `competitors` | "AutoSoft, RepairShopr" — or `unknown` (see discovery rule) |
| `client-name` | only if user names one — require explicit "yes, research <name>" before touching it |

If `domain` missing: ask once, then proceed with stated assumptions.

If `competitors` is `unknown` or empty: discover pragmatically instead of blocking — derive 2-3 queries from `domain` + `users` (e.g. "<domain> software for <users>"), find 3-5 prior solutions (direct tools + one adjacent tool + manual baseline such as spreadsheets/WhatsApp where relevant). Cap at 5. State discovery queries and inclusion rule in `## 1. Scope`. Never invent products to fill the quota — fewer with citations beats five with guesses.

## Procedure

1. Confirm inputs per table above. Research public material only.
2. Read `references/source-guide.md` before searching — follow its source hierarchy and citation format.
3. Create `requirements/research/` if needed. Write `market-landscape.md` using the fixed sections below.
4. Report file written + hypothesis count. Do not write requirements or a PRD.

## Output sections (verbatim headers)

```markdown
# Market Landscape — <domain>
> Prior solutions researched before requirement collection. Not current-client requirements. Validate each item with the client before use.
## 1. Scope and research questions
## 2. Competitor table
## 3. Patterns worth validating
## 4. Gaps and differentiators to explore
## 5. Neutral interview probes
## 6. Sources
```

`## 1. Scope` states timeframe (`researched before requirement collection; contents are prior solutions only`), discovery queries used, and inclusion rule. Default table columns: `product | observed capabilities | limitation / complaint theme | target user | notable workflow | source`. Add a `pricing model` column only if the objective mentions monetization, pricing, or packaging.

## Stop rules

- STOP if asked to research a named client without explicit confirmation — ask first.
- STOP after `market-landscape.md`. Only requested artifacts under `requirements/research/`; nothing else.
- Do not recommend copying a competitor. Do not present reviews as capability facts.
- Do not invent URLs, capabilities, or pricing. Unverifiable claim → move to `Hypothesis` or drop.
- Staleness: every claim carries a retrieval date. Do not reuse a landscape older than ~90 days without refresh.

## Completion evidence

Return: path written, competitors covered (count), hypotheses flagged (count). Example: `Wrote requirements/research/market-landscape.md. 4 products, 6 hypotheses for client validation.`
