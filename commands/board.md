---
description: Open the Loose Ends board, or show its status
argument-hint: "[status]"
allowed-tools: Bash(board:*)
---

Argument: $ARGUMENTS

- No argument: run `board ui` to open the board in the browser. If that says it isn't built yet, run `board context` and show the result instead.
- `status`: run `board context` and show it as-is. Don't editorialize.
- Anything else: pass it through to `board` as a subcommand.

If there's no board here, offer to run `board init`.
