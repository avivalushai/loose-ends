// Shared helpers for the Loose Ends hooks. A hook must never break a session:
// every entry point wraps its work in safely() and exits 0 on any surprise.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const BOARD_BIN = path.join(here, "..", "bin", "board.cjs");

export async function readInput() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

/** Run the board CLI. Returns null when it fails — callers treat that as "nothing to say". */
export function board(args, cwd) {
  try {
    return execFileSync(process.execPath, [BOARD_BIN, ...args], {
      cwd,
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, LOOSE_ENDS_BY: "claude" },
    }).trim();
  } catch {
    return null;
  }
}

export function findBoardFile(start) {
  let dir = path.resolve(start);
  for (;;) {
    const file = path.join(dir, ".board", "board.json");
    if (fs.existsSync(file)) return file;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Per-session scratch state, shared between the PostToolUse and Stop hooks. */
const stateDir = () => process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), "loose-ends");
const stateFile = (sessionId) => path.join(stateDir(), `session-${(sessionId || "unknown").replace(/\W/g, "")}.json`);

export function readState(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(sessionId), "utf8"));
  } catch {
    return {};
  }
}

export function writeState(sessionId, patch) {
  try {
    const file = stateFile(sessionId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...readState(sessionId), ...patch }));
  } catch {
    /* state is an optimization, not a requirement */
  }
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

export async function safely(fn) {
  try {
    await fn(await readInput());
  } catch {
    /* never break the session */
  }
  process.exit(0);
}
