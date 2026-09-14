## Goal

Give this repo its own tracked copy of the context7-cache OpenCode plugin and a README documenting installation, usage, and what it provides.

## Steps

1. **Copy the built plugin** from `~/.config/opencode/plugins/context7-cache.js` to `.opencode/plugins/context7-cache.js`. It is a self-contained bundle (zod and the Context7 SDK are inlined), so no npm install is needed. OpenCode auto-loads it for this project, matching the existing local plugins (`no-comments.ts`, `session-log.ts`).

2. **Write `.opencode/plugins/context7-cache.md`** (README for the plugin) covering:
   - **What it provides**: a persistent TTL cache in front of `@upstash/context7-sdk` that saves Context7 API calls. Four tools: `context7_resolve` (library name to Context7 ID, 30-day TTL), `context7_docs` (docs for a library ID, 7-day TTL, one topic per call), `context7_stats` (hits/misses/saved calls), `context7_clear` (clear cache, optional substring filter). Key normalization makes `/vercel/next.js@v15.1.8` and `/vercel/next.js/v15.1.8` equivalent. Errors are never cached.
   - **Installation**: in this repo it loads automatically. Elsewhere: copy the single file to `~/.config/opencode/plugins/` (global) or `./.opencode/plugins/` (per project), then restart OpenCode. Rebuild-from-source path: `/home/shehab/Projects/AE/packages/context7-cache` (`npm install && npm run build`) or `./setup.sh --global|--local` from the AE repo root.
   - **How to use**: call the tools in any OpenCode session; example invocations. Cache hits and stats work without a key; live lookups need `CONTEXT7_API_KEY` (context7.com/dashboard). Default cache location `~/.cache/context7-cache` (shared), overridable via `CTX7_CACHE_DIR` (this project already has entries in `.opencode/context7-cache/`), plus `CTX7_CACHE_TTL_SEARCH_MS`, `CTX7_CACHE_TTL_DOCS_MS`, `CTX7_CACHE_DISABLED=1`.

3. **Verify**: confirm the copied file is identical (`diff`), confirm OpenCode picks it up by checking it appears alongside the existing plugins (no config change needed).

No dependencies added, no commit unless you ask for one.