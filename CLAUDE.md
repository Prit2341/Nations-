# Nations

Browser real-time grand-strategy game on a world map (OpenFront-style tile territory). Vite app; game logic in `src/territory/sim.js`, rendering and HUD in `src/main.js`.

## Mandatory: keep the notes current
Every session, before finishing a piece of work (and before any final reply), you MUST update:
1. **TASKS.md**: what is current, what is done with the date and the files changed, what waits on the user.
2. **DESIGN.md**: the rules as built, and the backlog of ideas (add user ideas to Backlog without building them).
3. **KNOWLEDGE.md**: every decision made, with date and why (including user corrections and rejected options).
4. **ChromaDB** (`.kb/`): add each new decision with `python scripts/kb.py add "<title>" "<what and why>"`. Before changing a rule, check `python scripts/kb.py search "<topic>"`.

Use absolute dates (YYYY-MM-DD). Do not skip this because the change looks small.

## Workflow
- Dev server: preview_start name "nations-dev" (port 5173).
- Build: `npm run build:artifact`, then publish `dist/nations-artifact.html` to https://claude.ai/artifact/B3aRq2aovW9HPQJ43V1zWA (always the same URL; never create a new artifact).
- Not a git repo.
- Test by fast-forwarding the sim in a browser tab: `await import('/src/territory/sim.js')` and call `sim.tick(grid, game)`; `window.nations` exposes game, grid and RULES in dev.

## Dev lab
- In the dev server `window.lab` (see `lab.help()`) (console only, no on-page UI: the user asks for a scenario and you run it) lets you set up scenarios and run probes (`lab.probe('toggle')` etc.). After any rule change, run the probes and look for loopholes before publishing. Start the game first (Random spot), and wake a background tab with a screenshot if the HUD does not appear.

## Rules of the user
- Build only what is asked; ideas go to the DESIGN.md backlog.
- HUD shows plain compact numbers, not calculations.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
