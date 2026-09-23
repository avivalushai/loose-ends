#!/usr/bin/env node
// Stop: if code changed this turn and the board didn't, ask Claude to update it.
// Blocks at most once per turn, and never when a Stop hook is already blocking.
import fs from "node:fs";
import { emit, findBoardFile, readState, safely, writeState } from "./lib.mjs";

function lastCardChange(boardFile) {
  const board = JSON.parse(fs.readFileSync(boardFile, "utf8"));
  const times = (board.features ?? []).flatMap((f) => (f.log ?? []).map((e) => Date.parse(e.at))).filter(Number.isFinite);
  return times.length ? Math.max(...times) : 0;
}

safely(async (input) => {
  if (input.stop_hook_active) return; // never loop

  const cwd = input.cwd || process.cwd();
  const boardFile = findBoardFile(cwd);
  if (!boardFile) return;

  const { lastEditAt, blockedFor } = readState(input.session_id);
  if (!lastEditAt || blockedFor === lastEditAt) return;

  // Not the file's mtime: `board touch` rewrites board.json on every new file, which would
  // look like an update. Only a log entry means a card actually moved.
  if (lastCardChange(boardFile) + 1000 >= lastEditAt) return;

  writeState(input.session_id, { blockedFor: lastEditAt });
  emit({
    hookSpecificOutput: {
      hookEventName: "Stop",
      decision: "block",
      reason:
        "Code changed but the Loose Ends board didn't. Update it before finishing: move the card you worked on (`board update|park|review|done`), or add one if this was new work. If nothing worth recording changed, say so in one line and stop. Follow the loose-ends skill, and end with the one-line Board: footer.",
    },
  });
});
