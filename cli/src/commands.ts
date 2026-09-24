import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { clearAuth, readAuth, readSettings, siteUrl, writeAuth, writeSettings } from "./account.js";
import { track } from "./analytics.js";
import { type Ctx, UserError, actor, nowIso } from "./context.js";
import {
  activeFeature,
  ageDays,
  fileFits,
  findFeature,
  formatDetail,
  formatLine,
  progress,
  setStatus,
  sortFeatures,
  stamp,
} from "./features.js";
import { writeFileAtomic } from "./fsutil.js";
import { readRegistry, registerProject, registryFile } from "./registry.js";
import {
  type Board,
  type Feature,
  KEY_RE,
  type Note,
  NOTE_KINDS,
  type NoteKind,
  type Status,
  STATUSES,
  type FeatureType,
  TYPES,
  emptyBoard,
} from "./schema.js";
import { findNote, formatNoteDetail, formatNoteLine, sortNotes, stampNote } from "./notes.js";
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
  // Questions get their own section, so they don't show up twice.
  const work = b.features.filter((f) => f.type !== "question");
  const questions = sortFeatures(b.features.filter((f) => f.type === "question" && f.status !== "done"));
  const by = (s: Status) => sortFeatures(work.filter((f) => f.status === s));
  const counts = Object.fromEntries(STATUSES.map((s) => [s, b.features.filter((f) => f.status === s).length]));
  const noteCounts = Object.fromEntries(NOTE_KINDS.map((k) => [k, b.notes.filter((n) => n.kind === k).length]));

  if (opts.json)
    return ctx.out(
      JSON.stringify(
        {
          project: b.project,
          root: loc.root,
          counts,
          noteCounts,
          active: by("active"),
          parked: by("parked"),
          review: by("review"),
          ideas: by("idea"),
          questions,
          notes: sortNotes(b.notes),
        },
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
  if (questions.length) {
    lines.push("Open questions:");
    for (const q of questions)
      lines.push(`  ${q.key} ${q.title}${q.status === "review" && q.note ? ` — answered: ${q.note}` : ""}`);
  }
  const notes = NOTE_KINDS.filter((k) => noteCounts[k]).map((k) => `${noteCounts[k]} ${k}${noteCounts[k] === 1 ? "" : "s"}`);
  if (notes.length) lines.push(`Notes: ${notes.join(" · ")} — \`board note list\``);
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
      files: projectFiles(loc.root, ctx.cwd, list(opts, "file")),
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
  if (!status && !type && title === undefined && note === undefined && !doneWhen.length && !list(opts, "file").length && !list(opts, "unfile").length)
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
    const root = requireBoard(ctx).root;
    const added = projectFiles(root, ctx.cwd, list(opts, "file")).filter((x) => !f.files.includes(x));
    if (added.length) {
      f.files.push(...added);
      logs.push(`Files: ${added.join(", ")}`);
    }
    // Files land on cards automatically, so they sometimes land on the wrong one.
    const dropped = projectFiles(root, ctx.cwd, list(opts, "unfile")).filter((x) => f.files.includes(x));
    if (dropped.length) {
      f.files = f.files.filter((x) => !dropped.includes(x));
      logs.push(`Removed files: ${dropped.join(", ")}`);
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

/** Paths inside the project, relative and de-duplicated. Anything outside it is dropped. */
export function projectFiles(root: string, cwd: string, paths: string[]): string[] {
  const rels = paths
    .map((p) => path.relative(root, path.resolve(cwd, p)))
    .filter((r) => r && !r.startsWith("..") && !path.isAbsolute(r))
    .map((r) => r.split(path.sep).join("/"))
    .filter((r) => r !== BOARD_DIR && !r.startsWith(BOARD_DIR + "/"));
  return [...new Set(rels)];
}

/** Attach files to the active card. Silent no-op when there is nothing to do — hooks call this on every edit. */
export function touch(ctx: Ctx, { pos, opts }: Args) {
  if (!pos.length) throw new UserError("missing file(s)");
  const loc = findBoard(ctx.cwd);
  const nothing = (why: string) => (opts.json ? ctx.out(JSON.stringify({ card: null, added: [], reason: why })) : undefined);
  if (!loc) return nothing("no board");

  const rels = projectFiles(loc.root, ctx.cwd, pos);
  if (!rels.length) return nothing("no files inside the project");

  const target = str(opts, "card");
  const board = readBoard(loc.file);
  const probe = target ? findFeature(board, target) : activeFeature(board);
  if (!probe) return nothing("no active card");
  // Named explicitly, the caller knows which card this is; otherwise the file has to fit.
  const wanted = (f: Feature, r: string) => !f.files.includes(r) && (!!target || fileFits(f, r));
  if (!rels.some((r) => wanted(probe, r)))
    return nothing(rels.every((r) => probe.files.includes(r)) ? "already attached" : "no card these files belong to");

  const by = actor(ctx, str(opts, "by"));
  const res = mutateBoard(loc, (b) => {
    const f = target ? findFeature(b, target) : activeFeature(b);
    if (!f) return null;
    const added = [...new Set(rels.filter((r) => wanted(f, r)))];
    f.files.push(...added);
    if (added.length) stamp(ctx, f, by);
    return { f, added };
  });
  if (!res || !res.added.length) return nothing("already attached");
  emit(ctx, opts, { card: res.f.key, added: res.added }, `${res.f.key} + ${res.added.join(", ")}`);
}

/** Remove a card. The UI's delete button; the skill prefers `merge`. */
export function remove(ctx: Ctx, { pos, opts }: Args) {
  const keyArg = need(pos, 0, "card key");
  const f = mutateBoard(requireBoard(ctx), (b) => {
    const f = findFeature(b, keyArg);
    b.features = b.features.filter((x) => x !== f);
    return f;
  });
  emit(ctx, opts, f, `Deleted ${f.key} ${f.title}`);
}

/** Start the local server and open the board. Imported lazily: the server imports the CLI back. */
export function ui(ctx: Ctx, { opts }: Args) {
  const port = str(opts, "port") ? Number(str(opts, "port")) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new UserError("--port must be a port number");

  void import("../../server/src/server.js")
    .then(({ listen, DEFAULT_PORT }) => listen(ctx, port ?? DEFAULT_PORT))
    .then(({ url }) => {
      const projects = readRegistry(ctx).length;
      ctx.out(`Loose Ends → ${url}`);
      ctx.out(`${projects} project${projects === 1 ? "" : "s"} · board data stays on this machine · Ctrl-C to stop`);
      if (!opts["no-open"]) openBrowser(url);
    })
    .catch((e: Error) => {
      ctx.err(`board: can't start the server: ${e.message}`);
      process.exitCode = 1;
    });
}

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {
    /* no browser is fine — the URL is printed above */
  }
}

// --- questions -------------------------------------------------------------

/** A question is a card: it has a next step (find out) and an end (decided). */
export function ask(ctx: Ctx, { pos, opts }: Args) {
  add(ctx, { pos, opts: { ...opts, type: "question" } });
}

/** Record the answer and move the question to review — answered, not yet decided. */
export function answer(ctx: Ctx, { pos, opts }: Args) {
  const keyArg = need(pos, 0, "question key");
  const text = (pos[1] ?? str(opts, "note") ?? "").trim();
  if (!text) throw new UserError(`missing the answer (board answer LE-7 "what you found out")`);
  const by = actor(ctx, str(opts, "by"));

  const f = mutateBoard(requireBoard(ctx), (b) => {
    const f = findFeature(b, keyArg);
    if (f.type !== "question")
      throw new UserError(`${f.key} is a ${f.type}, not a question — use \`board update ${f.key} --note\``);
    setStatus(ctx, f, opts.done ? "done" : "review", by, text);
    return f;
  });
  emit(ctx, opts, f, `${f.key} ${f.status === "done" ? "answered and closed" : "answered — decide when you're ready"}`);
}

// --- notes: brainstorms, plans, references ---------------------------------

function parseKind(v: string | undefined): NoteKind {
  if (v === undefined) throw new UserError(`missing kind — one of ${NOTE_KINDS.join(", ")}`);
  const k = v.toLowerCase().replace(/s$/, "");
  if (!(NOTE_KINDS as readonly string[]).includes(k)) throw new UserError(`kind must be one of ${NOTE_KINDS.join(", ")}`);
  return k as NoteKind;
}

/** Card keys a note points at, checked against the board so links can't dangle. */
function noteCards(b: Board, keys: string[]): string[] {
  return [...new Set(keys.map((k) => findFeature(b, k).key))];
}

function noteFile(ctx: Ctx, root: string, v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (!v) return "";
  const [rel] = projectFiles(root, ctx.cwd, [v]);
  if (!rel) throw new UserError(`${v} is outside this project`);
  return rel;
}

export function note(ctx: Ctx, { pos, opts }: Args) {
  const sub = (pos[0] ?? "list").toLowerCase();
  const rest = pos.slice(1);
  const subs: Record<string, (ctx: Ctx, pos: string[], opts: Opts) => void> = {
    add: noteAdd,
    list: noteList,
    ls: noteList,
    show: noteShow,
    update: noteUpdate,
    edit: noteUpdate,
    link: noteLink,
    rm: noteRemove,
    delete: noteRemove,
  };
  const fn = subs[sub];
  if (!fn) throw new UserError(`unknown: board note ${sub} — use add, list, show, update, link or rm`);
  fn(ctx, rest, opts);
}

function noteAdd(ctx: Ctx, pos: string[], opts: Opts) {
  const kind = parseKind(pos[0]);
  const title = need(pos, 1, `title (e.g. board note add reference "The CRDT paper" --url ...)`).trim();
  if (!title) throw new UserError("title can't be empty");
  const by = actor(ctx, str(opts, "by"));
  const loc = requireBoard(ctx);

  const n = mutateBoard(loc, (b) => {
    const at = nowIso(ctx);
    const n: Note = {
      id: `${b.project.key}-N${b.nextNoteNum}`,
      kind,
      title,
      body: str(opts, "body") ?? "",
      url: str(opts, "url") ?? "",
      file: noteFile(ctx, loc.root, str(opts, "file")) ?? "",
      cards: noteCards(b, list(opts, "card")),
      createdAt: at,
      updatedAt: at,
      updatedBy: by,
    };
    b.nextNoteNum++;
    b.notes.push(n);
    return n;
  });
  emit(ctx, opts, n, `Added ${n.id} ${n.title} (${n.kind})`);
}

function noteList(ctx: Ctx, _pos: string[], opts: Opts) {
  const b = readBoard(requireBoard(ctx).file);
  const kind = str(opts, "kind") ? parseKind(str(opts, "kind")) : undefined;
  const ns = sortNotes(kind ? b.notes.filter((n) => n.kind === kind) : b.notes);
  const w = Math.max(0, ...ns.map((n) => n.id.length));
  emit(ctx, opts, ns, ns.length ? ns.map((n) => formatNoteLine(n, w)) : ["No notes."]);
}

function noteShow(ctx: Ctx, pos: string[], opts: Opts) {
  const b = readBoard(requireBoard(ctx).file);
  const n = findNote(b, need(pos, 0, "note id (e.g. LOOP-N3)"));
  emit(ctx, opts, n, formatNoteDetail(ctx, n));
}

function noteUpdate(ctx: Ctx, pos: string[], opts: Opts) {
  const idArg = need(pos, 0, "note id");
  const by = actor(ctx, str(opts, "by"));
  const loc = requireBoard(ctx);
  const fields = ["title", "body", "url", "file"] as const;
  if (!fields.some((f) => str(opts, f) !== undefined) && !list(opts, "card").length && !str(opts, "kind"))
    throw new UserError("nothing to update (use --title, --body, --url, --file, --kind or --card)");

  const n = mutateBoard(loc, (b) => {
    const n = findNote(b, idArg);
    const title = str(opts, "title")?.trim();
    if (title === "") throw new UserError("title can't be empty");
    if (title !== undefined) n.title = title;
    if (str(opts, "kind") !== undefined) n.kind = parseKind(str(opts, "kind"));
    if (str(opts, "body") !== undefined) n.body = str(opts, "body")!;
    if (str(opts, "url") !== undefined) n.url = str(opts, "url")!;
    const file = noteFile(ctx, loc.root, str(opts, "file"));
    if (file !== undefined) n.file = file;
    const cards = list(opts, "card");
    if (cards.length) n.cards = [...new Set([...n.cards, ...noteCards(b, cards)])];
    stampNote(ctx, n, by);
    return n;
  });
  emit(ctx, opts, n, `Updated ${formatNoteLine(n)}`);
}

/** Tie a note to the cards that came out of it — the plan-to-board trail. */
function noteLink(ctx: Ctx, pos: string[], opts: Opts) {
  const idArg = need(pos, 0, "note id");
  const keys = [...pos.slice(1), ...list(opts, "card")];
  if (!keys.length) throw new UserError("missing card(s) to link (board note link LOOP-N3 LOOP-4)");
  const by = actor(ctx, str(opts, "by"));

  const { n, added } = mutateBoard(requireBoard(ctx), (b) => {
    const n = findNote(b, idArg);
    const added = noteCards(b, keys).filter((k) => !n.cards.includes(k));
    n.cards.push(...added);
    if (added.length) stampNote(ctx, n, by);
    return { n, added };
  });
  emit(ctx, opts, n, added.length ? `${n.id} → ${added.join(", ")}` : `${n.id} already links those`);
}

function noteRemove(ctx: Ctx, pos: string[], opts: Opts) {
  const idArg = need(pos, 0, "note id");
  const n = mutateBoard(requireBoard(ctx), (b) => {
    const n = findNote(b, idArg);
    b.notes = b.notes.filter((x) => x !== n);
    return n;
  });
  emit(ctx, opts, n, `Deleted ${n.id} ${n.title}`);
}

// --- account (SPEC §9) ---------------------------------------------------

async function postJson(url: string, body: unknown, timeoutMs = 10_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new UserError(json.error || `${res.status} ${res.statusText}`);
    return json;
  } catch (e) {
    if (e instanceof UserError) throw e;
    if ((e as Error).name === "AbortError") throw new UserError(`${url} didn't answer in time`);
    throw new UserError(`can't reach ${url}: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Device-code sign-in: the CLI shows a code, the browser approves it. */
export function login(ctx: Ctx, { opts }: Args) {
  const site = siteUrl(ctx);
  void (async () => {
    try {
      const start = await postJson(`${site}/api/device/start`, {});
      const verifyUrl: string = start.verifyUrl ?? `${site}/link?code=${start.userCode}`;
      ctx.out(`Your code: ${start.userCode}`);
      ctx.out(`Approve it at ${verifyUrl}`);
      if (!opts["no-open"]) openBrowser(verifyUrl);

      const intervalMs = Math.max(1, Number(start.interval) || 2) * 1000;
      const deadline = Date.now() + (Number(start.expiresIn) || 600) * 1000;
      for (;;) {
        await wait(intervalMs);
        if (Date.now() > deadline) throw new UserError("the code expired — run `board login` again");
        const poll = await postJson(`${site}/api/device/poll`, { deviceCode: start.deviceCode });
        if (poll.status === "pending") continue;
        if (poll.status === "denied") throw new UserError("sign-in was declined");
        if (poll.status === "expired") throw new UserError("the code expired — run `board login` again");
        if (poll.status !== "approved" || !poll.token) throw new UserError(`unexpected answer: ${JSON.stringify(poll)}`);

        writeAuth(ctx, { token: poll.token, userId: poll.userId, email: poll.email, name: poll.name, site });
        track(ctx, "login", { source: "cli" });
        ctx.out(poll.email ? `Signed in as ${poll.email}` : "Signed in");
        ctx.out("Your boards stay on this machine — signing in only ties usage counts to your account.");
        return;
      }
    } catch (e) {
      ctx.err(`board: ${e instanceof UserError ? e.message : (e as Error).message}`);
      process.exitCode = 1;
    }
  })();
}

export function logout(ctx: Ctx, { opts }: Args) {
  const had = clearAuth(ctx);
  emit(ctx, opts, { signedOut: had }, had ? "Signed out" : "You weren't signed in");
}

/** `board telemetry off | on | status` */
export function telemetry(ctx: Ctx, { pos, opts }: Args) {
  const arg = (pos[0] ?? "status").toLowerCase();
  if (!["on", "off", "status"].includes(arg)) throw new UserError("use `board telemetry off`, `on` or `status`");
  const settings = readSettings(ctx);
  if (arg !== "status") {
    settings.telemetry = arg === "on";
    settings.toldAboutTelemetry = true;
    writeSettings(ctx, settings);
  }
  const auth = readAuth(ctx);
  emit(ctx, opts, { telemetry: settings.telemetry, signedIn: !!auth, installId: settings.installId }, [
    settings.telemetry
      ? "Telemetry on — action names and counts only, never titles, notes or paths."
      : "Telemetry off — nothing is sent.",
    auth ? `Signed in as ${auth.email ?? auth.userId}` : "Not signed in (events would be anonymous).",
  ]);
}
