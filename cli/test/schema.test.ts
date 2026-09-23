import { describe, expect, it } from "vitest";
import { migrate, MigrationError } from "../src/migrations.js";
import { SCHEMA_VERSION, emptyBoard, validateBoard } from "../src/schema.js";

const feature = (over: Record<string, unknown> = {}) => ({
  key: "LOOP-3",
  title: "Save loops to library",
  type: "feature",
  status: "parked",
  note: "Save button not wired yet",
  doneWhen: ["A saved loop shows in the library"],
  steps: [{ text: "IndexedDB schema", done: true }],
  files: ["src/store/library.ts"],
  createdAt: "2026-09-18T10:00:00Z",
  updatedAt: "2026-09-20T14:12:00Z",
  updatedBy: "claude",
  log: [{ at: "2026-09-20T14:12:00Z", by: "claude", text: "Parked" }],
  ...over,
});
const board = (features: unknown[] = [feature()]) => ({ ...emptyBoard("Looper", "LOOP"), nextNum: 15, features });

describe("validateBoard", () => {
  it("accepts the SPEC §3 example", () => {
    expect(validateBoard(board())).toEqual([]);
  });

  it("accepts an empty board", () => {
    expect(validateBoard(emptyBoard("X", "XY"))).toEqual([]);
  });

  it.each([
    ["bad status", { status: "wip" }, "status"],
    ["bad type", { type: "epic" }, "type"],
    ["bad actor", { updatedBy: "bot" }, "updatedBy"],
    ["bad timestamp", { createdAt: "yesterday" }, "createdAt"],
    ["empty title", { title: "  " }, "title"],
    ["wrong key prefix", { key: "NEHO-3" }, "prefix must be LOOP"],
    ["key >= nextNum", { key: "LOOP-15" }, "below nextNum"],
    ["bad step", { steps: [{ text: "x" }] }, "steps[0]"],
    ["bad log", { log: [{ at: "2026-09-20T14:12:00Z", by: "claude" }] }, "log[0]"],
    ["note not string", { note: null }, "note"],
  ])("rejects %s", (_n, over, msg) => {
    const errs = validateBoard(board([feature(over)]));
    expect(errs.join("\n")).toContain(msg);
  });

  it("rejects duplicate keys", () => {
    expect(validateBoard(board([feature(), feature()])).join()).toContain("duplicate");
  });

  it("rejects wrong top-level shapes", () => {
    expect(validateBoard(null)).not.toEqual([]);
    expect(validateBoard({ ...board(), schemaVersion: 99 }).join()).toContain("schemaVersion");
    expect(validateBoard({ ...board(), project: { name: "x", key: "lower" } }).join()).toContain("project.key");
    expect(validateBoard({ ...board(), settings: { granularity: "huge" } }).join()).toContain("granularity");
    expect(validateBoard({ ...board(), features: {} }).join()).toContain("features");
  });
});

describe("migrate", () => {
  it("leaves a current board alone", () => {
    const r = migrate(board());
    expect(r.migrated).toBe(false);
    expect(r.to).toBe(SCHEMA_VERSION);
  });

  it("runs each step in order and bumps schemaVersion", () => {
    const steps = {
      1: (b: any) => ({ ...b, a: 1 }),
      2: (b: any) => ({ ...b, b: b.a + 1 }),
    };
    const r = migrate({ schemaVersion: 1 }, steps, 3);
    expect(r).toMatchObject({ from: 1, to: 3, migrated: true, board: { schemaVersion: 3, a: 1, b: 2 } });
  });

  it("does not mutate its input", () => {
    const input = { schemaVersion: 1, list: [1] };
    migrate(input, { 1: (b: any) => (b.list.push(2), b) }, 2);
    expect(input).toEqual({ schemaVersion: 1, list: [1] });
  });

  it("refuses boards from a newer CLI", () => {
    expect(() => migrate({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/Update the Loose Ends plugin/);
  });

  it("errors on a missing migration step or version", () => {
    expect(() => migrate({ schemaVersion: 1 }, {}, 2)).toThrow(MigrationError);
    expect(() => migrate({})).toThrow(/schemaVersion/);
    expect(() => migrate([])).toThrow(MigrationError);
  });
});
