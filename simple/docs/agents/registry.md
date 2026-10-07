# Capability registry

Agents never hardcode skill or agent names. An agent states the capability it needs and resolves the default from this file. The prompter overrides the default by naming a different skill or agent in the prompt. Skills may compose other skills directly.

Add a line when a new capability appears. Keep one line per capability.

## Skills

| Capability | Kind | Default | Use when |
| --- | --- | --- | --- |
| Implementation loop | skill | `implement-loop` | prep setup, build toolbench, wrap-up verify-as-feedback gates, fix-round budget |
| Test-driven development | skill | `tdd-lite` | red-green loop, test seams, test anti-patterns |
| Laravel ecosystem work | skill | `laravel` | backend rules, test design, Tailwind v4, one-shot `pest --agent` checks |
| Repository index queries | tool | `codebase-index` | repository investigation; follow the Codebase index section in `AGENTS.md` |

## Agents

| Capability | Kind | Default | Use when |
| --- | --- | --- | --- |
| Three-axis code review | agent | `reviewer` | standards, spec, and correctness review of a diff; report-only |
