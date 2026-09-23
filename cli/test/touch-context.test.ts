import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sandbox, withBoard } from "./helpers.js";

describe("board touch", () => {
  const active = () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active");
    return sb;
  };

  it("attaches files to the most recently updated active card", () => {
    const sb = active();
    sb.board("add", "Older work", "--status", "active");
    sb.env.LOOSE_ENDS_NOW = "2026-09-20T11:00:00Z";
    sb.board("update", "APP-1", "--note", "still on this");

    expect(sb.board("touch", "src/store/library.ts", "src/ui/Save.tsx").out).toBe(
      "APP-1 + src/store/library.ts, src/ui/Save.tsx",
    );
    expect(sb.read().features[0].files).toEqual(["src/store/library.ts", "src/ui/Save.tsx"]);
    expect(sb.read().features[1].files).toEqual([]);
  });

  it("makes paths relative to the project root and de-duplicates", () => {
    const sb = active();
    const abs = path.join(sb.root, "src/a.ts");
    sb.board("touch", abs, "./src/a.ts");
    expect(sb.read().features[0].files).toEqual(["src/a.ts"]);

    // touching the same file again writes nothing new
    const before = fs.readFileSync(path.join(sb.root, ".board/board.json"), "utf8");
    expect(sb.board("touch", "src/a.ts").code).toBe(0);
    expect(fs.readFileSync(path.join(sb.root, ".board/board.json"), "utf8")).toBe(before);
  });

  it("ignores the board's own files and anything outside the project", () => {
    const sb = active();
    sb.board("touch", ".board/board.json", "../outside.ts");
    expect(sb.read().features[0].files).toEqual([]);
  });

  it("is a silent no-op with no active card, and outside a project", () => {
    const sb = withBoard();
    sb.board("add", "Just an idea");
    const r = sb.board("touch", "src/a.ts");
    expect([r.code, r.out, r.err]).toEqual([0, "", ""]);
    expect(sb.json("touch", "src/a.ts")).toEqual({ card: null, added: [], reason: "no active card" });

    const bare = sandbox();
    const out = bare.board("touch", "src/a.ts");
    expect([out.code, out.out, out.err]).toEqual([0, "", ""]);
  });

  it("finds the board from a subdirectory", () => {
    const sb = active();
    fs.mkdirSync(path.join(sb.root, "src/deep"), { recursive: true });
    const r = sb.board("touch", "-C", "src/deep", "Save.tsx");
    expect(r.out).toBe("APP-1 + src/deep/Save.tsx");
  });

  it("needs at least one file", () => {
    expect(active().board("touch").err).toContain("missing file");
  });
});

describe("board context", () => {
  it("summarizes open, parked and review work", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active", "--next", "Wire the Save button", "--step", "Schema", "--step", "Button");
    sb.board("step", "APP-1", "Schema", "--done");
    sb.board("add", "Mobile layout", "--status", "parked", "--note", "Header overlaps the logo");
    sb.board("add", "Fix drift", "--status", "review", "--note", "Play two loops");
    sb.board("add", "Bigger buttons");
    sb.board("add", "Dark mode", "--status", "done");

    sb.env.LOOSE_ENDS_NOW = "2026-09-24T10:00:00Z";
    expect(sb.board("context").out).toBe(
      [
        "Loose Ends board: My App (APP) — 1 idea, 1 active, 1 parked, 1 review, 1 done",
        "Active:",
        "  APP-1 Save loops (1/2) — next: Wire the Save button",
        "Parked:",
        "  APP-2 Mobile layout — stopped: Header overlaps the logo (idle 4d)",
        "Review:",
        "  APP-3 Fix drift — check: Play two loops; in review 4d — ask if it's done",
        "Ideas: APP-4 Bigger buttons",
      ].join("\n"),
    );
  });

  it("stays quiet on an empty board and exits 0 without one", () => {
    const sb = withBoard();
    expect(sb.board("context").out).toBe("Loose Ends board: My App (APP) — empty");

    const bare = sandbox();
    const r = bare.board("context");
    expect(r.code).toBe(0);
    expect(r.out).toContain("no board in this project yet");
    expect(bare.json("context")).toEqual({ board: null });
  });

  it("gives machines the full cards", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active");
    const c = sb.json("context");
    expect(c.project).toEqual({ name: "My App", key: "APP" });
    expect(c.root).toBe(sb.root);
    expect(c.counts).toEqual({ idea: 0, active: 1, parked: 0, review: 0, done: 0 });
    expect(c.active[0].title).toBe("Save loops");
  });
});
