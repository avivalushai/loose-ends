import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverProjects, isKnownProject, looksLikeAProject } from "../../server/src/discover.js";
import { type Sandbox, sandbox, withBoard } from "./helpers.js";

/** Write a fake Claude Code session file for a folder, the way Claude Code does. */
function claudeSession(sb: Sandbox, projectPath: string, { encodedAs = "", cwdLine = true } = {}) {
  const dir = path.join(sb.env.LOOSE_ENDS_CLAUDE_HOME!, "projects", encodedAs || projectPath.replace(/\//g, "-"));
  fs.mkdirSync(dir, { recursive: true });
  const lines = [
    JSON.stringify({ type: "summary", summary: "a session" }),
    ...(cwdLine ? [JSON.stringify({ type: "user", cwd: projectPath, message: { content: "hello" } })] : []),
  ];
  fs.writeFileSync(path.join(dir, "session-1.jsonl"), lines.join("\n") + "\n");
  return dir;
}

const withClaude = () => {
  const sb = sandbox();
  sb.env.LOOSE_ENDS_CLAUDE_HOME = path.join(sb.home, "claude");
  return sb;
};

describe("finding projects that have no board", () => {
  it("reads the real path from the session file, not the folder name", () => {
    const sb = withClaude();
    // the encoded name is lossy — "loose-ends" and "loose/ends" encode the same
    claudeSession(sb, sb.root, { encodedAs: "-tmp-my-app-with-dashes" });
    const found = discoverProjects({ cwd: sb.root, env: sb.env, out: () => {}, err: () => {} });
    expect(found).toHaveLength(1);
    expect(found[0]!.path).toBe(sb.root);
    expect(found[0]!.name).toBe("My App");
    expect(found[0]!.lastSeen).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("leaves out folders that already have a board, are registered, or are gone", () => {
    const sb = withClaude();
    const ctx = { cwd: sb.root, env: sb.env, out: () => {}, err: () => {} };

    const withB = withBoard(); // has a board and is in the registry
    withB.env.LOOSE_ENDS_CLAUDE_HOME = sb.env.LOOSE_ENDS_CLAUDE_HOME;
    claudeSession(sb, withB.root);
    claudeSession(sb, path.join(sb.home, "deleted-project"));
    expect(discoverProjects(ctx)).toEqual([]);

    // the same folder registered under a different home still counts as a board
    claudeSession(sb, sb.root);
    expect(discoverProjects(ctx).map((c) => c.path)).toEqual([sb.root]);
  });

  it("ignores sessions with no cwd, empty folders and a missing projects dir", () => {
    const sb = withClaude();
    const ctx = { cwd: sb.root, env: sb.env, out: () => {}, err: () => {} };
    expect(discoverProjects(ctx)).toEqual([]); // no ~/.claude/projects at all

    claudeSession(sb, sb.root, { cwdLine: false });
    fs.mkdirSync(path.join(sb.env.LOOSE_ENDS_CLAUDE_HOME!, "projects", "-empty-one"), { recursive: true });
    expect(discoverProjects(ctx)).toEqual([]);
  });

  it("lists the most recently used folder first and never twice", () => {
    const sb = withClaude();
    const other = path.join(sb.home, "another-app");
    fs.mkdirSync(other, { recursive: true });
    claudeSession(sb, sb.root, { encodedAs: "-one" });
    claudeSession(sb, sb.root, { encodedAs: "-one-again" }); // same cwd, two session folders
    const newest = claudeSession(sb, other, { encodedAs: "-two" });
    fs.utimesSync(path.join(newest, "session-1.jsonl"), new Date(), new Date(Date.now() + 60_000));

    const found = discoverProjects({ cwd: sb.root, env: sb.env, out: () => {}, err: () => {} });
    expect(found.map((c) => c.path)).toEqual([other, sb.root]);
  });

  it("only vouches for folders it found", () => {
    const sb = withClaude();
    const ctx = { cwd: sb.root, env: sb.env, out: () => {}, err: () => {} };
    claudeSession(sb, sb.root);
    expect(isKnownProject(ctx, sb.root)).toBe(true);
    expect(isKnownProject(ctx, sb.root + "/")).toBe(true); // trailing slash is the same folder
    expect(isKnownProject(ctx, "/etc")).toBe(false);
    expect(isKnownProject(ctx, path.join(sb.home, "never-opened"))).toBe(false);
  });
});

describe("what counts as a project", () => {
  const ctx = (sb: Sandbox) => ({ cwd: sb.root, env: sb.env, out: () => {}, err: () => {} });

  it("leaves out the places Claude Code works that aren't projects", () => {
    const sb = withClaude();
    const home = process.env.HOME!;
    for (const junk of [
      home, // $HOME itself
      path.join(home, ".claude"), // a dotfolder
      path.join(sb.env.LOOSE_ENDS_CLAUDE_HOME!, "something"), // inside the config dir
      path.join(home, "Library/Application Support/Claude/scratch-workspaces/abc/def"),
      "/",
    ])
      expect(looksLikeAProject(ctx(sb), junk), junk).toBe(false);
  });

  it("keeps ordinary project folders", () => {
    const sb = withClaude();
    for (const dir of ["/Users/x/Projects/owl", "/Users/x/code/my-app", sb.root])
      expect(looksLikeAProject(ctx(sb), dir), dir).toBe(true);
  });
});
