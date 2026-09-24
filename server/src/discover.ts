// Projects Claude Code has worked in that don't have a board yet.
//
// Claude Code keeps one folder per project under ~/.claude/projects, named by a
// lossy encoding of the path (dashes in folder names are indistinguishable from
// separators). So the path is read from the `cwd` field of a session file
// instead of decoded from the name — and nothing else in those files is read.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prettyName } from "../../cli/src/commands.js";
import type { Ctx } from "../../cli/src/context.js";
import { readRegistry } from "../../cli/src/registry.js";
import { boardFileFor } from "../../cli/src/store.js";

export interface Candidate {
  path: string;
  name: string;
  lastSeen: string;
}

export const claudeHome = (ctx: Ctx) =>
  ctx.env.LOOSE_ENDS_CLAUDE_HOME || ctx.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");

/** First `cwd` in a session file. Reads a bounded prefix — transcripts get large. */
function cwdFromSession(file: string): string | null {
  let text: string;
  try {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(64 * 1024);
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    text = buf.subarray(0, read).toString("utf8");
  } catch {
    return null;
  }
  for (const line of text.split("\n")) {
    if (!line.includes('"cwd"')) continue;
    try {
      const cwd = (JSON.parse(line) as { cwd?: unknown }).cwd;
      if (typeof cwd === "string" && cwd.startsWith("/")) return cwd;
    } catch {
      /* a truncated last line is expected */
    }
  }
  return null;
}

/**
 * Not every folder Claude Code opened is a project worth a board: it also works
 * in scratch workspaces, its own config directory, and sometimes $HOME itself.
 */
export function looksLikeAProject(ctx: Ctx, dir: string): boolean {
  const home = os.homedir();
  const resolved = path.resolve(dir);
  if (resolved === home || resolved === path.parse(resolved).root) return false;
  if (path.basename(resolved).startsWith(".")) return false;
  if (resolved.startsWith(path.resolve(claudeHome(ctx)) + path.sep)) return false;
  if (resolved.split(path.sep).includes("Library")) return false; // app support, scratch workspaces
  return true;
}

/** Folders worked in, still present on disk, with no board and not registered. */
export function discoverProjects(ctx: Ctx): Candidate[] {
  const dir = path.join(claudeHome(ctx), "projects");
  if (!fs.existsSync(dir)) return [];
  const registered = new Set(readRegistry(ctx).map((e) => e.path));
  const found = new Map<string, Candidate>();

  for (const entry of fs.readdirSync(dir)) {
    const projectDir = path.join(dir, entry);
    let sessions: string[];
    try {
      if (!fs.statSync(projectDir).isDirectory()) continue;
      sessions = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    if (!sessions.length) continue;

    const newest = sessions
      .map((f) => path.join(projectDir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]!;
    const cwd = cwdFromSession(newest);
    if (!cwd || registered.has(cwd) || found.has(cwd)) continue;
    if (!fs.existsSync(cwd) || fs.existsSync(boardFileFor(cwd))) continue;
    if (!looksLikeAProject(ctx, cwd)) continue;

    found.set(cwd, { path: cwd, name: prettyName(cwd), lastSeen: new Date(fs.statSync(newest).mtimeMs).toISOString() });
  }

  return [...found.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

/** A board may only be created in a folder we already know about. */
export const isKnownProject = (ctx: Ctx, candidate: string) =>
  discoverProjects(ctx).some((c) => c.path === path.resolve(candidate));
