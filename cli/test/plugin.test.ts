import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/context.js";
import { sandbox, withBoard } from "./helpers.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string) => fs.readFileSync(path.join(repo, p), "utf8");
const readJson = (p: string) => JSON.parse(read(p));

/** Run a hook script the way Claude Code does: JSON on stdin, JSON or nothing on stdout. */
function runHook(script: string, input: unknown, env: Env = {}) {
  const out = execFileSync(process.execPath, [path.join(repo, "hooks", script)], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, ...env } as NodeJS.ProcessEnv,
  });
  return { raw: out, json: out.trim() ? JSON.parse(out) : null };
}

describe("plugin manifests", () => {
  it("puts plugin.json in .claude-plugin/ and every component directory at the plugin root", () => {
    const m = readJson(".claude-plugin/plugin.json");
    expect(m.name).toBe("loose-ends");
    expect(m.description).toBeTruthy();
    for (const dir of ["skills", "commands", "hooks", "bin"]) {
      expect(fs.existsSync(path.join(repo, dir))).toBe(true);
      expect(fs.existsSync(path.join(repo, ".claude-plugin", dir))).toBe(false);
    }
    // relative component paths must start with ./
    if (m.hooks) expect(String(m.hooks).startsWith("./")).toBe(true);
    expect(fs.existsSync(path.join(repo, String(m.hooks ?? "hooks/hooks.json")))).toBe(true);
  });

  it("describes this plugin in the marketplace manifest", () => {
    const mk = readJson(".claude-plugin/marketplace.json");
    expect(mk.name).toBeTruthy();
    expect(mk.owner?.name).toBeTruthy();
    expect(mk.plugins).toHaveLength(1);
    const p = mk.plugins[0];
    expect(p.name).toBe(readJson(".claude-plugin/plugin.json").name);
    expect(p.description).toBeTruthy();
    expect(p.source).toBe("./"); // the plugin is this repo
  });
});

describe("skill and commands", () => {
  const frontmatter = (text: string): Record<string, string> => {
    const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
    expect(m, "file must start with YAML frontmatter").toBeTruthy();
    const body = m?.[1] ?? "";
    return Object.fromEntries(
      body.split("\n").filter((l) => /^[\w-]+:/.test(l)).map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]),
    );
  };

  it("ships one skill with a description that says when to use it", () => {
    const fm = frontmatter(read("skills/loose-ends/SKILL.md"));
    expect(fm.name).toBe("loose-ends");
    expect((fm.description ?? "").length).toBeGreaterThan(40);
    expect((fm.description ?? "").length).toBeLessThan(1024);
  });

  it("teaches the rules that matter, in the CLI's real vocabulary", () => {
    const body = read("skills/loose-ends/SKILL.md");
    for (const rule of ["board park", "board review", "board merge", "--done-when", "Board:"]) expect(body).toContain(rule);
    for (const status of ["idea", "active", "parked", "review", "done"]) expect(body).toContain(status);
  });

  it("says what to do with a brainstorm: nothing, until it reaches a decision", () => {
    const body = read("skills/loose-ends/SKILL.md");
    expect(body).toContain("Talk is not work");
    expect(body).toContain("Want these on the board as ideas?");
    expect(body).toContain("don't ask again this session");
  });

  it("gives every command a description and only refers to real board commands", () => {
    const files = fs.readdirSync(path.join(repo, "commands"));
    expect(files.sort()).toEqual(["board.md", "done.md", "park.md"]);
    const known = /board (ui|init|context|list|show|add|update|step|park|review|done|merge|touch)\b/g;
    for (const f of files) {
      const text = read(`commands/${f}`);
      const fm = frontmatter(text);
      expect(fm.description, f).toBeTruthy();
      for (const call of text.match(/`board [a-z]+/g) ?? []) expect(`${call}\``.replace(/`/g, "")).toMatch(/board \w+/);
      expect(text.match(known), f).not.toBeNull();
    }
  });
});

describe("hooks.json", () => {
  const cfg = () => readJson("hooks/hooks.json").hooks;

  it("wires the three events from SPEC §5 to executable scripts", () => {
    const h = cfg();
    expect(Object.keys(h).sort()).toEqual(["PostToolUse", "SessionStart", "Stop"]);
    for (const entries of Object.values(h) as any[])
      for (const e of entries)
        for (const hook of e.hooks) {
          expect(hook.type).toBe("command");
          expect(hook.command).toContain("${CLAUDE_PLUGIN_ROOT}");
          const script = path.join(repo, hook.command.replace(/"?\$\{CLAUDE_PLUGIN_ROOT\}"?\//, ""));
          expect(fs.existsSync(script), hook.command).toBe(true);
          fs.accessSync(script, fs.constants.X_OK);
          expect(fs.readFileSync(script, "utf8").startsWith("#!/usr/bin/env node")).toBe(true);
          expect(hook.timeout).toBeGreaterThan(0);
        }
  });

  it("matches only the file-editing tools, and matches nothing for the other events", () => {
    const h = cfg();
    expect(h.PostToolUse[0].matcher).toBe("Edit|Write|NotebookEdit");
    for (const name of ["Edit", "Write", "NotebookEdit"]) expect(new RegExp(`^(${h.PostToolUse[0].matcher})$`).test(name)).toBe(true);
    for (const name of ["Read", "Bash", "Glob"]) expect(new RegExp(`^(${h.PostToolUse[0].matcher})$`).test(name)).toBe(false);
    expect(h.SessionStart[0].matcher).toBeUndefined();
    expect(h.Stop[0].matcher).toBeUndefined();
  });
});

describe("hook behaviour", () => {
  it("SessionStart injects the board summary as additionalContext", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active", "--next", "Wire Save");
    sb.board("add", "Mobile layout", "--status", "parked", "--note", "Header overlaps");

    const { json } = runHook("session-start.mjs", { hook_event_name: "SessionStart", session_id: "s1", cwd: sb.root });
    expect(json.hookSpecificOutput.hookEventName).toBe("SessionStart");
    const ctx = json.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("Loose Ends board: My App (APP)");
    expect(ctx).toContain("APP-1 Save loops — next: Wire Save");
    expect(ctx).toContain("APP-2 Mobile layout — stopped: Header overlaps");
    expect(ctx).toContain("loose-ends skill");
  });

  it("SessionStart offers to create a board when there is none, once", () => {
    const bare = sandbox();
    const ctx = runHook("session-start.mjs", { hook_event_name: "SessionStart", session_id: "s1", cwd: bare.root }).json
      .hookSpecificOutput.additionalContext;
    expect(ctx).toContain("board init");
    expect(ctx).toContain("Don't ask again this session");
  });

  it("PostToolUse attaches the edited file to the active card", () => {
    const sb = withBoard();
    sb.board("add", "Save loops", "--status", "active");
    const file = path.join(sb.root, "src/store/library.ts");

    runHook("post-tool-use.mjs", {
      hook_event_name: "PostToolUse",
      session_id: "s2",
      cwd: sb.root,
      tool_name: "Edit",
      tool_input: { file_path: file },
    }, { CLAUDE_PLUGIN_DATA: sb.home });

    expect(sb.read().features[0].files).toEqual(["src/store/library.ts"]);
  });

  it("PostToolUse stays silent when there is no board", () => {
    const bare = sandbox();
    const r = runHook("post-tool-use.mjs", {
      hook_event_name: "PostToolUse",
      session_id: "s3",
      cwd: bare.root,
      tool_name: "Write",
      tool_input: { file_path: path.join(bare.root, "a.ts") },
    }, { CLAUDE_PLUGIN_DATA: bare.home });
    expect(r.raw).toBe("");
  });

  it("Stop blocks once when code changed but the board didn't", async () => {
    const sb = withBoard();
    delete sb.env.LOOSE_ENDS_NOW; // the Stop check compares card-log times against real edit times
    sb.board("add", "Save loops", "--status", "active");
    const env = { CLAUDE_PLUGIN_DATA: sb.home };
    const stop = () => runHook("stop.mjs", { hook_event_name: "Stop", session_id: "s4", cwd: sb.root }, env);

    expect(stop().raw).toBe(""); // nothing edited yet

    // Card-log timestamps have second resolution, and a board change in the same second
    // as an edit counts as "already updated" — so step past that window deliberately.
    await new Promise((r) => setTimeout(r, 1100));

    // an edit the board doesn't know about (touch rewrites board.json, but logs nothing)
    fs.writeFileSync(path.join(sb.root, "notes.md"), "x");
    runHook("post-tool-use.mjs", {
      session_id: "s4", cwd: sb.root, tool_name: "Write", tool_input: { file_path: path.join(sb.root, "notes.md") },
    }, env);
    const blocked = stop().json;
    expect(blocked.hookSpecificOutput).toMatchObject({ hookEventName: "Stop", decision: "block" });
    expect(blocked.hookSpecificOutput.reason).toContain("board");
    expect(stop().raw).toBe(""); // never twice for the same edit
  });

  it("Stop keeps quiet once the board has moved, and while a Stop hook is already blocking", () => {
    const sb = withBoard();
    delete sb.env.LOOSE_ENDS_NOW;
    sb.board("add", "Save loops", "--status", "active");
    const env = { CLAUDE_PLUGIN_DATA: sb.home };
    runHook("post-tool-use.mjs", {
      session_id: "s5", cwd: sb.root, tool_name: "Edit", tool_input: { file_path: path.join(sb.root, "src/a.ts") },
    }, env);

    sb.board("update", "APP-1", "--note", "Wired the Save button"); // board moves after the edit
    expect(runHook("stop.mjs", { session_id: "s5", cwd: sb.root }, env).raw).toBe("");
    expect(runHook("stop.mjs", { session_id: "s5", cwd: sb.root, stop_hook_active: true }, env).raw).toBe("");
  });

  it("survives junk input instead of breaking the session", () => {
    for (const script of ["session-start.mjs", "post-tool-use.mjs", "stop.mjs"]) {
      const out = execFileSync(process.execPath, [path.join(repo, "hooks", script)], { input: "not json", encoding: "utf8" });
      expect(out).toBe("");
    }
  });
});
