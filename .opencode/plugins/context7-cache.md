# context7-cache

OpenCode plugin that puts a persistent TTL cache in front of the Context7 API. Context7 has no persistent cache of its own, so every repeated resolve or docs call costs API quota. This plugin caches both operations on disk and serves repeats from disk.

## What it provides

The plugin registers four tools in every OpenCode session:

| Tool | What it does | Cache TTL |
|---|---|---|
| `context7_resolve` | Resolves a library name (e.g. `react`, `Next.js`) to a Context7 library ID (e.g. `/facebook/react`). Ranked by the query. | 30 days |
| `context7_docs` | Returns docs for a library ID. One topic per call. | 7 days |
| `context7_stats` | Shows hits, misses, writes, and saved API calls. | n/a |
| `context7_clear` | Removes cached entries. Pass a substring (e.g. `next.js`) to clear selectively, omit it to clear all. | n/a |

Behavior details:

- Cache keys are normalized: `/vercel/next.js@v15.1.8` and `/vercel/next.js/v15.1.8` hit the same entry, and text is lowercased with collapsed whitespace.
- Errors are never cached. A failed call retries the API next time.
- Quota errors rotate to the next configured key (see `CONTEXT7_API_KEY1` below).
- The bundle is self-contained. The Context7 SDK, zod, and all dependencies are inlined into one JS file, so no `npm install` is needed.

## Install

In this repo the plugin lives at `.opencode/plugins/context7-cache.js` next to the other local plugins (`no-comments.ts`, `session-log.ts`). OpenCode loads it automatically on start. Replace the file and restart OpenCode to update.

To install in another project, copy the single file and restart OpenCode:

```bash
# all projects
cp .opencode/plugins/context7-cache.js ~/.config/opencode/plugins/

# one project
cp .opencode/plugins/context7-cache.js <project>/.opencode/plugins/
```

To rebuild from source, use the package in the AE monorepo:

```bash
cd /home/shehab/Projects/AE/packages/context7-cache
npm install
npm run build        # outputs dist/
```

Or install a fresh build with the AE repo's setup script, which bundles the plugin into a single file:

```bash
cd /home/shehab/Projects/AE
./setup.sh --global  # installs to ~/.config/opencode/plugins/context7-cache.js
./setup.sh --local   # installs to ./.opencode/plugins/context7-cache.js
```

To update later: `git pull --rebase` in the AE repo, then re-run setup.

## Use

Call the tools from any OpenCode session. The agent picks them up as ordinary tools, so you can also just ask in plain language ("resolve laravel on context7", "get docs for /laravel/docs about middleware").

Live lookups need an API key:

```bash
export CONTEXT7_API_KEY=ctx7sk-...
```

Get a key at https://context7.com/dashboard. For quota headroom, set numbered fallback keys (`CONTEXT7_API_KEY1` through `CONTEXT7_API_KEY50`); the plugin rotates to the next key on quota errors. Stats, clear, and cache hits work without a key.

## Cache location and settings

The cache lives outside the project by default and is shared across projects: `~/.cache/context7-cache` (or `$XDG_CACHE_HOME/context7-cache`). If that path is not writable, the plugin falls back to `.opencode/context7-cache/` in the current project, then `.context7-cache/`, then the system temp dir. This project currently uses `.opencode/context7-cache/`.

| Variable | Default | Meaning |
|---|---|---|
| `CONTEXT7_API_KEY` | unset | API key from context7.com/dashboard |
| `CONTEXT7_API_KEY1` ... `CONTEXT7_API_KEY50` | unset | Fallback keys, rotated on quota errors |
| `CTX7_CACHE_DIR` | auto | Overrides the cache location |
| `CTX7_CACHE_TTL_SEARCH_MS` | 30 days | TTL for resolve entries |
| `CTX7_CACHE_TTL_DOCS_MS` | 7 days | TTL for docs entries |
| `CTX7_CACHE_DISABLED=1` | enabled | Bypass the cache, always hit the API |

Check health with `context7_stats`. `hits` equals saved API calls.
