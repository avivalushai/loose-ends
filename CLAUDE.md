# Loose Ends — working rules

Read `SPEC.md` first. It is the source of truth for scope, data model and behaviour.

## Stack
- Node 20+, TypeScript, ESM. No framework for the CLI (use `commander` or plain argv parsing).
- Tests with `vitest`. Every CLI command gets a test against a temp directory.
- UI: start from `prototype/loose-ends.html`; keep it a single page served by the local server.

## Rules
- Before writing plugin files (manifest, hooks, skills, commands, marketplace), check the current Claude Code plugin docs for exact file names and formats. Don't guess.
- All board writes go through the CLI. Never hand-edit `board.json` in code paths.
- Keep `board.json` backward compatible: bump `schemaVersion` + add a migration for any change.
- Never send board content anywhere over the network. Analytics (later) = event names and counts only.
- Keep CLI output short. `--json` for machine output.

## Repo layout (target)
```
.claude-plugin/        plugin + marketplace manifests
skills/loose-ends/     the rules Claude follows (SKILL.md)
hooks/                 hook config + scripts
commands/              slash commands
cli/                   the `board` CLI (TypeScript)
server/                local server (API + SSE + static UI)
ui/                    the web UI (from prototype/)
prototype/             original UI prototype — reference only
```

## Dogfooding
Once phase 2 works, this repo uses its own board: `.board/board.json`.
