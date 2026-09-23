---
description: Park what we're working on, with a note on where we stopped
argument-hint: "[card] [where we stopped]"
allowed-tools: Bash(board:*)
---

Park the current work: $ARGUMENTS

1. Work out which card this is. If the user named one (`LE-3` or `3`), use it. Otherwise use the active card from `board context` — if there's more than one, ask which.
2. Write the note yourself from what actually happened this session: the exact next action, the file or function to pick up, anything half-finished. If the user gave a note, use theirs and add what they left out. Never park with a vague note like "continue work".
3. Run `board park <key> --note "..."`, then confirm in one line.
