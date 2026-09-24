# Loose Ends

A feature board Claude keeps for you while you build — per project, updated automatically, with everything you left halfway front and center.

Five tabs over one board file: **Features** and **Questions** are cards (work
with a next step), **Brainstorms**, **Plans** and **References** are notes
(things you'd otherwise scroll back through the chat to find).

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

## Install the plugin

In Claude Code:

```
/plugin marketplace add avivalushai/loose-ends
/plugin install loose-ends@loose-ends
```

Then `/loose-ends:board`, `/loose-ends:park`, `/loose-ends:done`, `/loose-ends:ask`, `/loose-ends:plan`.

## Working on the skill or the hooks

Those two live in the plugin, so a running Claude Code uses its installed copy,
not this folder. While developing, point the marketplace at this directory:

```
claude plugin marketplace add ~/Projects/loose-ends
```

After that, `npm run plugin:sync` reinstalls from the working tree — no commit,
no push, no version bump — and the next session picks it up. Switch back with
`claude plugin marketplace add avivalushai/loose-ends` to test what a real
install gets.

The UI, server and CLI need none of this: they run from this folder.
