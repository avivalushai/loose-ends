import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveKey, prettyName } from "../src/commands.js";
import { sandbox } from "./helpers.js";

describe("board init", () => {
  it("creates a valid board and registers the project", () => {
    const sb = sandbox();
    const r = sb.board("init", "--name", "Looper", "--key", "LOOP");
    expect(r.code).toBe(0);
    expect(r.out).toContain("Created board Looper (LOOP)");
    expect(sb.read()).toEqual({
      schemaVersion: 1,
      project: { name: "Looper", key: "LOOP" },
      settings: { granularity: "normal" },
      nextNum: 1,
      features: [],
    });
    expect(fs.readFileSync(path.join(sb.root, ".board/.gitignore"), "utf8")).toContain("*.lock");
    expect(sb.registry()).toEqual([{ path: sb.root, name: "Looper", key: "LOOP", addedAt: "2026-09-20T10:00:00Z" }]);
  });

  it("derives name and key from the folder", () => {
    const sb = sandbox();
    const res = sb.json("init");
    expect(res.project).toEqual({ name: "My App", key: "MY" });
  });

  it("is idempotent and does not duplicate the registry entry", () => {
    const sb = sandbox();
    sb.board("init", "--key", "APP");
    const r = sb.board("init");
    expect(r.code).toBe(0);
    expect(r.out).toContain("already exists");
    expect(sb.registry()).toHaveLength(1);
  });

  it("refuses to rename an existing board via init", () => {
    const sb = sandbox();
    sb.board("init", "--key", "APP");
    expect(sb.board("init", "--key", "NEW").code).toBe(1);
  });

  it("re-registers an existing board missing from the registry", () => {
    const sb = sandbox();
    sb.board("init", "--key", "APP");
    fs.rmSync(path.join(sb.home, "projects.json"));
    expect(sb.board("init").out).toContain("Registered");
    expect(sb.registry()[0].key).toBe("APP");
  });

  it("keeps other projects in the registry and survives a corrupt registry", () => {
    const sb = sandbox();
    fs.mkdirSync(sb.home, { recursive: true });
    fs.writeFileSync(path.join(sb.home, "projects.json"), "{not json");
    sb.board("init", "--key", "APP");
    const other = path.join(path.dirname(sb.root), "other");
    fs.mkdirSync(other);
    sb.board("init", "-C", other, "--key", "OTH");
    expect(sb.registry().map((e: any) => e.key)).toEqual(["APP", "OTH"]);
  });

  it("rejects bad keys", () => {
    const sb = sandbox();
    const r = sb.board("init", "--key", "9X");
    expect(r.code).toBe(1);
    expect(r.err).toContain("--key");
    expect(fs.existsSync(path.join(sb.root, ".board"))).toBe(false);
  });

  it("derives sensible keys", () => {
    expect(deriveKey("Looper")).toBe("LOOP");
    expect(deriveKey("NehoRace")).toBe("NEHO");
    expect(deriveKey("News Heatmap")).toBe("NEWS");
    expect(deriveKey("a b c")).toBe("ABC");
    expect(deriveKey("X")).toBe("XX");
    expect(deriveKey("3d viewer")).toMatch(/^[A-Z][A-Z0-9]{1,5}$/);
    expect(prettyName("/x/loose-ends")).toBe("Loose Ends");
  });
});
