---
name: loose-ends
description: Keep the project's Loose Ends feature board up to date with the `board` CLI. Use whenever work starts, changes topic, gets parked, finished or mentioned — creating, updating, parking, reviewing and finishing cards without being asked.
---

You keep a feature board for this project so the user always knows what's in
progress, what they left halfway, and what's done. The user never has to ask,
and never has to learn the words "feature" or "ticket" — you do this quietly
while you work.

All board writes go through the `board` CLI. Never edit `.board/board.json` by hand.

## The CLI

```
board context                                  # what's open, parked, in review
board list [--status parked] [--json]
board show LE-3
board add "Save loops to library" [--status active] [--next "..."] [--step "..."]... [--done-when "..."]...
board update LE-3 [--title ...] [--note ...] [--status ...]
board step LE-3 "Wire the Save button" [--done]
board park LE-3 --note "Where we stopped"      # a note is required
board review LE-3 [--note "What to check"]
board done LE-3
board merge LE-15 --into LE-3
```

Cards can be referred to as `LE-3` or just `3`. If there's no board yet, offer
once to run `board init` — don't nag.

## What is a feature?

A user-visible outcome that takes more than one reply to build. Everything else
is a step inside a feature, or nothing.

For each request:

1. Related to an open card (same topic or same files)? → update that card.
2. Takes more than one reply, or touches several files? → new card.
3. Otherwise → a step on the active card, or don't record it.

- Questions and chat → record nothing.
- Several asks in one message → one card each. What you work on now is `active`,
  the rest are `idea`.
- Vague asks ("make it nicer") → name the card by the screens you actually changed.
- Name cards in the user's language, as they see the app ("Save loops"), not in
  internals ("storage layer").

## Statuses

`idea` · `active` · `parked` · `review` · `done`

The note means something different in each: **next step** when active, **where we
stopped** when parked, **what to check** in review. Write it so the user can pick
the work up cold, weeks later — name the file or the exact next action, not
"continue work".

When the user switches topics, close the loop on the current card first:
- looks finished → `board review`, and ask one short question
- unfinished → `board park --note "..."` saying exactly where you stopped

Parked cards are the heart of this product. Never leave work in `active` when
you've moved on, and never park without a real note.

## Finishing

When you open a card, write `--done-when` — what has to be true for it to count
as finished. Signals that it's done, strongest first:

1. The user says it works, or runs `/done` → `done`
2. Merged to main or deployed → `done`, mention it in one line
3. All steps done and tests pass → `review`, ask if they checked it
4. The user moved on → ask: finished, or park it?
5. A card has sat in review for days → mention it at the next session start

Never move a card to `done` on a guess. Review is where uncertainty goes.

## The footer

End every reply where the board changed with exactly one line:

`Board: LE-3 Save loops → in progress · new idea: LE-15 Bigger buttons on mobile`

Nothing else about the board in your reply — no summaries, no bullet lists of
what you recorded. If the user corrects you ("that's part of saving"), fix it
silently with `board update` or `board merge` and don't explain.
