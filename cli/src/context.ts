import os from "node:os";
import path from "node:path";
import type { Actor } from "./schema.js";

/** Environment as the CLI cares about it — not NodeJS.ProcessEnv, whose shape
 *  changes with whatever @types packages happen to be installed. */
export type Env = Record<string, string | undefined>;

/** Everything a command needs from the outside world — injectable for tests. */
export interface Ctx {
  cwd: string;
  env: Env;
  out: (line: string) => void;
  err: (line: string) => void;
}

export class UserError extends Error {}

/** ~/.loose-ends, overridable with LOOSE_ENDS_HOME. */
export const homeDir = (ctx: Ctx) => ctx.env.LOOSE_ENDS_HOME || path.join(os.homedir(), ".loose-ends");

/** Current time as ISO string; LOOSE_ENDS_NOW pins it (tests). */
export const nowIso = (ctx: Ctx) => {
  const pinned = ctx.env.LOOSE_ENDS_NOW;
  return (pinned ? new Date(pinned) : new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
};

/** Who is writing: --by wins, then LOOSE_ENDS_BY, then "claude" inside Claude Code, else "user". */
export function actor(ctx: Ctx, flag?: string): Actor {
  const v = flag ?? ctx.env.LOOSE_ENDS_BY ?? (ctx.env.CLAUDECODE ? "claude" : "user");
  if (v !== "claude" && v !== "user") throw new UserError(`--by must be claude or user (got "${v}")`);
  return v;
}
