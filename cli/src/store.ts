import fs from "node:fs";
import path from "node:path";
import { type Ctx, UserError } from "./context.js";
import { writeJsonAtomic, withLock } from "./fsutil.js";
import { migrate, MigrationError } from "./migrations.js";
import { type Board, validateBoard } from "./schema.js";

export const BOARD_DIR = ".board";
export const BOARD_FILE = "board.json";

export interface Located {
  root: string; // project root (the folder containing .board/)
  file: string; // absolute path to board.json
}

export const boardFileFor = (root: string) => path.join(root, BOARD_DIR, BOARD_FILE);

/** Walk up from `start` looking for .board/board.json. */
export function findBoard(start: string): Located | null {
  let dir = path.resolve(start);
  for (;;) {
    const file = boardFileFor(dir);
    if (fs.existsSync(file)) return { root: dir, file };
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function requireBoard(ctx: Ctx): Located {
  const loc = findBoard(ctx.cwd);
  if (!loc) throw new UserError("no board here. Run `board init` in your project folder.");
  return loc;
}

/** Read, migrate (backing up the old file) and validate. */
export function readBoard(file: string): Board {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new UserError(`can't read ${file}: ${(e as Error).message}`);
  }
  let res;
  try {
    res = migrate(raw);
  } catch (e) {
    if (e instanceof MigrationError) throw new UserError(e.message);
    throw e;
  }
  const errs = validateBoard(res.board);
  if (errs.length) throw new UserError(`${file} is invalid:\n  ${errs.slice(0, 10).join("\n  ")}`);
  if (res.migrated) {
    fs.copyFileSync(file, `${file}.v${res.from}.bak`);
    writeJsonAtomic(file, res.board);
  }
  return res.board as unknown as Board;
}

export function writeBoard(file: string, board: Board): void {
  const errs = validateBoard(board);
  if (errs.length) throw new Error(`refusing to write an invalid board:\n  ${errs.join("\n  ")}`);
  writeJsonAtomic(file, board);
}

/** Load → mutate → validate → write, under a lock. */
export function mutateBoard<T>(loc: Located, fn: (b: Board) => T): T {
  return withLock(loc.file + ".lock", () => {
    const board = readBoard(loc.file);
    const result = fn(board);
    writeBoard(loc.file, board);
    return result;
  });
}
