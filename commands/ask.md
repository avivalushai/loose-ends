---
description: Record a question that needs finding out, or answer one
argument-hint: "<question> | <card> <answer>"
allowed-tools: Bash(board:*), Read, Glob, WebSearch, WebFetch
---

Question: $ARGUMENTS

1. **Work out which this is.** If the argument starts with a card key (`LE-7` or `7`), it's an answer to that question. Otherwise it's a new one.

2. **A new question** → `board ask "..."` in the user's own words. If you're about to go and find out right now, add `--status active` and put what you're checking in `--note`. If it's something to settle later, leave it Open.

   A question you can answer from what you already know isn't a question — answer it in one line and record nothing.

3. **An answer** → `board answer <key> "what you found out"`. Keep it to the finding itself, not the search: the user should be able to decide from that sentence alone.

   That moves the card to **Answered**, not Decided. Don't pass `--done` unless the user has actually chosen. If their choice creates work, add the card for it and say so.

4. Confirm in one line. If nothing was recorded, say that instead of inventing a card.
