import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { helpText } from "../src/cli.js";
import { SCHEMA_VERSION } from "../src/schema.js";
import { sandbox, withBoard } from "./helpers.js";

describe("board file handling", () => {
  it("migrates an older board on read and keeps a backup", () => {
    const sb = withBoard();
    sb.board("add", "Save loops");
    const board = sb.read();
    sb.write({ ...board, schemaVersion: 0.5 }); // not a real version
    expect(sb.board("list").err).toContain("schemaVersion");

    // A board from a newer CLI must not be touched.
    sb.write({ ...board, schemaVersion: SCHEMA_VERSION + 1 });
    expect(sb.board("list").err).toContain("Update the Loose Ends plugin");
    expect(sb.read().schemaVersion).toBe(SCHEMA_VERSION + 1);
  });

  it("refuses to work on an invalid or unreadable board", () => {
    const sb = withBoard();
    sb.write({ ...sb.read(), features: [{ key: "APP-1" }] });
    const r = sb.board("list");
    expect(r.code).toBe(1);
    expect(r.err).toContain("is invalid");

    fs.writeFileSync(path.join(sb.root, ".board/board.json"), "{oops");
    expect(sb.board("list").err).toContain("can't read");
  });

  it("writes atomically and leaves no temp or lock files behind", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active");
    sb.board("touch", "src/a.ts");
    expect(fs.readdirSync(path.join(sb.root, ".board")).sort()).toEqual([".gitignore", "board.json"]);
    expect(fs.readFileSync(path.join(sb.root, ".board/board.json"), "utf8").endsWith("}\n")).toBe(true);
  });

  it("reports a held lock instead of corrupting the board", () => {
    const sb = withBoard();
    fs.mkdirSync(path.join(sb.root, ".board/board.json.lock"));
    const r = sb.board("add", "Save loops");
    expect(r.code).toBe(1);
    expect(r.err).toContain("locked");
    fs.rmdirSync(path.join(sb.root, ".board/board.json.lock"));
    expect(sb.board("add", "Save loops").code).toBe(0);
  });

  it("finds the board from any depth and only writes that board", () => {
    const sb = withBoard();
    const deep = path.join(sb.root, "a/b/c");
    fs.mkdirSync(deep, { recursive: true });
    expect(sb.board("add", "From deep", "-C", deep).code).toBe(0);
    expect(sb.read().features[0].title).toBe("From deep");
  });
});

describe("cli surface", () => {
  it("prints help and lists every spec command", () => {
    const sb = sandbox();
    for (const cmd of ["init", "list", "show", "add", "update", "step", "park", "review", "done", "merge", "delete", "touch", "context", "ui"])
      expect(helpText()).toContain(`board ${cmd}`);
    expect(sb.board().out).toContain("board — the Loose Ends feature board");
    expect(sb.board("help").code).toBe(0);
    expect(sb.board("add", "--help").out).toBe(`usage: board add "Title" [--status active] [--type bug] [--next "..."] [--step "..."]... [--done-when "..."]...`);
  });

  it("rejects unknown commands and unknown flags", () => {
    const sb = withBoard();
    expect(sb.board("frobnicate").err).toContain('unknown command "frobnicate"');
    const r = sb.board("add", "X", "--wat");
    expect(r.code).toBe(1);
    expect(r.err).toContain("usage: board add");
  });

  it("says which phase the unbuilt commands belong to", () => {
    const sb = withBoard();
    for (const [cmd, phase] of [["login", "phase 5"], ["logout", "phase 5"], ["telemetry", "phase 5"]] as const) {
      const r = sb.board(cmd);
      expect(r.code).toBe(1);
      expect(r.err).toContain(phase);
    }
  });

  it("defaults the author to claude inside Claude Code and to user outside it", () => {
    const inside = withBoard({ LOOSE_ENDS_BY: undefined, CLAUDECODE: "1" });
    expect(inside.json("add", "X").updatedBy).toBe("claude");
    const outside = withBoard({ LOOSE_ENDS_BY: undefined });
    expect(outside.json("add", "X").updatedBy).toBe("user");
  });
});
