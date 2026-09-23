#!/usr/bin/env node
// PostToolUse (Edit|Write|NotebookEdit): attach the edited file to the active card,
// and remember that code changed this turn so the Stop hook can check the board.
import { board, safely, writeState } from "./lib.mjs";

safely(async (input) => {
  const cwd = input.cwd || process.cwd();
  const ti = input.tool_input || {};
  const files = [ti.file_path, ti.notebook_path, ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e?.file_path) : [])]
    .filter((f) => typeof f === "string" && f);
  if (!files.length) return;

  writeState(input.session_id, { lastEditAt: Date.now(), lastEditFile: files[0] });
  board(["touch", ...new Set(files)], cwd); // silent no-op when there's no board or no active card
});
