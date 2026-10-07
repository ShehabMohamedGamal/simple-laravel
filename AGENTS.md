# Agents root guide

This repo holds two self-contained Laravel template profiles. Each one is a full Laravel app with its own agent environment.

- `simple/` — the original single-app Laravel template. Read `simple/AGENTS.md` before editing anything under `simple/`.
- `modules/` — the same template organized into nwidart modules with a repository layer. Read `modules/AGENTS.md` before editing anything under `modules/`.

## Working at the root

The root holds only shared state and plumbing. Laravel app code always lives inside a profile directory.

- Run composer, artisan, pest, and `composer verify` inside the profile directory you are editing.
- `.agents` and `.opencode` at the root are symlinks into `simple/`, so skills and gates load at the root too. The canonical copies live in each profile.
- The Laravel Boost MCP server runs against `simple/artisan` for root-level sessions.
- `.beads/` is the one issue store for the whole repo; operate `bd` from the root. See `docs/agents/issue-tracker.md` inside either profile.

## Codebase index

Each profile carries its own codebase-index tooling under `scripts/`. Run it from inside the profile you are exploring, so the index covers that profile's code.
