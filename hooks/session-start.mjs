#!/usr/bin/env node
// SessionStart: tell Claude what's open, parked and in review before it starts.
import { BOARD_BIN, board, emit, safely } from "./lib.mjs";

safely(async (input) => {
  const cwd = input.cwd || process.cwd();
  const out = board(["context"], cwd);
  if (!out) return;

  const hasBoard = !out.startsWith("Loose Ends: no board");
  const additionalContext = hasBoard
    ? [
        out,
        "",
        `Keep this board up to date as you work — see the loose-ends skill. Write to it with \`board\` (on PATH) or \`node ${BOARD_BIN}\`.`,
      ].join("\n")
    : "This project has no Loose Ends board. If the user starts building something, offer once to create one with `board init` (you can seed it from recent git history). Don't ask again this session.";

  emit({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } });
});
