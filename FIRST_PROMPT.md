# First prompt for Claude Code

Open this folder in Claude Code and paste:

---

Read SPEC.md and CLAUDE.md. We're building Loose Ends, starting with phase 1: the `board` CLI and data model.

1. Set up the project (TypeScript, ESM, vitest).
2. Implement the board.json schema with a validator and `schemaVersion` migrations.
3. Implement the CLI commands from SPEC section 4, except `ui`, `login`, `logout`, `telemetry`.
4. Implement the registry in ~/.loose-ends/projects.json (`init` registers the project).
5. Tests for every command against temp directories.

Show me the plan first, then build. When done, run `board init` on this repo and add cards for phases 1–5 from the spec.
