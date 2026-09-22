# Loose Ends — Spec v0.1

A feature board that Claude keeps for you while you build. Every project gets a board; Claude writes to it as you work, so you always know what's in progress, what you left halfway, and what's done — across all your projects.

**Core idea:** the board must never depend on the user's discipline. Claude updates it automatically, and the user never has to learn words like "feature" or "ticket".

---

## 1. Principles

1. **Local-first.** Board data lives in files inside each project. It never leaves the user's machine.
2. **We store no user content.** Our servers keep only: account (email, name, signup date) and anonymous usage events (action names + counts, never titles/notes/paths).
3. **Classify by work, not by words.** Users write freely. Claude maps what it *actually changed* to board cards.
4. **Never close a feature on a guess.** Claude may move a card to Review; Done needs the user's confirmation or a strong signal (merge / deploy).
5. **"Parked" is the heart of the product.** Anything left halfway gets a status and a note saying where we stopped.

---

## 2. Architecture

```
Claude Code session
  └─ plugin: skill (rules) + hooks (automatic triggers) + commands
        └─ `board` CLI  ──writes──►  <repo>/.board/board.json
                                      │
                   ~/.loose-ends/projects.json   (registry of all boards on this machine)
                                      │
        `board ui` → local server (localhost:4747)
              ├─ GET/PUT board JSON, watches files, pushes live updates (SSE)
              └─ serves bundled UI (fallback)
                                      │
        Browser: UI hosted at looseends.dev/app  ──fetches data only from──►  localhost:4747
                 (UI updates reach everyone instantly; data never touches our servers)
```

### Parts
| Part | What it is | Ships via |
|---|---|---|
| Plugin | Skill + hooks + slash commands for Claude Code | Plugin marketplace (GitHub repo) |
| `board` CLI | Node CLI; the only thing that writes board files | Inside the plugin |
| Local server | Tiny HTTP server: JSON API + file watcher + SSE | `board ui` |
| UI | The Loose Ends web app (see `prototype/loose-ends.html`) | Hosted site + bundled fallback |
| Site | Landing page, sign-up, install instructions | Vercel (later) |
| Analytics | Anonymous events | PostHog EU (later) |

---

## 3. Data model — `<repo>/.board/board.json`

```json
{
  "schemaVersion": 1,
  "project": { "name": "Looper", "key": "LOOP" },
  "settings": { "granularity": "normal" },
  "nextNum": 15,
  "features": [
    {
      "key": "LOOP-3",
      "title": "Save loops to library",
      "type": "feature",
      "status": "parked",
      "note": "Switched to fix playback drift. IndexedDB schema drafted, Save button not wired yet",
      "doneWhen": ["A saved loop shows in the library", "Reloading the page keeps it"],
      "steps": [{ "text": "IndexedDB schema", "done": true }, { "text": "Save button", "done": false }],
      "files": ["src/store/library.ts"],
      "createdAt": "2026-09-18T10:00:00Z",
      "updatedAt": "2026-09-20T14:12:00Z",
      "updatedBy": "claude",
      "log": [{ "at": "2026-09-20T14:12:00Z", "by": "claude", "text": "Parked — switched to playback drift" }]
    }
  ]
}
```

- `status`: `idea | active | parked | review | done`
- `type`: `feature | bug | chore`
- `note`: meaning depends on status — *Next step* (active), *Where we stopped* (parked), *What to check* (review)
- `updatedBy`: `claude | user`
- `settings.granularity`: `coarse | normal | fine`
- Every schema change bumps `schemaVersion`; the CLI migrates old files automatically.

Registry `~/.loose-ends/projects.json`: `[{ "path": "/Users/x/code/looper", "name": "Looper", "key": "LOOP", "addedAt": "..." }]`

---

## 4. `board` CLI

All writes go through the CLI (never hand-edit JSON) so the structure stays valid.

```
board init [--name "Looper"] [--key LOOP]
board list [--status parked] [--json]
board show LOOP-3
board add "Export loop as WAV" [--status active] [--type bug] [--next "..."] [--step "..."]...
board update LOOP-3 [--title ...] [--note ...] [--status ...]
board step LOOP-3 "Render buffer" [--done]
board park LOOP-3 --note "Where we stopped"
board review LOOP-3 [--note "What to check"]
board done LOOP-3
board merge LOOP-15 --into LOOP-3
board touch <file>...            # attach files to the active card (used by hooks)
board context                    # compact summary for SessionStart (open + parked + review)
board ui [--port 4747]
board login | logout | telemetry off
```

Output is short and human-readable by default; `--json` for machines.

---

## 5. Plugin behaviour

### Hooks (automatic)
| Event | Action |
|---|---|
| SessionStart | Run `board context`; inject open/parked/review cards so Claude knows the state. If no board: offer to create one (and seed from git history). |
| PostToolUse (Edit/Write) | `board touch <file>` — record files on the active card. |
| Stop | If code changed this turn and the board wasn't updated → ask Claude to update it before finishing (block once, never loop). |

> Verify exact hook names, matcher syntax and the Stop-hook "block" mechanism against current Claude Code docs before implementing.

### Skill: rules Claude follows
**What is a feature?** A user-visible outcome that takes more than one reply to build. Everything else is a step inside a feature, or nothing.

**Per request:**
1. Related to an open card (same topic or same files)? → update that card.
2. Takes more than one reply or touches several files? → new card.
3. Otherwise → a step on the active card, or don't record it.
- Questions / chat → nothing.
- Several asks in one message → one card each; what Claude works on now is `active`, the rest are `idea`.
- Vague asks ("make it nicer") → name the card by the screens actually changed.
- Name cards in the user's language as they see the app ("Save loops"), not internals ("storage layer").

**Switching topics:** when the user moves to something else, the current card becomes `review` (looks finished → ask one short question) or `parked` (unfinished → write where we stopped).

**Finishing:** when opening a card, write `doneWhen`. Signals, strongest first:
1. User says it works / `/board done` → `done`
2. Merged to main or deployed → `done`, mention it in one line
3. All steps done + tests pass → `review`, ask if they checked it
4. User moved on → ask: finished, or park it?
5. Card sat in review for days → mention it at the next session start

**Footer:** end every reply that changed the board with one line:
`Board: LOOP-3 Save loops → in progress · new idea: LOOP-15 Bigger buttons on mobile`

If the user corrects ("that's part of saving"), merge/fix silently.

### Slash commands
`/board` (open UI), `/board status`, `/park`, `/done`, `/board login`

---

## 6. UI

Start from `prototype/loose-ends.html` (working prototype with sample data). Keep:
- Left menu: all projects, parked count, progress
- Views: Table (editable cells, add row, group/density/columns), Board (drag between columns), Timeline (idle time for parked)
- Card drawer: status, note, steps, files, activity, "Continue with Claude" prompt
Change: read/write through the local server API instead of localStorage; live-update via SSE.

Local server API:
```
GET  /api/projects                  → registry + summary counts
GET  /api/projects/:id/board        → board.json
POST /api/projects/:id/features     → add
PATCH /api/projects/:id/features/:key
GET  /api/events                    → SSE: board changed
```
Hosted UI → localhost needs CORS + Private Network Access headers; keep the bundled UI as fallback (Safari).

---

## 7. Analytics (later phase, opt-out)

Event names only, tied to account id. Never titles, notes, file paths or project names.
`board_opened`, `view_changed{view}`, `feature_added{by}`, `status_changed{from,to,by}`, `handoff_clicked`, `filter_used`, `session_start{projects,cards}`.
Key metric: share of cards created/updated **by Claude** — proves the automation works.

---

## 8. Build phases

1. **CLI + data model** — `board` CLI, schema, registry, migrations, tests.
2. **Plugin** — skill rules, hooks, commands; marketplace manifest; install on my own projects.
3. **Local server + UI** — port the prototype to the API, live updates.
4. **Dogfood 1–2 weeks** on my projects (Looper, NehoRace, AgentLens, News Heatmap); tune the rules.
5. **Site + sign-up + analytics**, then invite testers.
