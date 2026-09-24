import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/context.js";
import { sandbox } from "./helpers.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bin = path.join(repo, "bin/board");
const bundle = path.join(repo, "bin/board.cjs");

// The plugin ships these files, not cli/src — so they get their own end-to-end test.
describe("bundled bin/board", () => {
  const run = (args: string[], cwd: string, env: Env) =>
    execFileSync(bin, args, { cwd, env: { ...process.env, ...env }, encoding: "utf8" });

  it("ships an executable wrapper and a CommonJS bundle", () => {
    for (const f of [bin, bundle]) {
      expect(fs.existsSync(f), f).toBe(true);
      fs.accessSync(f, fs.constants.X_OK);
    }
    // .cjs so it stays CommonJS whatever package.json sits next to the installed plugin
    expect(fs.readFileSync(bin, "utf8")).toContain('exec node "$(dirname "$0")/board.cjs"');
    expect(fs.readFileSync(bundle, "utf8").startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("works when the plugin puts bin/ on PATH", () => {
    const sb = sandbox();
    const out = execFileSync("board", ["--version"], {
      cwd: sb.root,
      env: { ...process.env, ...sb.env, PATH: `${path.join(repo, "bin")}:${process.env.PATH}` } as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
    expect(out.trim()).toBe("0.2.0");
  });

  it("runs a real init → add → context cycle in a temp project", () => {
    const sb = sandbox();
    run(["init", "--name", "Looper", "--key", "LOOP"], sb.root, sb.env);
    run(["add", "Save loops", "--status", "active", "--next", "Wire Save"], sb.root, sb.env);
    const out = run(["context"], sb.root, sb.env);
    expect(out).toContain("Loose Ends board: Looper (LOOP) — 1 active");
    expect(out).toContain("LOOP-1 Save loops — next: Wire Save");
    expect(JSON.parse(fs.readFileSync(path.join(sb.home, "projects.json"), "utf8"))[0].key).toBe("LOOP");
  });

  it("is up to date with cli/src", () => {
    const built = fs.readFileSync(bundle, "utf8");
    execFileSync("npm", ["run", "bundle"], { cwd: repo, encoding: "utf8" });
    expect(fs.readFileSync(bundle, "utf8")).toBe(built); // stale bundle → run `npm run build`
  });
});
