### Beads (`bd`) issue tracker: `docs/agents/issue-tracker.md`

Issues live in beads, a local store under `.beads/`, operated via the `bd` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles are native beads labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`); set with `bd create -l` / `bd label add`, filter with `bd list -l <role>`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout when they exist. See `docs/agents/domain.md`.

### Grilling sessions

Open every grilling interview with the session setup in `docs/agents/grilling-session.md`: list topics, agree the structure, track topics with the todo tool.

### Docs retrieval

Docs fallthrough: MCP → `docs/agents/llms/` slices → Context7 (max 2) → web. See `docs/agents/docs-retrieval.md`.

### AI rules

`.ai/rules/` holds code conventions scoped by glob. Read `.ai/rules/index.md` and every rule file whose globs match the paths you are editing before you write code.

### Verification

Stage the work and run `composer verify` before you commit. Treat gate failures as findings and fix them.

Three gates decide the result: the no-comments gate on the staged diff, pest in parallel, and type coverage at a minimum of 80 percent. A failure ends with a `FAILED GATES:` line naming the failed gates. Never weaken a gate, an ignore pattern, or a test to make a failure disappear.

Steps labeled `report:` never fail the chain and carry no threshold. Their output is feedback for the agent: act on what it surfaces, and never weaken a gate because of it.

Manual tools:  `vendor/bin/rector --dry-run` (refactor preview; rector sits outside the chain).

### Writing

These rules govern all prose an agent produces: replies, tickets, PRDs, review comments, commit messages, docs.

- Write in active voice, one idea per sentence. Name the actor. Prefer facts and numbers over feelings.
- Prefer the plain word ("use", not "utilize"). Cut filler ("in order to" becomes "to") and hedging.
- No AI tells: no em dashes, no puffery ("crucial", "seamless", "pivotal"), no "not just X, but Y", no bold-label list items that restate their own line, sentence-case headings, no chatbot phrases ("I hope this helps", "Great question!").
- Use the exact terms in `CONTEXT.md`'s glossary. If a concept has no glossary term, flag it instead of inventing one.
- When writing for the user, lean toward Simplified Technical English (short declarative sentences, common words) where it doesn't cost precision. Preference, not mandate.

===

### Laravel stack

Laravel on PHP 8.5. Confirm a package's installed version before relying on its API: `composer show <package>` for PHP packages, `package.json` for JS packages.

Do not add dependencies, create new base folders, or create documentation files without approval.

### Boost MCP tools

Laravel Boost serves MCP tools for this app. Use `search-docs` before changes that depend on Laravel ecosystem APIs, behavior, configuration, or version-specific syntax. Pass a `packages` array to scope results, and use broad topic queries without package names. Use `database-schema` to inspect table structure before writing migrations or models, and `database-query` for read-only queries instead of raw SQL in tinker. Use `get-absolute-url` before sharing a project URL, and `browser-logs` for recent browser errors.

### Artisan and tinker

Run Artisan commands directly: `php artisan list` discovers them, `php artisan [command] --help` checks parameters, `php artisan route:list` inspects routes, `php artisan config:show app.name` reads config. Pass `--no-interaction` and the correct options when a command must run without input.

For tinker, use single outer quotes and double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

### Laravel skill

The `laravel` skill holds the Laravel rule index, test design rules, Tailwind v4 guidance, and one-shot `pest --agent` verification. See `docs/agents/registry.md` for the capability registry.
