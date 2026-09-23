# Loose Ends

A feature board Claude keeps for you while you build — per project, updated automatically, with everything you left halfway front and center.

- `SPEC.md` — product + technical spec
- `CLAUDE.md` — rules for Claude Code in this repo
- `FIRST_PROMPT.md` — what to paste into Claude Code to start
- `prototype/loose-ends.html` — working UI prototype (open in a browser)
- `DOGFOOD.md` — the phase 4 log: what to watch for while using it
- `site/README.md` — the public site, and the accounts it needs

## Try it

```
npm install && npm run build && npm test
./bin/board context
```

## See the board

```
./bin/board ui
```

Opens http://localhost:4747 — every registered project, live-updating as Claude writes.

## Install the plugin (local, before it's on GitHub)

In Claude Code, from any project:

```
/plugin marketplace add ~/Projects/loose-ends
/plugin install loose-ends@loose-ends
```

Then `/loose-ends:board status`, `/loose-ends:park`, `/loose-ends:done`.
