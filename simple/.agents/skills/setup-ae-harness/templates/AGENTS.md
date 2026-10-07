### Beads (`bd`) issue tracker: `docs/agents/issue-tracker.md`

Issues live in beads, a local store under `.beads/`, operated via the `bd` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles are native beads labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`); set with `bd create -l` / `bd label add`, filter with `bd list -l <role>`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout when they exist. See `docs/agents/domain.md`.

### Docs retrieval

Docs fallthrough: MCP → `docs/agents/llms/` slices → Context7 (max 2) → web. See `docs/agents/docs-retrieval.md`.

### Capability registry

Agents never hardcode skill or agent names. Resolve capability defaults in `docs/agents/registry.md`; the prompter overrides.

### Writing

These rules govern all prose an agent produces: replies, tickets, PRDs, review comments, commit messages, docs.

- Write in active voice, one idea per sentence. Name the actor. Prefer facts and numbers over feelings.
- Prefer the plain word ("use", not "utilize"). Cut filler ("in order to" becomes "to") and hedging.
- No AI tells: no em dashes, no puffery ("crucial", "seamless", "pivotal"), no "not just X, but Y", no bold-label list items that restate their own line, sentence-case headings, no chatbot phrases ("I hope this helps", "Great question!").
- Use the exact terms in `CONTEXT.md`'s glossary. If a concept has no glossary term, flag it instead of inventing one.
- When writing for the user, lean toward Simplified Technical English (short declarative sentences, common words) where it doesn't cost precision. Preference, not mandate.
