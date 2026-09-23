# Phase 4 — dogfood log

Two weeks of normal work on **Braille.AI** and **bud**, with the plugin doing the
board-keeping. The point isn't to use the board — it's to find out where Claude
gets the board *wrong*.

Started: 2026-09-23. Boards seeded from git history (5 cards each).

## Setup

1. In Claude Code: `/plugin marketplace add ~/Projects/loose-ends`, then
   `/plugin install loose-ends@loose-ends`, then restart.
2. Work normally. Don't tidy the board by hand — a board you have to maintain
   is the thing we're trying not to build.
3. `board ui` when you want to look at it.

`.board/board.json` is untracked in both repos. Commit it if you want the board
in git history; add `.board/` to `.gitignore` if you'd rather it stayed local.

## What to watch for

Note these as they happen — a one-line note per incident is enough.

| What | Why it matters |
|---|---|
| A card you didn't recognise | Claude invented work, or named it in its own words instead of yours |
| Work that got no card | The "more than one reply" rule is too strict |
| Two cards for one thing | Claude isn't matching new work to open cards |
| A parked note you couldn't use | The note rule is too vague — this is the product's core promise |
| Moved to Done without you saying so | The strongest rule in the spec, broken |
| A card that sat in the wrong status | Topic-switch detection isn't firing |
| The `Board:` footer got annoying | Either too frequent, or too wordy |
| The Stop hook nagged you when nothing mattered | The "code changed but the board didn't" check is too eager |

## Questions I'll ask at the end

1. Which cards did you fix by hand, and what was wrong with them?
2. Of everything you worked on, what never made it onto a board?
3. Did a parked card ever actually get you back into the work? (The whole point.)
4. Did the board ever tell you something you didn't already know?
5. Would you have noticed if the plugin had stopped working?

## The measure

In the UI, the **Last by** column shows Claude vs You. If most cards say *You*,
the automation isn't working — that's the number that decides whether this ships
(SPEC §7).
