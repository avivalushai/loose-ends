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

## Brainstorming

Talk is not work. While the user is thinking out loud — weighing options, asking
what you think, wondering aloud — record nothing. A board full of musings is a
board they have to maintain, which defeats the point.

But a brainstorm that reaches decisions and then evaporates is itself a loose
end. So when a conversation lands on concrete things to build, offer once, in
one line, and name them in the user's own words:

`Want these on the board as ideas? — voice input · offline mode · shared lists`

- Yes → `board add "..."` for each, status `idea`, title only. No steps, no
  done-when: an idea is a title until someone picks it up.
- No, or no answer → drop it and don't ask again this session.

Only offer for things the user actually settled on. "Maybe we could do voice
input" is thinking aloud; "right, voice input's in" is a decision. If you can't
tell which it was, leave it out of the list — a missing idea costs one sentence
to add later, a wrong one costs trust in every row on the board.

Never offer in the middle of work. Wait until the discussion is done.

## Plans and specs

A planning document is not a board, but it usually contains one. When the user
has written a plan, a spec or a feature list and asks for it on the board — or
when they've clearly just finished planning and the board is empty — offer to
turn it into cards:

`From docs/plan.md — 6 features: …. 2 already on the board. Add the other 4 as ideas?`

Rules that keep it useful:

- Extract only what would be user-visible work. Background, reasoning and open
  questions belong in the doc, not on the board.
- Check `board list --all --json` first and skip what's already there, matching
  on meaning rather than exact titles. Plans get re-read; cards must not double.
- Add each with `--file <the doc>` so the card points back at the reasoning.
- Never edit the document to match the board. The doc holds the thinking; the
  board holds the state.

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
