Create the following in beads (bd), all grilling-style briefs (goal + pointers + recorded pain points + explicit open questions; instruct the assigned agent to grill before acting; no checklists):

1. Epic: "Agent-boosted Laravel template" — goal + settled session decisions (OpenCode-only harness, xdebug-mcp out of scope, token efficiency as cross-cutting constraint, grilling-ticket convention).
2. T1: Rewrite agent system prompts — five agents in .opencode/agents/, using docs/system prompt guide.md; workflow-agnostic prompts; pain points: agents ignore system prompts, planner eager to write instead of plan. (child of epic 1)
3. T2: Docs layer — AGENTS.md, skills (.agents/skills, .opencode/skills, skills-lock.json), docs/agents/*; agent workflow specialization lives here. (child of epic 1)
4. T3: Git hooks and the feedback loop — composer verify gate chain (pint --test, analyse, rector --dry-run, test) + pre-commit hooks, building on .beads/hooks and the no-comments gate/plugin; xdebug-mcp out of scope. (child of epic 1)
5. Epic: "High-level workflow fine-tuning" — T4 promoted to its own epic: end-to-end agentic workflow improvement as its own round of work (planning → tickets → implementation → review loops, session conventions, wayfinder usage), tuned after T1–T3; child tickets to be authored during its grilling pass.
6. Epic: "Modular MVC profile (nwidart/laravel-modules)" — modular branch forked at divergence-point tag; child tickets authored when branch is cut.

No dependency edges (user sequences manually). Housekeeping (delete CLAUDE.md, relocate the guide, Sail build fix) is the user's own; not ticketed. Nothing else is modified.