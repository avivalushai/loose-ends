import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sandbox } from "./helpers.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bin = path.join(repo, "bin/board.mjs");

// The plugin ships this single bundled file, not cli/src — so it gets its own end-to-end test.
describe("bundled bin/board.mjs", () => {
  const run = (args: string[], cwd: string, env: NodeJS.ProcessEnv) =>
    execFileSync(bin, args, { cwd, env: { ...process.env, ...env }, encoding: "utf8" });

  it("exists, is executable, and has a shebang", () => {
    expect(fs.existsSync(bin)).toBe(true);
    expect(fs.readFileSync(bin, "utf8").startsWith("#!/usr/bin/env node")).toBe(true);
    fs.accessSync(bin, fs.constants.X_OK);
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
    const built = fs.readFileSync(bin, "utf8");
    execFileSync("npm", ["run", "bundle"], { cwd: repo, encoding: "utf8" });
    expect(fs.readFileSync(bin, "utf8")).toBe(built); // stale bundle → run `npm run build`
  });
});
