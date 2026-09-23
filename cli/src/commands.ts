import fs from "node:fs";
import path from "node:path";
import { type Ctx, UserError, actor, nowIso } from "./context.js";
import {
  activeFeature,
  ageDays,
  findFeature,
  formatDetail,
  formatLine,
  progress,
  setStatus,
  sortFeatures,
  stamp,
} from "./features.js";
import { writeFileAtomic } from "./fsutil.js";
import { registerProject, registryFile } from "./registry.js";
import {
  type Board,
  type Feature,
  KEY_RE,
  type Status,
  STATUSES,
  type FeatureType,
  TYPES,
  emptyBoard,
} from "./schema.js";
import { BOARD_DIR, boardFileFor, findBoard, mutateBoard, readBoard, requireBoard, writeBoard } from "./store.js";

export type Opts = Record<string, string | boolean | string[] | undefined>;
export interface Args {
  pos: string[];
  opts: Opts;
}

const str = (o: Opts, k: string) => (typeof o[k] === "string" ? (o[k] as string) : undefined);
const list = (o: Opts, k: string) => (Array.isArray(o[k]) ? (o[k] as string[]) : []);

function emit(ctx: Ctx, opts: Opts, json: unknown, text: string | string[]) {
  if (opts.json) ctx.out(JSON.stringify(json, null, 2));
  else for (const l of [text].flat()) ctx.out(l);
}

function need(pos: string[], i: number, what: string): string {
  const v = pos[i];
  if (v === undefined || v === "") throw new UserError(`missing ${what}`);
  return v;
}

function parseStatus(v: string | undefined): Status | undefined {
  if (v === undefined) return undefined;
  if (!(STATUSES as readonly string[]).includes(v)) throw new UserError(`status must be one of ${STATUSES.join(", ")}`);
  return v as Status;
}

function parseType(v: string | undefined): FeatureType | undefined {
  if (v === undefined) return undefined;
  if (!(TYPES as readonly string[]).includes(v)) throw new UserError(`type must be one of ${TYPES.join(", ")}`);
  return v as FeatureType;
}

// --- init ------------------------------------------------------------------

export function prettyName(dir: string): string {
  return path
    .basename(dir)
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "Project";
}

/** "Looper" → LOOP, "NehoRace" → NEHO, "a b c" → ABC. */
export function deriveKey(name: string): string {
  const words = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const first = (words[0] ?? "").replace(/^[0-9]+/, "");
  let key = first.length >= 2 ? first.slice(0, 4) : words.map((w) => w[0]).join("").slice(0, 4);
  if (!/^[A-Z]/.test(key)) key = "P" + key;
  return (key + "XX").slice(0, Math.max(2, Math.min(key.length, 4)));
}

export function init(ctx: Ctx, { opts }: Args) {
  const root = path.resolve(ctx.cwd);
  const file = boardFileFor(root);
  let board: Board;
  let created = false;

  if (fs.existsSync(file)) {
    board = readBoard(file);
    if (opts.name || opts.key) throw new UserError(`board already exists in ${BOARD_DIR}/ — rename with the UI or edit settings later`);
  } else {
    const name = str(opts, "name")?.trim() || prettyName(root);
    const key = (str(opts, "key") ?? deriveKey(name)).toUpperCase();
    if (!KEY_RE.test(key)) throw new UserError("--key must be 2–6 letters/digits, starting with a letter (e.g. LOOP)");
    board = emptyBoard(name, key);
    writeBoard(file, board);
    writeFileAtomic(path.join(root, BOARD_DIR, ".gitignore"), "*.lock\n*.tmp\n*.bak\n");
    created = true;
  }
  const isNew = registerProject(ctx, { path: root, name: board.project.name, key: board.project.key });

  emit(ctx, opts, { created, registered: isNew, project: board.project, file, registry: registryFile(ctx) }, [
    created
      ? `Created board ${board.project.name} (${board.project.key}) in ${BOARD_DIR}/board.json`
      : `Board ${board.project.name} (${board.project.key}) already exists`,
    isNew ? `Registered in ${registryFile(ctx)}` : `Already registered`,
  ]);
}

// --- read commands ---------------------------------------------------------

export function listCmd(ctx: Ctx, { opts }: Args) {
  const board = readBoard(requireBoard(ctx).file);
  const statuses = str(opts, "status")?.split(",").map((s) => parseStatus(s.trim())!);
  const type = parseType(str(opts, "type"));
  let fs = board.features;
  if (statuses) fs = fs.filter((f) => statuses.includes(f.status));
  else if (!opts.all) fs = fs.filter((f) => f.status !== "done");
  if (type) fs = fs.filter((f) => f.type === type);
  fs = sortFeatures(fs);

  const w = Math.max(0, ...fs.map((f) => f.key.length));
  const hidden = !statuses && !opts.all ? board.features.filter((f) => f.status === "done").length : 0;
  const lines = fs.length ? fs.map((f) => formatLine(f, w)) : ["No cards."];
  if (hidden) lines.push(`(+${hidden} done — use --all)`);
  emit(ctx, opts, fs, lines);
}

export function show(ctx: Ctx, { pos, opts }: Args) {
  const board = readBoard(requireBoard(ctx).file);
  const f = findFeature(board, need(pos, 0, "card key (e.g. LOOP-3)"));
  emit(ctx, opts, f, formatDetail(ctx, f));
}

export function context(ctx: Ctx, { opts }: Args) {
  const loc = findBoard(ctx.cwd);
  if (!loc) {
    return emit(ctx, opts, { board: null }, "Loose Ends: no board in this project yet. Offer to create one with `board init`.");
  }
  const b = readBoard(loc.file);
  const by = (s: Status) => sortFeatures(b.features.filter((f) => f.status === s));
  const counts = Object.fromEntries(STATUSES.map((s) => [s, b.features.filter((f) => f.status === s).length]));

  if (opts.json)
    return ctx.out(
      JSON.stringify(
        { project: b.project, root: loc.root, counts, active: by("active"), parked: by("parked"), review: by("review"), ideas: by("idea") },
        null,
        2,
      ),
    );

  const summary = STATUSES.filter((s) => counts[s]).map((s) => `${counts[s]} ${s}`).join(", ") || "empty";
  const lines = [`Loose Ends board: ${b.project.name} (${b.project.key}) — ${summary}`];
  const section = (title: string, fs: Feature[], extra: (f: Feature) => string) => {
    if (!fs.length) return;
    lines.push(`${title}:`);
    for (const f of fs) {
      const { done, total } = progress(f);
      const bits = [`  ${f.key} ${f.title}`];
      if (total) bits.push(`(${done}/${total})`);
      const e = extra(f);
      if (e) bits.push(`— ${e}`);
      lines.push(bits.join(" "));
    }
  };
  section("Active", by("active"), (f) => (f.note ? `next: ${f.note}` : ""));
  section("Parked", by("parked"), (f) => `stopped: ${f.note} (idle ${ageDays(ctx, f.updatedAt)}d)`);
  section("Review", by("review"), (f) => {
    const d = ageDays(ctx, f.updatedAt);
    return [f.note && `check: ${f.note}`, d >= 2 && `in review ${d}d — ask if it's done`].filter(Boolean).join("; ");
  });
  const ideas = by("idea");
  if (ideas.length) {
    const shown = ideas.slice(0, 10).map((f) => `${f.key} ${f.title}`);
    lines.push(`Ideas: ${shown.join(" · ")}${ideas.length > 10 ? ` · +${ideas.length - 10} more` : ""}`);
  }
  ctx.out(lines.join("\n"));
}

// --- write commands --------------------------------------------------------

export function add(ctx: Ctx, { pos, opts }: Args) {
  const title = need(pos, 0, `title (e.g. board add "Export loop as WAV")`).trim();
  if (!title) throw new UserError("title can't be empty");
  const status = parseStatus(str(opts, "status")) ?? "idea";
  const type = parseType(str(opts, "type")) ?? "feature";
  const note = str(opts, "note") ?? str(opts, "next") ?? "";
  const by = actor(ctx, str(opts, "by"));
  const loc = requireBoard(ctx);

  const f = mutateBoard(loc, (b) => {
    const at = nowIso(ctx);
    const f: Feature = {
      key: `${b.project.key}-${b.nextNum}`,
      title,
      type,
      status,
      note,
      doneWhen: list(opts, "done-when"),
      steps: list(opts, "step").map((text) => ({ text, done: false })),
      files: [],
      createdAt: at,
      updatedAt: at,
      updatedBy: by,
      log: [{ at, by, text: status === "idea" ? "Created" : `Created — ${status}` }],
    };
    if (status === "parked" && !note.trim()) throw new UserError(`parking needs a note saying where you stopped (--note "...")`);
    b.nextNum++;
    b.features.push(f);
    return f;
  });
  emit(ctx, opts, f, `Added ${f.key} ${f.title} (${f.status})`);
}

export function update(ctx: Ctx, { pos, opts }: Args) {
  const keyArg = need(pos, 0, "card key");
  const by = actor(ctx, str(opts, "by"));
  const status = parseStatus(str(opts, "status"));
  const type = parseType(str(opts, "type"));
  const title = str(opts, "title")?.trim();
  const note = str(opts, "note") ?? str(opts, "next");
  const doneWhen = list(opts, "done-when");
  if (title === "") throw new UserError("title can't be empty");
  if (!status && !type && title === undefined && note === undefined && !doneWhen.length)
    throw new UserError("nothing to update (use --title, --note, --status, --type or --done-when)");

  const f = mutateBoard(requireBoard(ctx), (b) => {
    const f = findFeature(b, keyArg);
    const logs: string[] = [];
    if (title !== undefined && title !== f.title) {
      logs.push(`Renamed from “${f.title}”`);
      f.title = title;
    }
    if (type && type !== f.type) {
      logs.push(`Type → ${type}`);
      f.type = type;
    }
    if (doneWhen.length) {
      f.doneWhen = doneWhen;
      logs.push("Updated done-when");
    }
    if (status && status !== f.status) {
      setStatus(ctx, f, status, by, note);
    } else {
      if (note !== undefined && note !== f.note) {
        f.note = note;
        logs.push(note ? `Note: ${note}` : "Cleared note");
      }
      if (f.status === "parked" && !f.note.trim()) throw new UserError("a parked card needs a note");
    }
    for (const l of logs) stamp(ctx, f, by, l);
    if (!logs.length) stamp(ctx, f, by);
    return f;
  });
  emit(ctx, opts, f, `Updated ${formatLine(f)}`);
}

function statusCommand(to: Status) {
  return (ctx: Ctx, { pos, opts }: Args) => {
    const keyArg = need(pos, 0, "card key");
    const by = actor(ctx, str(opts, "by"));
    const note = str(opts, "note");
    const f = mutateBoard(requireBoard(ctx), (b) => {
      const f = findFeature(b, keyArg);
      setStatus(ctx, f, to, by, note);
      return f;
    });
    emit(ctx, opts, f, `${f.key} ${f.title} → ${f.status}`);
  };
}

export const park = statusCommand("parked");
export const review = statusCommand("review");
export const done = statusCommand("done");

export function step(ctx: Ctx, { pos, opts }: Args) {
  const keyArg = need(pos, 0, "card key");
  const text = need(pos, 1, `step text or number (e.g. board step LOOP-3 "Render buffer")`).trim();
  const by = actor(ctx, str(opts, "by"));
  if (opts.done && opts.undone) throw new UserError("use --done or --undone, not both");

  const { f, msg } = mutateBoard(requireBoard(ctx), (b) => {
    const f = findFeature(b, keyArg);
    const idx = /^\d+$/.test(text) ? Number(text) - 1 : f.steps.findIndex((s) => s.text.toLowerCase() === text.toLowerCase());
    const existing = f.steps[idx];
    if (/^\d+$/.test(text) && !existing) throw new UserError(`${f.key} has no step ${text}`);

    let msg: string;
    if (opts.remove) {
      if (!existing) throw new UserError(`${f.key} has no step “${text}”`);
      f.steps.splice(idx, 1);
      msg = `Step removed: ${existing.text}`;
    } else if (existing) {
      const want = opts.undone ? false : opts.done ? true : existing.done;
      if (want === existing.done) return { f, msg: `Step already ${want ? "done" : "open"}: ${existing.text}` };
      existing.done = want;
      msg = `Step ${want ? "done" : "reopened"}: ${existing.text}`;
    } else {
      f.steps.push({ text, done: !!opts.done });
      msg = `Step added${opts.done ? " (done)" : ""}: ${text}`;
    }
    stamp(ctx, f, by, msg);
    return { f, msg };
  });
  const { done: d, total } = progress(f);
  emit(ctx, opts, f, `${f.key} ${msg} (${d}/${total})`);
}

export function merge(ctx: Ctx, { pos, opts }: Args) {
  const fromArg = need(pos, 0, "card to merge (board merge LOOP-15 --into LOOP-3)");
  const intoArg = str(opts, "into");
  if (!intoArg) throw new UserError("missing --into <card>");
  const by = actor(ctx, str(opts, "by"));

  const { from, into } = mutateBoard(requireBoard(ctx), (b) => {
    const from = findFeature(b, fromArg);
    const into = findFeature(b, intoArg);
    if (from === into) throw new UserError("can't merge a card into itself");
    const known = new Set(into.steps.map((s) => s.text.toLowerCase()));
    for (const s of from.steps) if (!known.has(s.text.toLowerCase())) into.steps.push(s);
    into.files = [...new Set([...into.files, ...from.files])];
    into.doneWhen = [...new Set([...into.doneWhen, ...from.doneWhen])];
    if (!into.note && from.note) into.note = from.note;
    into.log = [...into.log, ...from.log].sort((x, y) => x.at.localeCompare(y.at));
    if (Date.parse(from.createdAt) < Date.parse(into.createdAt)) into.createdAt = from.createdAt;
    stamp(ctx, into, by, `Merged in ${from.key} “${from.title}”`);
    b.features = b.features.filter((f) => f !== from);
    return { from, into };
  });
  emit(ctx, opts, into, `Merged ${from.key} into ${into.key} ${into.title}`);
}

/** Attach files to the active card. Silent no-op when there is nothing to do — hooks call this on every edit. */
export function touch(ctx: Ctx, { pos, opts }: Args) {
  if (!pos.length) throw new UserError("missing file(s)");
  const loc = findBoard(ctx.cwd);
  const nothing = (why: string) => (opts.json ? ctx.out(JSON.stringify({ card: null, added: [], reason: why })) : undefined);
  if (!loc) return nothing("no board");

  const rels = pos
    .map((p) => path.relative(loc.root, path.resolve(ctx.cwd, p)))
    .filter((r) => r && !r.startsWith("..") && !path.isAbsolute(r))
    .map((r) => r.split(path.sep).join("/"))
    .filter((r) => r !== BOARD_DIR && !r.startsWith(BOARD_DIR + "/"));
  if (!rels.length) return nothing("no files inside the project");

  const probe = activeFeature(readBoard(loc.file));
  if (!probe || rels.every((r) => probe.files.includes(r))) return nothing(probe ? "already attached" : "no active card");

  const by = actor(ctx, str(opts, "by"));
  const res = mutateBoard(loc, (b) => {
    const f = activeFeature(b);
    if (!f) return null;
    const added = rels.filter((r) => !f.files.includes(r));
    f.files.push(...new Set(added));
    if (added.length) stamp(ctx, f, by);
    return { f, added: [...new Set(added)] };
  });
  if (!res || !res.added.length) return nothing("already attached");
  emit(ctx, opts, { card: res.f.key, added: res.added }, `${res.f.key} + ${res.added.join(", ")}`);
}
