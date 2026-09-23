---
description: Mark a feature finished
argument-hint: "[card]"
allowed-tools: Bash(board:*)
---

Mark finished: $ARGUMENTS

1. Pick the card: the one the user named, else the active or in-review card from `board context`. Ask if it's ambiguous.
2. Check its `doneWhen` with `board show <key>`. If something on that list clearly isn't true yet, say so and ask before closing.
3. Run `board done <key>`, then confirm in one line. If open steps remain, mention them in that same line.
