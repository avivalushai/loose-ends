import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";
import { run } from "../src/cli.js";

const made: string[] = [];
afterEach(() => {
  while (made.length) fs.rmSync(made.pop()!, { recursive: true, force: true });
});

export interface Sandbox {
  root: string; // project folder
  home: string; // LOOSE_ENDS_HOME
  env: NodeJS.ProcessEnv;
  board: (...argv: string[]) => { code: number; out: string; err: string };
  json: <T = any>(...argv: string[]) => T;
  read: () => any;
  write: (b: unknown) => void;
  registry: () => any[];
}

export function sandbox(env: NodeJS.ProcessEnv = {}): Sandbox {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "le-test-")));
  made.push(base);
  const root = path.join(base, "my-app");
  const home = path.join(base, "home");
  fs.mkdirSync(root);
  const sb: Sandbox = {
    root,
    home,
    env: { LOOSE_ENDS_HOME: home, LOOSE_ENDS_NOW: "2026-09-20T10:00:00Z", LOOSE_ENDS_BY: "claude", ...env },
    board(...argv) {
      const out: string[] = [];
      const err: string[] = [];
      const code = run(argv, { cwd: root, env: sb.env, out: (l) => out.push(l), err: (l) => err.push(l) });
      return { code, out: out.join("\n"), err: err.join("\n") };
    },
    json(...argv) {
      const r = sb.board(...argv, "--json");
      if (r.code !== 0) throw new Error(`board ${argv.join(" ")} failed: ${r.err}`);
      return JSON.parse(r.out);
    },
    read: () => JSON.parse(fs.readFileSync(path.join(root, ".board/board.json"), "utf8")),
    write: (b) => fs.writeFileSync(path.join(root, ".board/board.json"), JSON.stringify(b)),
    registry: () => JSON.parse(fs.readFileSync(path.join(home, "projects.json"), "utf8")),
  };
  return sb;
}

/** Sandbox with an initialized board (key APP). */
export function withBoard(env?: NodeJS.ProcessEnv): Sandbox {
  const sb = sandbox(env);
  const r = sb.board("init", "--name", "My App", "--key", "APP");
  if (r.code !== 0) throw new Error(r.err);
  return sb;
}
