import { describe, expect, it } from "vitest";
import { validateBoard } from "../src/schema.js";
import { withBoard } from "./helpers.js";

describe("board add", () => {
  it("adds an idea by default and numbers keys from 1", () => {
    const sb = withBoard();
    const f = sb.json("add", "Export loop as WAV");
    expect(f).toMatchObject({
      key: "APP-1",
      title: "Export loop as WAV",
      type: "feature",
      status: "idea",
      note: "",
      steps: [],
      files: [],
      updatedBy: "claude",
      createdAt: "2026-09-20T10:00:00Z",
    });
    expect(f.log).toEqual([{ at: "2026-09-20T10:00:00Z", by: "claude", text: "Created" }]);
    expect(sb.read().nextNum).toBe(2);
    expect(sb.json("add", "Second").key).toBe("APP-2");
  });

  it("takes status, type, next step, steps and done-when", () => {
    const sb = withBoard();
    const f = sb.json(
      "add", "Save loops", "--status", "active", "--type", "bug", "--next", "Wire the Save button",
      "--step", "IndexedDB schema", "--step", "Save button",
      "--done-when", "A saved loop shows in the library",
    );
    expect(f).toMatchObject({
      status: "active",
      type: "bug",
      note: "Wire the Save button",
      steps: [{ text: "IndexedDB schema", done: false }, { text: "Save button", done: false }],
      doneWhen: ["A saved loop shows in the library"],
    });
    expect(f.log[0].text).toBe("Created — active");
    expect(validateBoard(sb.read())).toEqual([]);
  });

  it("rejects an empty title, a bad status and parking without a note", () => {
    const sb = withBoard();
    expect(sb.board("add", "   ").code).toBe(1);
    expect(sb.board("add", "X", "--status", "wip").err).toContain("status must be one of");
    expect(sb.board("add", "X", "--status", "parked").err).toContain("note");
    expect(sb.read().features).toEqual([]);
    expect(sb.read().nextNum).toBe(1);
  });

  it("needs a board", () => {
    const sb = withBoard();
    const r = sb.board("add", "X", "-C", "/");
    expect(r.code).toBe(1);
    expect(r.err).toContain("board init");
  });
});

describe("board list / show", () => {
  const seeded = () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active", "--next", "Wire Save", "--step", "Schema");
    sb.board("add", "Mobile layout", "--status", "parked", "--note", "Header overlaps");
    sb.board("add", "Bigger buttons");
    sb.board("add", "Fix drift", "--type", "bug", "--status", "done");
    return sb;
  };

  it("hides done cards unless asked and sorts by status", () => {
    const sb = seeded();
    const r = sb.board("list");
    expect(r.out.split("\n").map((l) => l.trim().split(/\s+/)[0])).toEqual(["APP-1", "APP-2", "APP-3", "(+1"]);
    expect(r.out).toContain("— Next: Wire Save");
    expect(r.out).toContain("— Stopped: Header overlaps");
    expect(sb.board("list", "--all").out).toContain("APP-4");
  });

  it("filters by status and type", () => {
    const sb = seeded();
    expect(sb.json("list", "--status", "parked").map((f: any) => f.key)).toEqual(["APP-2"]);
    expect(sb.json("list", "--status", "parked,done").map((f: any) => f.key)).toEqual(["APP-2", "APP-4"]);
    expect(sb.json("list", "--type", "bug", "--all").map((f: any) => f.key)).toEqual(["APP-4"]);
    expect(sb.board("list", "--status", "nope").code).toBe(1);
  });

  it("says when there is nothing", () => {
    expect(withBoard().board("list").out).toBe("No cards.");
  });

  it("shows one card in detail, by key or bare number", () => {
    const sb = seeded();
    const out = sb.board("show", "APP-1").out;
    expect(out).toContain("APP-1  Save loops");
    expect(out).toContain("active · feature · updated 0m ago by claude");
    expect(out).toContain("1. [ ] Schema");
    expect(sb.board("show", "1").out).toBe(out);
    expect(sb.board("show", "app-1").out).toBe(out);
    expect(sb.board("show", "APP-99").err).toContain("no card APP-99");
  });
});

describe("attaching the source of a card", () => {
  it("records where a card came from, with --file on add", () => {
    const sb = withBoard();
    const f = sb.json("add", "Favourites list", "--status", "idea", "--file", "docs/plan.md", "--file", "docs/plan.md");
    expect(f.files).toEqual(["docs/plan.md"]); // de-duplicated
  });

  it("appends files on update instead of replacing them", () => {
    const sb = withBoard();
    sb.board("add", "Favourites list", "--file", "docs/plan.md");
    const f = sb.json("update", "APP-1", "--file", "src/favourites.ts", "--file", "docs/plan.md");
    expect(f.files).toEqual(["docs/plan.md", "src/favourites.ts"]);
    expect(f.log.at(-1).text).toBe("Files: src/favourites.ts");
  });

  it("ignores paths outside the project and the board's own folder", () => {
    const sb = withBoard();
    const f = sb.json("add", "X", "--file", "../outside.md", "--file", ".board/board.json", "--file", "docs/ok.md");
    expect(f.files).toEqual(["docs/ok.md"]);
  });
});

describe("board update", () => {
  it("changes fields and logs what happened", () => {
    const sb = withBoard();
    sb.board("add", "Save lops");
    const f = sb.json("update", "APP-1", "--title", "Save loops", "--note", "Wire Save", "--type", "chore");
    expect(f).toMatchObject({ title: "Save loops", note: "Wire Save", type: "chore" });
    expect(f.log.map((e: any) => e.text)).toEqual(["Created", "Renamed from “Save lops”", "Type → chore", "Note: Wire Save"]);
  });

  it("moves status and records the note as the reason", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active");
    const f = sb.json("update", "APP-1", "--status", "parked", "--note", "Save button not wired");
    expect(f).toMatchObject({ status: "parked", note: "Save button not wired" });
    expect(f.log.at(-1).text).toBe("Parked — Save button not wired");
  });

  it("refuses an empty update, a bad status, and clearing a parked note", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "parked", "--note", "here");
    expect(sb.board("update", "APP-1").err).toContain("nothing to update");
    expect(sb.board("update", "APP-1", "--status", "nope").code).toBe(1);
    expect(sb.board("update", "APP-1", "--note", "").err).toContain("parked card needs a note");
    expect(sb.board("update", "APP-1", "--title", "").code).toBe(1);
    expect(sb.read().features[0].note).toBe("here");
  });

  it("replaces done-when and records who wrote last", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--done-when", "old");
    const f = sb.json("update", "APP-1", "--done-when", "a", "--done-when", "b", "--by", "user");
    expect(f.doneWhen).toEqual(["a", "b"]);
    expect(f.updatedBy).toBe("user");
    expect(sb.board("update", "APP-1", "--by", "robot").err).toContain("--by must be");
  });
});

describe("board park / review / done", () => {
  it("parks with a note, reviews, and finishes", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active");
    expect(sb.board("park", "APP-1", "--note", "Schema drafted, Save button not wired").out)
      .toBe("APP-1 Save loops → parked");
    expect(sb.read().features[0]).toMatchObject({ status: "parked", note: "Schema drafted, Save button not wired" });

    const rev = sb.json("review", "APP-1", "--note", "Save a loop and reload");
    expect(rev).toMatchObject({ status: "review", note: "Save a loop and reload" });
    expect(rev.log.at(-1).text).toBe("Moved to review — Save a loop and reload");

    const d = sb.json("done", "APP-1");
    expect(d.status).toBe("done");
    expect(d.note).toBe("Save a loop and reload");
    expect(d.log.at(-1).text).toBe("Done");
  });

  it("refuses to park without a note and keeps review notes optional", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active");
    expect(sb.board("park", "APP-1").err).toContain("where you stopped");
    expect(sb.read().features[0].status).toBe("active");
    expect(sb.json("review", "APP-1").status).toBe("review");
  });

  it("parks a card that already has a note", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active", "--next", "Wire Save");
    expect(sb.json("park", "APP-1").status).toBe("parked");
  });
});

describe("board step", () => {
  it("adds, completes, reopens and removes steps", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active");
    expect(sb.board("step", "APP-1", "IndexedDB schema").out).toBe("APP-1 Step added: IndexedDB schema (0/1)");
    expect(sb.board("step", "APP-1", "Save button", "--done").out).toBe("APP-1 Step added (done): Save button (1/2)");

    expect(sb.board("step", "APP-1", "indexeddb schema", "--done").out).toContain("Step done");
    expect(sb.read().features[0].steps).toEqual([
      { text: "IndexedDB schema", done: true },
      { text: "Save button", done: true },
    ]);

    expect(sb.board("step", "APP-1", "1", "--undone").out).toContain("Step reopened: IndexedDB schema");
    expect(sb.board("step", "APP-1", "1", "--undone").out).toContain("already open");
    expect(sb.board("step", "APP-1", "2", "--remove").out).toContain("Step removed: Save button");
    expect(sb.read().features[0].steps).toEqual([{ text: "IndexedDB schema", done: false }]);
  });

  it("rejects bad input", () => {
    const sb = withBoard();
    sb.board("add", "Save loops");
    expect(sb.board("step", "APP-1").err).toContain("missing step text");
    expect(sb.board("step", "APP-1", "7", "--done").err).toContain("no step 7");
    expect(sb.board("step", "APP-1", "Nope", "--remove").err).toContain("no step");
    expect(sb.board("step", "APP-1", "x", "--done", "--undone").err).toContain("not both");
  });
});

describe("board merge", () => {
  it("folds one card into another and removes the source", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active", "--step", "Schema", "--done-when", "shows in library");
    sb.board("add", "Save button", "--note", "part of saving", "--step", "Schema", "--step", "Wire button", "--done-when", "click saves");
    const into = sb.json("merge", "APP-2", "--into", "APP-1");
    expect(into.steps.map((s: any) => s.text)).toEqual(["Schema", "Wire button"]);
    expect(into.doneWhen).toEqual(["shows in library", "click saves"]);
    expect(into.note).toBe("part of saving");
    expect(into.log.at(-1).text).toBe("Merged in APP-2 “Save button”");
    expect(sb.read().features.map((f: any) => f.key)).toEqual(["APP-1"]);
    expect(sb.read().nextNum).toBe(3); // keys are never reused
    expect(validateBoard(sb.read())).toEqual([]);
  });

  it("rejects a missing --into, unknown keys and self-merge", () => {
    const sb = withBoard();
    sb.board("add", "Save loops");
    expect(sb.board("merge", "APP-1").err).toContain("--into");
    expect(sb.board("merge", "APP-1", "--into", "APP-9").err).toContain("no card APP-9");
    expect(sb.board("merge", "APP-1", "--into", "APP-1").err).toContain("itself");
    expect(sb.read().features).toHaveLength(1);
  });
});

describe("board delete", () => {
  it("removes a card without reusing its number", () => {
    const sb = withBoard();
    sb.board("add", "Save loops");
    sb.board("add", "Mobile layout");
    expect(sb.board("delete", "APP-1").out).toBe("Deleted APP-1 Save loops");
    expect(sb.read().features.map((f: any) => f.key)).toEqual(["APP-2"]);
    expect(sb.read().nextNum).toBe(3);
    expect(validateBoard(sb.read())).toEqual([]);
    expect(sb.board("delete", "APP-1").err).toContain("no card APP-1");
  });
});
