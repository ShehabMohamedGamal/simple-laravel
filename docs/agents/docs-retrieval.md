# Docs retrieval

How the implementer gets version-correct docs. Linear fallthrough. First hit wins.

## Order

1. **MCP.** If `AGENTS.md` names one for this stack, use it. Trust it. SWE owns drift.
2. **Local slices.** Pin the version from the repo (`package.json`, lockfile, or `<tool> -v`). Read `docs/agents/llms/<lib>-<ver>/index.md`, run `rg -l "<topic>" llms/<lib>-<ver>/`, and read the one slice hit. One slice only, never the full dir.
3. **Context7.** Use the shared cache MCP server. Run `context7_resolve-library-id`, then `context7_query-docs`. In Code Mode, use `tools.context7["resolve-library-id"]` and `tools.context7["query-docs"]`. One topic per call, max 2 calls per task. Cached (30d resolve, 7d docs).
4. **Web.** First-party pages, docs, and changelogs only.

Missing `index.md` = miss. Move to next step. Never invent APIs.

## Local layout

```
llms/<lib>-<ver>/
├── index.md          ← TOC: topic → file → source URL + date, ~30 lines max
└── <topic>.md        ← one topic each, short
```
