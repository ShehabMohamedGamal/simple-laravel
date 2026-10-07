### Beads (`bd`) issue tracker: `docs/agents/issue-tracker.md`

Issues live in beads, a local store under `.beads/`, operated via the `bd` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles are native beads labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`); set with `bd create -l` / `bd label add`, filter with `bd list -l <role>`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout when they exist. See `docs/agents/domain.md`.

### Grilling sessions

Open every grilling interview with the session setup in `docs/agents/grilling-session.md`: list topics, agree the structure, track topics with the todo tool.

### Docs retrieval

Ground every library API call in version-correct docs before writing it. Fall through MCP → `docs/agents/llms/` slices → Context7 → web, and save Context7 hits as slices. See `docs/agents/docs-retrieval.md`.

### Codebase index

Find → Trace. Before investigating repository implementation, symbols, references, dependencies, data flow, or bugs, query the `codebase_index` tool. Prefer a direct index query over an Explore subagent or broad repository scan. Delegate exploration only when indexed evidence and targeted lookups cannot answer the question.

If the tool is unavailable, use `bash scripts/codebase-index.sh query <command> <arguments> --json` or `./scripts/codebase-index.ps1 query <command> <arguments> --json`. These wrappers prevent implicit builds and skill updates. The table gives the retrieval command and arguments.

| Question | Command |
| --- | --- |
| Where is X implemented? | `search "X"` |
| Find a named symbol | `symbol "X"` |
| Who calls or references X? | `refs "X"` |
| How does X work? | `explain "X"` |
| Describe a file or symbol | `describe "X"` |
| How are X and Y connected? | `path "X" "Y"` |

Use the default hybrid search for mixed questions, `--mode symbol` for exact symbols, and `--mode fts` for text or error messages. Use `--mode vector` only when embeddings are enabled and the exact vocabulary is unknown. Never run `impact`, `diff-impact`, `architecture`, or `graph`.

Start with ranks 1–3. Read `recommended_reads` line ranges rather than whole files. Trace another hop only when behavior or ownership requires it. If a skeletonized snippet omits relevant code, read its supplied range.

Check index freshness and result confidence before trusting evidence. Agents only retrieve; the OpenCode plugin owns automatic indexing. Never run `index`, `update`, or the control script's `refresh` to repair a query. For missing, stale, unavailable, or low-confidence evidence, use narrow grep/glob lookups and confirm claims against current files. Follow `fallback_suggestions` when available.

On `refs`, partial coverage makes an empty result inconclusive; confirm absence with targeted grep. Treat extracted edges as parser evidence and inferred or ambiguous edges as uncertain. Answer with the direct conclusion and supporting `file:line` evidence. State uncertainty when it affects the conclusion; omit search narration.

### AI rules

`.ai/rules/` holds code conventions scoped by glob. Read `.ai/rules/index.md` and every rule file whose globs match the paths you are editing before you write code.

### Verification

Stage the work and run `composer verify` before you commit. Treat gate failures as findings and fix them.

Two gates decide the result: pest in parallel, and type coverage at a minimum of 80 percent. A failure ends with a `FAILED GATES:` line naming the failed gates. Never weaken a gate, an ignore pattern, or a test to make a failure disappear.

Steps labeled `report:` never fail the chain and carry no threshold. Their output is feedback for the agent: act on what it surfaces, and never weaken a gate because of it.

Manual tools:  `vendor/bin/rector --dry-run` (refactor preview; rector sits outside the chain).

### Writing

These rules govern all prose an agent produces: replies, tickets, PRDs, review comments, commit messages, docs.

- use a conversational style
- Write in active voice, one idea per sentence. Name the actor. 
-  Cut filler ("in order to" becomes "to") and hedging.
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
