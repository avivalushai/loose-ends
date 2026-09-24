import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "../src/migrations.js";
import { validateBoard } from "../src/schema.js";
import { withBoard } from "./helpers.js";

describe("board ask / answer", () => {
  it("asks a question as a card of its own type", () => {
    const sb = withBoard();
    const q = sb.json("ask", "Which auth provider?");
    expect(q).toMatchObject({ key: "APP-1", type: "question", status: "idea", note: "" });
    expect(validateBoard(sb.read())).toEqual([]);
  });

  it("records the answer and moves the question to review, not done", () => {
    const sb = withBoard();
    sb.json("ask", "Which auth provider?");
    const q = sb.json("answer", "APP-1", "Clerk — device codes are built in");
    expect(q).toMatchObject({ status: "review", note: "Clerk — device codes are built in" });
    expect(q.log.at(-1).text).toContain("Clerk");
  });

  it("closes the question with --done", () => {
    const sb = withBoard();
    sb.json("ask", "Postgres or SQLite?");
    expect(sb.json("answer", "APP-1", "SQLite", "--done").status).toBe("done");
  });

  it("needs an answer, and refuses cards that aren't questions", () => {
    const sb = withBoard();
    sb.json("ask", "Which provider?");
    sb.json("add", "Save loops");
    expect(sb.board("answer", "APP-1").err).toContain("missing the answer");
    expect(sb.board("answer", "APP-2", "nope").err).toContain("is a feature, not a question");
  });

  it("keeps questions out of the feature list unless asked for", () => {
    const sb = withBoard();
    sb.json("add", "Save loops", "--status", "active");
    sb.json("ask", "Which auth provider?");
    expect(sb.board("list", "--type", "question").out).toContain("APP-2");
    expect(sb.board("list", "--type", "feature").out).not.toContain("APP-2");
  });

  it("gives questions their own section in context", () => {
    const sb = withBoard();
    sb.json("add", "Save loops", "--status", "active");
    sb.json("ask", "Which auth provider?");
    const out = sb.board("context").out;
    expect(out).toContain("Open questions:");
    expect(out).toContain("APP-2 Which auth provider?");
    expect(out).not.toContain("Ideas:"); // the question isn't loose idea-shaped work
  });
});

describe("board note", () => {
  it("adds a brainstorm, a plan and a reference", () => {
    const sb = withBoard();
    const b = sb.json("note", "add", "brainstorm", "Tabs for everything", "--body", "Ideas evaporate in chat");
    expect(b).toMatchObject({ id: "APP-N1", kind: "brainstorm", body: "Ideas evaporate in chat", cards: [] });

    fs.writeFileSync(path.join(sb.root, "plan.md"), "# plan\n");
    expect(sb.json("note", "add", "plan", "The spec", "--file", "plan.md")).toMatchObject({ id: "APP-N2", file: "plan.md" });
    expect(sb.json("note", "add", "reference", "Clerk docs", "--url", "https://clerk.com")).toMatchObject({
      id: "APP-N3",
      kind: "reference",
      url: "https://clerk.com",
    });
    expect(sb.read().nextNoteNum).toBe(4);
    expect(validateBoard(sb.read())).toEqual([]);
  });

  it("accepts a plural kind and rejects an unknown one", () => {
    const sb = withBoard();
    expect(sb.json("note", "add", "references", "Clerk docs").kind).toBe("reference");
    expect(sb.board("note", "add", "recipe", "Nope").err).toContain("kind must be one of");
  });

  it("links notes to cards and refuses links that would dangle", () => {
    const sb = withBoard();
    sb.json("add", "Save loops");
    sb.json("note", "add", "plan", "The spec");
    expect(sb.json("note", "link", "APP-N1", "APP-1").cards).toEqual(["APP-1"]);
    expect(sb.board("note", "link", "APP-N1", "APP-1").out).toContain("already links");
    expect(sb.board("note", "link", "APP-N1", "APP-99").err).toContain("no card APP-99");
  });

  it("finds a note by id, N-number or bare number", () => {
    const sb = withBoard();
    sb.json("note", "add", "brainstorm", "Tabs");
    for (const ref of ["APP-N1", "N1", "1"]) expect(sb.json("note", "show", ref).id).toBe("APP-N1");
    expect(sb.board("note", "show", "N9").err).toContain("no note APP-N9");
  });

  it("updates, lists by kind and removes", () => {
    const sb = withBoard();
    sb.json("note", "add", "reference", "Clerk", "--url", "https://clerk.com");
    sb.json("note", "add", "brainstorm", "Tabs");
    expect(sb.json("note", "update", "APP-N1", "--title", "Clerk device codes").title).toBe("Clerk device codes");
    expect(sb.board("note", "update", "APP-N1").err).toContain("nothing to update");

    expect(sb.json<any[]>("note", "list", "--kind", "brainstorm").map((n) => n.id)).toEqual(["APP-N2"]);
    expect(sb.json<any[]>("note", "list")).toHaveLength(2);

    expect(sb.json("note", "rm", "APP-N2").id).toBe("APP-N2");
    expect(sb.read().notes).toHaveLength(1);
    expect(sb.board("note", "list").out).toContain("Clerk device codes");
  });

  it("keeps a plan's file inside the project", () => {
    const sb = withBoard();
    expect(sb.board("note", "add", "plan", "Outside", "--file", "../elsewhere.md").err).toContain("outside this project");
  });

  it("counts notes in context without spilling their contents", () => {
    const sb = withBoard();
    sb.json("note", "add", "reference", "Clerk", "--url", "https://clerk.com");
    sb.json("note", "add", "reference", "PostHog", "--url", "https://posthog.com");
    const out = sb.board("context").out;
    expect(out).toContain("Notes: 2 references");
    expect(out).not.toContain("clerk.com");
  });

  it("explains an unknown subcommand", () => {
    const sb = withBoard();
    expect(sb.board("note", "frobnicate").err).toContain("use add, list, show, update, link or rm");
  });
});

describe("schemaVersion 2", () => {
  it("migrates a v1 board by giving it an empty notes list", () => {
    const v1 = {
      schemaVersion: 1,
      project: { name: "My App", key: "APP" },
      settings: { granularity: "normal" },
      nextNum: 2,
      features: [
        {
          key: "APP-1", title: "Save loops", type: "feature", status: "active", note: "",
          doneWhen: [], steps: [], files: [], createdAt: "2026-09-19T10:00:00Z",
          updatedAt: "2026-09-19T10:00:00Z", updatedBy: "claude", log: [],
        },
      ],
    };
    const { board, from, to, migrated } = migrate(v1 as any);
    expect({ from, to, migrated }).toEqual({ from: 1, to: 2, migrated: true });
    expect(board).toMatchObject({ nextNoteNum: 1, notes: [] });
    expect(validateBoard(board)).toEqual([]);
  });

  it("upgrades an existing board file in place and keeps a backup", () => {
    const sb = withBoard();
    const file = path.join(sb.root, ".board/board.json");
    const v1 = { ...sb.read(), schemaVersion: 1 };
    delete v1.notes;
    delete v1.nextNoteNum;
    fs.writeFileSync(file, JSON.stringify(v1));

    expect(sb.board("list").code).toBe(0);
    expect(sb.read().schemaVersion).toBe(2);
    expect(JSON.parse(fs.readFileSync(file + ".v1.bak", "utf8")).schemaVersion).toBe(1);
  });

  it("rejects notes that break the shape", () => {
    const sb = withBoard();
    const bad = (note: unknown) => validateBoard({ ...sb.read(), nextNoteNum: 2, notes: [note] }).join(" ");
    const ok = {
      id: "APP-N1", kind: "plan", title: "The spec", body: "", url: "", file: "", cards: [],
      createdAt: "2026-09-20T10:00:00Z", updatedAt: "2026-09-20T10:00:00Z", updatedBy: "claude",
    };
    expect(validateBoard({ ...sb.read(), nextNoteNum: 2, notes: [ok] })).toEqual([]);
    expect(bad({ ...ok, id: "APP-1" })).toContain("must look like KEY-N12");
    expect(bad({ ...ok, id: "OTHER-N1" })).toContain("prefix must be APP");
    expect(bad({ ...ok, kind: "recipe" })).toContain("notes[0].kind");
    expect(bad({ ...ok, title: " " })).toContain("notes[0].title");
    expect(bad({ ...ok, cards: ["APP-7"] })).toContain("no card APP-7 on this board");
    expect(bad({ ...ok, url: 3 })).toContain("notes[0].url");
  });
});
