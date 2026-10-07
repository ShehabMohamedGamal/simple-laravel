# Laravel template, two profiles

One repo, two self-contained Laravel template profiles:

- `simple/` — the original single-app Laravel skeleton.
- `modules/` — the same skeleton organized into nwidart/laravel-modules modules with a repository layer.

Each directory is a complete standalone project: full Laravel app, its own composer and npm setup, its own verify chain, docs, skills, and agent rules. Copy a profile directory out to start a project from it, or work inside it here.

## Working in this repo

- `cd` into a profile before running composer, artisan, or `composer verify`.
- `AGENTS.md` at the root routes agents to the right profile guide.
- `.beads/` at the root is the shared issue store; `bd` runs from the root.
