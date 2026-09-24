---
description: Turn a plan or spec document into cards on the board
argument-hint: "<file>"
allowed-tools: Bash(board:*), Read, Glob
---

Put a plan on the board: $ARGUMENTS

1. **Find the doc.** If they named a file, read it. If they didn't, look for the obvious candidates (`SPEC.md`, `PLAN.md`, `README.md`, anything under `docs/`) and ask which one rather than guessing.

2. **Pull out what it proposes building** — things that would be user-visible outcomes. Name each one in the document's own words, short enough to read in a table. Leave out background, reasoning, competitor notes, open questions and anything already built: a plan is mostly prose, and only some of it is work.

3. **Check what's already there** with `board list --all --json` and match on titles that mean the same thing, not just identical strings. Plans get edited and re-read; adding the same six cards twice is worse than adding none.

4. **Show the list before writing anything:**

   `From docs/plan.md — 6 features: random fact page · favourites list · daily email · sources page · search · dark mode. 2 already on the board. Add the other 4 as ideas?`

5. **On yes**, one `board add "..." --status idea --file <the doc>` per item, so each card records where it came from and the drawer links back to the reasoning. On no, drop it.

The doc stays the source of truth for *why*; the board only tracks *state*. Don't try to keep them in sync in both directions, and don't rewrite the doc.
