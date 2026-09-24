// The JSON API (SPEC §6). Every write shells through the CLI's own command
// layer, so the UI can never produce a board.json the CLI wouldn't.

import { run } from "../../cli/src/cli.js";
import type { Ctx } from "../../cli/src/context.js";
import type { Feature, Note, Step } from "../../cli/src/schema.js";
import { discoverProjects, isKnownProject } from "./discover.js";
import { type Project, findProject, listProjects, loadBoard, summarize } from "./projects.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Run a board command in a project. Returns the parsed --json output. */
function board<T>(ctx: Ctx, project: Project, argv: string[]): T {
  const out: string[] = [];
  const err: string[] = [];
  const code = run([...argv, "--json"], {
    cwd: project.path,
    env: { ...ctx.env, LOOSE_ENDS_BY: "user" }, // the UI is the user typing
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  if (code !== 0) throw new HttpError(400, err.join("\n").replace(/^board: /, "") || "board command failed");
  return JSON.parse(out.join("\n") || "null") as T;
}

const feature = (project: Project, key: string): Feature => {
  const f = loadBoard(project).features.find((x) => x.key === key);
  if (!f) throw new HttpError(404, `no card ${key}`);
  return f;
};

const note = (project: Project, id: string): Note => {
  const n = loadBoard(project).notes.find((x) => x.id === id);
  if (!n) throw new HttpError(404, `no note ${id}`);
  return n;
};

function project(ctx: Ctx, id: string): Project {
  const p = findProject(ctx, id);
  if (!p) throw new HttpError(404, `no project ${id}`);
  return p;
}

const str = (v: unknown, what: string): string => {
  if (typeof v !== "string") throw new HttpError(400, `${what} must be a string`);
  return v;
};

export interface FeaturePatch {
  title?: string;
  note?: string;
  status?: string;
  type?: string;
  doneWhen?: string[];
  steps?: Step[];
}

/** Turn a patch into board commands: field edits first, then step diffs. */
function applyPatch(ctx: Ctx, p: Project, key: string, patch: FeaturePatch): Feature {
  const argv = ["update", key];
  if (patch.title !== undefined) argv.push("--title", str(patch.title, "title"));
  if (patch.note !== undefined) argv.push("--note", str(patch.note, "note"));
  if (patch.status !== undefined) argv.push("--status", str(patch.status, "status"));
  if (patch.type !== undefined) argv.push("--type", str(patch.type, "type"));
  for (const d of patch.doneWhen ?? []) argv.push("--done-when", str(d, "doneWhen entry"));
  if (argv.length > 2) board<Feature>(ctx, p, argv);

  if (patch.steps) {
    const before = feature(p, key).steps;
    const after = patch.steps.map((s) => ({ text: str(s?.text, "step text"), done: !!s?.done }));
    for (const s of before) if (!after.some((a) => a.text === s.text)) board(ctx, p, ["step", key, s.text, "--remove"]);
    for (const s of after) {
      const was = before.find((b) => b.text === s.text);
      if (!was) board(ctx, p, ["step", key, s.text, ...(s.done ? ["--done"] : [])]);
      else if (was.done !== s.done) board(ctx, p, ["step", key, s.text, s.done ? "--done" : "--undone"]);
    }
  }
  return feature(p, key);
}

export interface ApiRequest {
  method: string;
  path: string;
  body: unknown;
}

/** Returns the JSON body for an API route, or undefined if the path isn't one. */
export function handleApi(ctx: Ctx, req: ApiRequest): unknown | undefined {
  const { method, path } = req;
  const seg = path.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);

  // GET /api/discover — folders Claude Code has worked in that have no board
  if (seg[0] === "discover" && seg.length === 1) {
    if (method !== "GET") throw new HttpError(405, "use GET");
    return discoverProjects(ctx);
  }

  if (seg[0] !== "projects") return undefined;

  // GET /api/projects · POST /api/projects (create a board in a known folder)
  if (seg.length === 1) {
    if (method === "GET") return listProjects(ctx).map(summarize);
    if (method !== "POST") throw new HttpError(405, "use GET or POST");

    const b = (req.body ?? {}) as Record<string, unknown>;
    const dir = str(b.path, "path");
    // A page in a browser must not be able to write into any folder it names.
    if (!isKnownProject(ctx, dir)) throw new HttpError(403, "that folder isn't a project Claude Code has worked in, or it already has a board");

    const argv = ["init"];
    for (const [flag, key] of [["--name", "name"], ["--key", "key"]] as const)
      if (b[key] !== undefined && b[key] !== "") argv.push(flag, str(b[key], key));
    return board(ctx, { id: "", name: "", key: "", path: dir, addedAt: "" }, argv);
  }

  const p = project(ctx, seg[1]!);

  // GET /api/projects/:id/board
  if (seg.length === 3 && seg[2] === "board") {
    if (method !== "GET") throw new HttpError(405, "use GET");
    return loadBoard(p);
  }

  // POST /api/projects/:id/notes · PATCH|DELETE /api/projects/:id/notes/:id
  if (seg[2] === "notes") {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const fields = [["--title", "title"], ["--body", "body"], ["--url", "url"], ["--file", "file"]] as const;

    if (seg.length === 3) {
      if (method !== "POST") throw new HttpError(405, "use POST");
      const argv = ["note", "add", str(b.kind, "kind"), str(b.title, "title")];
      for (const [flag, key] of fields)
        if (key !== "title" && b[key] !== undefined && b[key] !== "") argv.push(flag, str(b[key], key));
      for (const c of (b.cards as string[]) ?? []) argv.push("--card", str(c, "card key"));
      return board<Note>(ctx, p, argv);
    }

    if (seg.length === 4) {
      const id = seg[3]!.toUpperCase();
      note(p, id); // 404 before any write
      if (method === "DELETE") return board<Note>(ctx, p, ["note", "rm", id]);
      if (method !== "PATCH") throw new HttpError(405, "use PATCH or DELETE");

      const argv = ["note", "update", id];
      if (b.kind !== undefined && b.kind !== "") argv.push("--kind", str(b.kind, "kind"));
      for (const [flag, key] of fields) if (b[key] !== undefined) argv.push(flag, str(b[key], key));
      for (const c of (b.cards as string[]) ?? []) argv.push("--card", str(c, "card key"));
      return argv.length > 3 ? board<Note>(ctx, p, argv) : note(p, id);
    }
  }

  if (seg[2] !== "features") throw new HttpError(404, `no route ${path}`);

  // POST /api/projects/:id/features
  if (seg.length === 3) {
    if (method !== "POST") throw new HttpError(405, "use POST");
    const b = (req.body ?? {}) as Record<string, unknown>;
    const argv = ["add", str(b.title, "title")];
    for (const [flag, key] of [["--status", "status"], ["--type", "type"], ["--note", "note"]] as const)
      if (b[key] !== undefined && b[key] !== "") argv.push(flag, str(b[key], key));
    for (const s of (b.steps as Step[]) ?? []) argv.push("--step", str(s?.text, "step text"));
    for (const d of (b.doneWhen as string[]) ?? []) argv.push("--done-when", str(d, "doneWhen entry"));
    return board<Feature>(ctx, p, argv);
  }

  // PATCH|DELETE /api/projects/:id/features/:key
  if (seg.length === 4) {
    const key = seg[3]!.toUpperCase();
    feature(p, key); // 404 before any write
    if (method === "PATCH") return applyPatch(ctx, p, key, (req.body ?? {}) as FeaturePatch);
    if (method === "DELETE") return board<Feature>(ctx, p, ["delete", key]);
    throw new HttpError(405, "use PATCH or DELETE");
  }

  throw new HttpError(404, `no route ${path}`);
}
