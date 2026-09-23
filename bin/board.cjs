#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// cli/src/cli.ts
var import_node_path6 = __toESM(require("node:path"), 1);
var import_node_util = require("node:util");

// cli/src/commands.ts
var import_node_fs4 = __toESM(require("node:fs"), 1);
var import_node_path5 = __toESM(require("node:path"), 1);

// cli/src/context.ts
var import_node_os = __toESM(require("node:os"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var UserError = class extends Error {
};
var homeDir = (ctx) => ctx.env.LOOSE_ENDS_HOME || import_node_path.default.join(import_node_os.default.homedir(), ".loose-ends");
var nowIso = (ctx) => {
  const pinned = ctx.env.LOOSE_ENDS_NOW;
  return (pinned ? new Date(pinned) : /* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
};
function actor(ctx, flag2) {
  const v = flag2 ?? ctx.env.LOOSE_ENDS_BY ?? (ctx.env.CLAUDECODE ? "claude" : "user");
  if (v !== "claude" && v !== "user") throw new UserError(`--by must be claude or user (got "${v}")`);
  return v;
}

// cli/src/features.ts
var STATUS_ORDER = ["active", "parked", "review", "idea", "done"];
var NOTE_LABEL = { active: "Next", parked: "Stopped", review: "Check" };
function findFeature(board, input) {
  const want = /^\d+$/.test(input) ? `${board.project.key}-${input}` : input.toUpperCase();
  const f = board.features.find((x) => x.key === want);
  if (!f) throw new UserError(`no card ${want}`);
  return f;
}
function stamp(ctx, f, by, logText) {
  const at = nowIso(ctx);
  f.updatedAt = at;
  f.updatedBy = by;
  if (logText) f.log.push({ at, by, text: logText });
}
function statusLog(to, note) {
  const base = { idea: "Moved to ideas", active: "Started", parked: "Parked", review: "Moved to review", done: "Done" }[to];
  return note && to !== "idea" && to !== "done" ? `${base} \u2014 ${note}` : base;
}
function setStatus(ctx, f, to, by, note) {
  if (note !== void 0) f.note = note;
  if (to === "parked" && !f.note.trim())
    throw new UserError(`parking needs a note saying where you stopped (--note "...")`);
  if (f.status === to && note === void 0) return;
  f.status = to;
  stamp(ctx, f, by, statusLog(to, note ?? ""));
}
function progress(f) {
  return { done: f.steps.filter((s2) => s2.done).length, total: f.steps.length };
}
function sortFeatures(fs5) {
  return [...fs5].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt)
  );
}
function activeFeature(board) {
  return sortFeatures(board.features.filter((f) => f.status === "active"))[0];
}
function ageDays(ctx, iso) {
  return Math.floor((Date.parse(nowIso(ctx)) - Date.parse(iso)) / 864e5);
}
var clip = (s2, n) => s2.length > n ? s2.slice(0, n - 1) + "\u2026" : s2;
function formatLine(f, keyWidth = 0) {
  const { done: done2, total } = progress(f);
  const parts = [f.key.padEnd(keyWidth), f.status.padEnd(6), f.title];
  if (f.type !== "feature") parts.push(`[${f.type}]`);
  if (total) parts.push(`(${done2}/${total})`);
  const label = NOTE_LABEL[f.status];
  if (label && f.note) parts.push(`\u2014 ${label}: ${clip(f.note, 70)}`);
  return parts.join("  ").replace(/ {2}\[/, " [");
}
function formatDetail(ctx, f) {
  const { done: done2, total } = progress(f);
  const lines = [`${f.key}  ${f.title}`, `${f.status} \xB7 ${f.type} \xB7 updated ${ageLabel(ctx, f.updatedAt)} by ${f.updatedBy}`];
  const label = NOTE_LABEL[f.status] ?? "Note";
  if (f.note) lines.push(`${label}: ${f.note}`);
  if (f.doneWhen.length) lines.push("Done when:", ...f.doneWhen.map((d) => `  - ${d}`));
  if (total) lines.push(`Steps (${done2}/${total}):`, ...f.steps.map((s2, i) => `  ${i + 1}. [${s2.done ? "x" : " "}] ${s2.text}`));
  if (f.files.length) lines.push("Files:", ...f.files.map((x) => `  ${x}`));
  if (f.log.length) lines.push("Log:", ...f.log.slice(-5).map((e) => `  ${e.at.slice(0, 16).replace("T", " ")} ${e.by}: ${e.text}`));
  return lines.join("\n");
}
function ageLabel(ctx, iso) {
  const mins = Math.floor((Date.parse(nowIso(ctx)) - Date.parse(iso)) / 6e4);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

// cli/src/fsutil.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);
function writeFileAtomic(file, data) {
  import_node_fs.default.mkdirSync(import_node_path2.default.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  import_node_fs.default.writeFileSync(tmp, data);
  import_node_fs.default.renameSync(tmp, file);
}
function writeJsonAtomic(file, value) {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + "\n");
}
var sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function withLock(lockPath, fn, { timeoutMs = 3e3, staleMs = 1e4 } = {}) {
  const start = Date.now();
  import_node_fs.default.mkdirSync(import_node_path2.default.dirname(lockPath), { recursive: true });
  for (; ; ) {
    try {
      import_node_fs.default.mkdirSync(lockPath);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try {
        if (Date.now() - import_node_fs.default.statSync(lockPath).mtimeMs > staleMs) {
          import_node_fs.default.rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() - start > timeoutMs) throw new Error(`board is locked (${lockPath}); try again`);
      sleep(25);
    }
  }
  try {
    return fn();
  } finally {
    import_node_fs.default.rmSync(lockPath, { recursive: true, force: true });
  }
}

// cli/src/registry.ts
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
var registryFile = (ctx) => import_node_path3.default.join(homeDir(ctx), "projects.json");
function readRegistry(ctx) {
  const file = registryFile(ctx);
  if (!import_node_fs2.default.existsSync(file)) return [];
  try {
    const data = JSON.parse(import_node_fs2.default.readFileSync(file, "utf8"));
    if (!Array.isArray(data)) return [];
    return data.filter(
      (e) => e && typeof e.path === "string" && typeof e.name === "string" && typeof e.key === "string"
    );
  } catch {
    return [];
  }
}
function registerProject(ctx, entry) {
  const file = registryFile(ctx);
  return withLock(file + ".lock", () => {
    const list2 = readRegistry(ctx);
    const existing = list2.find((e) => e.path === entry.path);
    if (existing) {
      existing.name = entry.name;
      existing.key = entry.key;
    } else {
      list2.push({ ...entry, addedAt: nowIso(ctx) });
    }
    writeJsonAtomic(file, list2);
    return !existing;
  });
}

// cli/src/schema.ts
var SCHEMA_VERSION = 1;
var STATUSES = ["idea", "active", "parked", "review", "done"];
var TYPES = ["feature", "bug", "chore"];
var ACTORS = ["claude", "user"];
var GRANULARITIES = ["coarse", "normal", "fine"];
var KEY_RE = /^[A-Z][A-Z0-9]{1,5}$/;
var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isStr = (v) => typeof v === "string";
var oneOf = (list2, v) => isStr(v) && list2.includes(v);
function validateBoard(b) {
  const errs = [];
  const err = (path7, msg) => errs.push(`${path7}: ${msg}`);
  if (!isObj(b)) return ["board: must be an object"];
  if (b.schemaVersion !== SCHEMA_VERSION) err("schemaVersion", `must be ${SCHEMA_VERSION}`);
  if (!isObj(b.project)) err("project", "must be an object");
  else {
    if (!isStr(b.project.name) || !b.project.name.trim()) err("project.name", "must be a non-empty string");
    if (!isStr(b.project.key) || !KEY_RE.test(b.project.key))
      err("project.key", "must be 2\u20136 uppercase letters/digits, starting with a letter");
  }
  if (!isObj(b.settings)) err("settings", "must be an object");
  else if (!oneOf(GRANULARITIES, b.settings.granularity))
    err("settings.granularity", `must be one of ${GRANULARITIES.join(", ")}`);
  if (!Number.isInteger(b.nextNum) || b.nextNum < 1) err("nextNum", "must be a positive integer");
  if (!Array.isArray(b.features)) {
    err("features", "must be an array");
    return errs;
  }
  const projectKey = isObj(b.project) && isStr(b.project.key) ? b.project.key : null;
  const seen = /* @__PURE__ */ new Set();
  b.features.forEach((f, i) => {
    const p = `features[${i}]`;
    if (!isObj(f)) return err(p, "must be an object");
    const m = isStr(f.key) ? /^([A-Z][A-Z0-9]*)-(\d+)$/.exec(f.key) : null;
    if (!m) err(`${p}.key`, "must look like KEY-123");
    else {
      if (projectKey && m[1] !== projectKey) err(`${p}.key`, `prefix must be ${projectKey}`);
      if (Number.isInteger(b.nextNum) && Number(m[2]) >= b.nextNum)
        err(`${p}.key`, "number must be below nextNum");
      if (seen.has(f.key)) err(`${p}.key`, `duplicate key ${f.key}`);
      seen.add(f.key);
    }
    if (!isStr(f.title) || !f.title.trim()) err(`${p}.title`, "must be a non-empty string");
    if (!oneOf(TYPES, f.type)) err(`${p}.type`, `must be one of ${TYPES.join(", ")}`);
    if (!oneOf(STATUSES, f.status)) err(`${p}.status`, `must be one of ${STATUSES.join(", ")}`);
    if (!isStr(f.note)) err(`${p}.note`, "must be a string");
    if (!Array.isArray(f.doneWhen) || !f.doneWhen.every(isStr)) err(`${p}.doneWhen`, "must be an array of strings");
    if (!Array.isArray(f.files) || !f.files.every(isStr)) err(`${p}.files`, "must be an array of strings");
    if (!Array.isArray(f.steps)) err(`${p}.steps`, "must be an array");
    else
      f.steps.forEach((s2, j) => {
        if (!isObj(s2) || !isStr(s2.text) || typeof s2.done !== "boolean")
          err(`${p}.steps[${j}]`, "must be { text: string, done: boolean }");
      });
    for (const k of ["createdAt", "updatedAt"])
      if (!isStr(f[k]) || !ISO_RE.test(f[k])) err(`${p}.${k}`, "must be an ISO-8601 UTC timestamp");
    if (!oneOf(ACTORS, f.updatedBy)) err(`${p}.updatedBy`, `must be one of ${ACTORS.join(", ")}`);
    if (!Array.isArray(f.log)) err(`${p}.log`, "must be an array");
    else
      f.log.forEach((e, j) => {
        if (!isObj(e) || !isStr(e.at) || !ISO_RE.test(e.at) || !oneOf(ACTORS, e.by) || !isStr(e.text))
          err(`${p}.log[${j}]`, "must be { at: ISO timestamp, by: claude|user, text: string }");
      });
  });
  return errs;
}
function emptyBoard(name, key) {
  return {
    schemaVersion: SCHEMA_VERSION,
    project: { name, key },
    settings: { granularity: "normal" },
    nextNum: 1,
    features: []
  };
}

// cli/src/store.ts
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_path4 = __toESM(require("node:path"), 1);

// cli/src/migrations.ts
var MIGRATIONS = {
  // v1 is the first released schema; nothing to migrate yet.
};
var MigrationError = class extends Error {
};
function migrate(raw, migrations = MIGRATIONS, target = SCHEMA_VERSION) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new MigrationError("board.json is not a JSON object");
  let board = raw;
  const from = board.schemaVersion;
  if (!Number.isInteger(from) || from < 1)
    throw new MigrationError("board.json has no valid schemaVersion");
  if (from > target)
    throw new MigrationError(
      `board.json is schemaVersion ${from}, but this CLI only knows up to ${target}. Update the Loose Ends plugin.`
    );
  let v = from;
  while (v < target) {
    const step2 = migrations[v];
    if (!step2) throw new MigrationError(`no migration from schemaVersion ${v} to ${v + 1}`);
    board = { ...step2(structuredClone(board)), schemaVersion: v + 1 };
    v++;
  }
  return { board, from, to: v, migrated: v !== from };
}

// cli/src/store.ts
var BOARD_DIR = ".board";
var BOARD_FILE = "board.json";
var boardFileFor = (root) => import_node_path4.default.join(root, BOARD_DIR, BOARD_FILE);
function findBoard(start) {
  let dir = import_node_path4.default.resolve(start);
  for (; ; ) {
    const file = boardFileFor(dir);
    if (import_node_fs3.default.existsSync(file)) return { root: dir, file };
    const parent = import_node_path4.default.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function requireBoard(ctx) {
  const loc = findBoard(ctx.cwd);
  if (!loc) throw new UserError("no board here. Run `board init` in your project folder.");
  return loc;
}
function readBoard(file) {
  let raw;
  try {
    raw = JSON.parse(import_node_fs3.default.readFileSync(file, "utf8"));
  } catch (e) {
    throw new UserError(`can't read ${file}: ${e.message}`);
  }
  let res;
  try {
    res = migrate(raw);
  } catch (e) {
    if (e instanceof MigrationError) throw new UserError(e.message);
    throw e;
  }
  const errs = validateBoard(res.board);
  if (errs.length) throw new UserError(`${file} is invalid:
  ${errs.slice(0, 10).join("\n  ")}`);
  if (res.migrated) {
    import_node_fs3.default.copyFileSync(file, `${file}.v${res.from}.bak`);
    writeJsonAtomic(file, res.board);
  }
  return res.board;
}
function writeBoard(file, board) {
  const errs = validateBoard(board);
  if (errs.length) throw new Error(`refusing to write an invalid board:
  ${errs.join("\n  ")}`);
  writeJsonAtomic(file, board);
}
function mutateBoard(loc, fn) {
  return withLock(loc.file + ".lock", () => {
    const board = readBoard(loc.file);
    const result = fn(board);
    writeBoard(loc.file, board);
    return result;
  });
}

// cli/src/commands.ts
var str = (o, k) => typeof o[k] === "string" ? o[k] : void 0;
var list = (o, k) => Array.isArray(o[k]) ? o[k] : [];
function emit(ctx, opts, json, text) {
  if (opts.json) ctx.out(JSON.stringify(json, null, 2));
  else for (const l of [text].flat()) ctx.out(l);
}
function need(pos, i, what) {
  const v = pos[i];
  if (v === void 0 || v === "") throw new UserError(`missing ${what}`);
  return v;
}
function parseStatus(v) {
  if (v === void 0) return void 0;
  if (!STATUSES.includes(v)) throw new UserError(`status must be one of ${STATUSES.join(", ")}`);
  return v;
}
function parseType(v) {
  if (v === void 0) return void 0;
  if (!TYPES.includes(v)) throw new UserError(`type must be one of ${TYPES.join(", ")}`);
  return v;
}
function prettyName(dir) {
  return import_node_path5.default.basename(dir).replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "Project";
}
function deriveKey(name) {
  const words = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const first = (words[0] ?? "").replace(/^[0-9]+/, "");
  let key = first.length >= 2 ? first.slice(0, 4) : words.map((w) => w[0]).join("").slice(0, 4);
  if (!/^[A-Z]/.test(key)) key = "P" + key;
  return (key + "XX").slice(0, Math.max(2, Math.min(key.length, 4)));
}
function init(ctx, { opts }) {
  const root = import_node_path5.default.resolve(ctx.cwd);
  const file = boardFileFor(root);
  let board;
  let created = false;
  if (import_node_fs4.default.existsSync(file)) {
    board = readBoard(file);
    if (opts.name || opts.key) throw new UserError(`board already exists in ${BOARD_DIR}/ \u2014 rename with the UI or edit settings later`);
  } else {
    const name = str(opts, "name")?.trim() || prettyName(root);
    const key = (str(opts, "key") ?? deriveKey(name)).toUpperCase();
    if (!KEY_RE.test(key)) throw new UserError("--key must be 2\u20136 letters/digits, starting with a letter (e.g. LOOP)");
    board = emptyBoard(name, key);
    writeBoard(file, board);
    writeFileAtomic(import_node_path5.default.join(root, BOARD_DIR, ".gitignore"), "*.lock\n*.tmp\n*.bak\n");
    created = true;
  }
  const isNew = registerProject(ctx, { path: root, name: board.project.name, key: board.project.key });
  emit(ctx, opts, { created, registered: isNew, project: board.project, file, registry: registryFile(ctx) }, [
    created ? `Created board ${board.project.name} (${board.project.key}) in ${BOARD_DIR}/board.json` : `Board ${board.project.name} (${board.project.key}) already exists`,
    isNew ? `Registered in ${registryFile(ctx)}` : `Already registered`
  ]);
}
function listCmd(ctx, { opts }) {
  const board = readBoard(requireBoard(ctx).file);
  const statuses = str(opts, "status")?.split(",").map((s2) => parseStatus(s2.trim()));
  const type = parseType(str(opts, "type"));
  let fs5 = board.features;
  if (statuses) fs5 = fs5.filter((f) => statuses.includes(f.status));
  else if (!opts.all) fs5 = fs5.filter((f) => f.status !== "done");
  if (type) fs5 = fs5.filter((f) => f.type === type);
  fs5 = sortFeatures(fs5);
  const w = Math.max(0, ...fs5.map((f) => f.key.length));
  const hidden = !statuses && !opts.all ? board.features.filter((f) => f.status === "done").length : 0;
  const lines = fs5.length ? fs5.map((f) => formatLine(f, w)) : ["No cards."];
  if (hidden) lines.push(`(+${hidden} done \u2014 use --all)`);
  emit(ctx, opts, fs5, lines);
}
function show(ctx, { pos, opts }) {
  const board = readBoard(requireBoard(ctx).file);
  const f = findFeature(board, need(pos, 0, "card key (e.g. LOOP-3)"));
  emit(ctx, opts, f, formatDetail(ctx, f));
}
function context(ctx, { opts }) {
  const loc = findBoard(ctx.cwd);
  if (!loc) {
    return emit(ctx, opts, { board: null }, "Loose Ends: no board in this project yet. Offer to create one with `board init`.");
  }
  const b = readBoard(loc.file);
  const by = (s2) => sortFeatures(b.features.filter((f) => f.status === s2));
  const counts = Object.fromEntries(STATUSES.map((s2) => [s2, b.features.filter((f) => f.status === s2).length]));
  if (opts.json)
    return ctx.out(
      JSON.stringify(
        { project: b.project, root: loc.root, counts, active: by("active"), parked: by("parked"), review: by("review"), ideas: by("idea") },
        null,
        2
      )
    );
  const summary = STATUSES.filter((s2) => counts[s2]).map((s2) => `${counts[s2]} ${s2}`).join(", ") || "empty";
  const lines = [`Loose Ends board: ${b.project.name} (${b.project.key}) \u2014 ${summary}`];
  const section = (title, fs5, extra) => {
    if (!fs5.length) return;
    lines.push(`${title}:`);
    for (const f of fs5) {
      const { done: done2, total } = progress(f);
      const bits = [`  ${f.key} ${f.title}`];
      if (total) bits.push(`(${done2}/${total})`);
      const e = extra(f);
      if (e) bits.push(`\u2014 ${e}`);
      lines.push(bits.join(" "));
    }
  };
  section("Active", by("active"), (f) => f.note ? `next: ${f.note}` : "");
  section("Parked", by("parked"), (f) => `stopped: ${f.note} (idle ${ageDays(ctx, f.updatedAt)}d)`);
  section("Review", by("review"), (f) => {
    const d = ageDays(ctx, f.updatedAt);
    return [f.note && `check: ${f.note}`, d >= 2 && `in review ${d}d \u2014 ask if it's done`].filter(Boolean).join("; ");
  });
  const ideas = by("idea");
  if (ideas.length) {
    const shown = ideas.slice(0, 10).map((f) => `${f.key} ${f.title}`);
    lines.push(`Ideas: ${shown.join(" \xB7 ")}${ideas.length > 10 ? ` \xB7 +${ideas.length - 10} more` : ""}`);
  }
  ctx.out(lines.join("\n"));
}
function add(ctx, { pos, opts }) {
  const title = need(pos, 0, `title (e.g. board add "Export loop as WAV")`).trim();
  if (!title) throw new UserError("title can't be empty");
  const status = parseStatus(str(opts, "status")) ?? "idea";
  const type = parseType(str(opts, "type")) ?? "feature";
  const note = str(opts, "note") ?? str(opts, "next") ?? "";
  const by = actor(ctx, str(opts, "by"));
  const loc = requireBoard(ctx);
  const f = mutateBoard(loc, (b) => {
    const at = nowIso(ctx);
    const f2 = {
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
      log: [{ at, by, text: status === "idea" ? "Created" : `Created \u2014 ${status}` }]
    };
    if (status === "parked" && !note.trim()) throw new UserError(`parking needs a note saying where you stopped (--note "...")`);
    b.nextNum++;
    b.features.push(f2);
    return f2;
  });
  emit(ctx, opts, f, `Added ${f.key} ${f.title} (${f.status})`);
}
function update(ctx, { pos, opts }) {
  const keyArg = need(pos, 0, "card key");
  const by = actor(ctx, str(opts, "by"));
  const status = parseStatus(str(opts, "status"));
  const type = parseType(str(opts, "type"));
  const title = str(opts, "title")?.trim();
  const note = str(opts, "note") ?? str(opts, "next");
  const doneWhen = list(opts, "done-when");
  if (title === "") throw new UserError("title can't be empty");
  if (!status && !type && title === void 0 && note === void 0 && !doneWhen.length)
    throw new UserError("nothing to update (use --title, --note, --status, --type or --done-when)");
  const f = mutateBoard(requireBoard(ctx), (b) => {
    const f2 = findFeature(b, keyArg);
    const logs = [];
    if (title !== void 0 && title !== f2.title) {
      logs.push(`Renamed from \u201C${f2.title}\u201D`);
      f2.title = title;
    }
    if (type && type !== f2.type) {
      logs.push(`Type \u2192 ${type}`);
      f2.type = type;
    }
    if (doneWhen.length) {
      f2.doneWhen = doneWhen;
      logs.push("Updated done-when");
    }
    if (status && status !== f2.status) {
      setStatus(ctx, f2, status, by, note);
    } else {
      if (note !== void 0 && note !== f2.note) {
        f2.note = note;
        logs.push(note ? `Note: ${note}` : "Cleared note");
      }
      if (f2.status === "parked" && !f2.note.trim()) throw new UserError("a parked card needs a note");
    }
    for (const l of logs) stamp(ctx, f2, by, l);
    if (!logs.length) stamp(ctx, f2, by);
    return f2;
  });
  emit(ctx, opts, f, `Updated ${formatLine(f)}`);
}
function statusCommand(to) {
  return (ctx, { pos, opts }) => {
    const keyArg = need(pos, 0, "card key");
    const by = actor(ctx, str(opts, "by"));
    const note = str(opts, "note");
    const f = mutateBoard(requireBoard(ctx), (b) => {
      const f2 = findFeature(b, keyArg);
      setStatus(ctx, f2, to, by, note);
      return f2;
    });
    emit(ctx, opts, f, `${f.key} ${f.title} \u2192 ${f.status}`);
  };
}
var park = statusCommand("parked");
var review = statusCommand("review");
var done = statusCommand("done");
function step(ctx, { pos, opts }) {
  const keyArg = need(pos, 0, "card key");
  const text = need(pos, 1, `step text or number (e.g. board step LOOP-3 "Render buffer")`).trim();
  const by = actor(ctx, str(opts, "by"));
  if (opts.done && opts.undone) throw new UserError("use --done or --undone, not both");
  const { f, msg } = mutateBoard(requireBoard(ctx), (b) => {
    const f2 = findFeature(b, keyArg);
    const idx = /^\d+$/.test(text) ? Number(text) - 1 : f2.steps.findIndex((s2) => s2.text.toLowerCase() === text.toLowerCase());
    const existing = f2.steps[idx];
    if (/^\d+$/.test(text) && !existing) throw new UserError(`${f2.key} has no step ${text}`);
    let msg2;
    if (opts.remove) {
      if (!existing) throw new UserError(`${f2.key} has no step \u201C${text}\u201D`);
      f2.steps.splice(idx, 1);
      msg2 = `Step removed: ${existing.text}`;
    } else if (existing) {
      const want = opts.undone ? false : opts.done ? true : existing.done;
      if (want === existing.done) return { f: f2, msg: `Step already ${want ? "done" : "open"}: ${existing.text}` };
      existing.done = want;
      msg2 = `Step ${want ? "done" : "reopened"}: ${existing.text}`;
    } else {
      f2.steps.push({ text, done: !!opts.done });
      msg2 = `Step added${opts.done ? " (done)" : ""}: ${text}`;
    }
    stamp(ctx, f2, by, msg2);
    return { f: f2, msg: msg2 };
  });
  const { done: d, total } = progress(f);
  emit(ctx, opts, f, `${f.key} ${msg} (${d}/${total})`);
}
function merge(ctx, { pos, opts }) {
  const fromArg = need(pos, 0, "card to merge (board merge LOOP-15 --into LOOP-3)");
  const intoArg = str(opts, "into");
  if (!intoArg) throw new UserError("missing --into <card>");
  const by = actor(ctx, str(opts, "by"));
  const { from, into } = mutateBoard(requireBoard(ctx), (b) => {
    const from2 = findFeature(b, fromArg);
    const into2 = findFeature(b, intoArg);
    if (from2 === into2) throw new UserError("can't merge a card into itself");
    const known = new Set(into2.steps.map((s2) => s2.text.toLowerCase()));
    for (const s2 of from2.steps) if (!known.has(s2.text.toLowerCase())) into2.steps.push(s2);
    into2.files = [.../* @__PURE__ */ new Set([...into2.files, ...from2.files])];
    into2.doneWhen = [.../* @__PURE__ */ new Set([...into2.doneWhen, ...from2.doneWhen])];
    if (!into2.note && from2.note) into2.note = from2.note;
    into2.log = [...into2.log, ...from2.log].sort((x, y) => x.at.localeCompare(y.at));
    if (Date.parse(from2.createdAt) < Date.parse(into2.createdAt)) into2.createdAt = from2.createdAt;
    stamp(ctx, into2, by, `Merged in ${from2.key} \u201C${from2.title}\u201D`);
    b.features = b.features.filter((f) => f !== from2);
    return { from: from2, into: into2 };
  });
  emit(ctx, opts, into, `Merged ${from.key} into ${into.key} ${into.title}`);
}
function touch(ctx, { pos, opts }) {
  if (!pos.length) throw new UserError("missing file(s)");
  const loc = findBoard(ctx.cwd);
  const nothing = (why) => opts.json ? ctx.out(JSON.stringify({ card: null, added: [], reason: why })) : void 0;
  if (!loc) return nothing("no board");
  const rels = pos.map((p) => import_node_path5.default.relative(loc.root, import_node_path5.default.resolve(ctx.cwd, p))).filter((r) => r && !r.startsWith("..") && !import_node_path5.default.isAbsolute(r)).map((r) => r.split(import_node_path5.default.sep).join("/")).filter((r) => r !== BOARD_DIR && !r.startsWith(BOARD_DIR + "/"));
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

// cli/src/cli.ts
var GLOBAL = {
  json: { type: "boolean" },
  by: { type: "string" },
  dir: { type: "string", short: "C" },
  help: { type: "boolean", short: "h" }
};
var s = { type: "string" };
var many = { type: "string", multiple: true };
var flag = { type: "boolean" };
var COMMANDS = {
  init: { usage: `init [--name "Looper"] [--key LOOP]`, options: { name: s, key: s }, run: init },
  list: { usage: "list [--status parked[,review]] [--type bug] [--all]", options: { status: s, type: s, all: flag }, run: listCmd },
  show: { usage: "show LOOP-3", options: {}, run: show },
  add: {
    usage: `add "Title" [--status active] [--type bug] [--next "..."] [--step "..."]... [--done-when "..."]...`,
    options: { status: s, type: s, next: s, note: s, step: many, "done-when": many },
    run: add
  },
  update: {
    usage: "update LOOP-3 [--title ...] [--note ...] [--status ...] [--type ...] [--done-when ...]...",
    options: { title: s, note: s, next: s, status: s, type: s, "done-when": many },
    run: update
  },
  step: { usage: `step LOOP-3 "Render buffer"|2 [--done|--undone|--remove]`, options: { done: flag, undone: flag, remove: flag }, run: step },
  park: { usage: `park LOOP-3 --note "Where we stopped"`, options: { note: s }, run: park },
  review: { usage: `review LOOP-3 [--note "What to check"]`, options: { note: s }, run: review },
  done: { usage: "done LOOP-3", options: {}, run: done },
  merge: { usage: "merge LOOP-15 --into LOOP-3", options: { into: s }, run: merge },
  touch: { usage: "touch <file>...", options: {}, run: touch },
  context: { usage: "context", options: {}, run: context }
};
var LATER = { ui: "phase 3", login: "phase 5", logout: "phase 5", telemetry: "phase 5" };
function helpText() {
  return [
    "board \u2014 the Loose Ends feature board",
    "",
    "Usage:",
    ...Object.values(COMMANDS).map((c) => `  board ${c.usage}`),
    "",
    "Global: --json (machine output)  --by claude|user  -C, --dir <path>",
    "Cards can be referred to as LOOP-3 or just 3."
  ].join("\n");
}
function run(argv, ctx) {
  const [name, ...rest] = argv;
  if (!name || name === "help" || name === "--help" || name === "-h") {
    ctx.out(helpText());
    return 0;
  }
  if (name === "--version" || name === "-v") {
    ctx.out("0.1.0");
    return 0;
  }
  if (LATER[name]) {
    ctx.err(`board ${name} isn't built yet (coming in ${LATER[name]}).`);
    return 1;
  }
  const command = COMMANDS[name];
  if (!command) {
    ctx.err(`board: unknown command "${name}". Run \`board help\`.`);
    return 1;
  }
  try {
    let parsed;
    try {
      parsed = (0, import_node_util.parseArgs)({ args: rest, options: { ...GLOBAL, ...command.options }, allowPositionals: true, strict: true });
    } catch (e) {
      throw new UserError(`${e.message.split("\n")[0]}
usage: board ${command.usage}`);
    }
    const opts = parsed.values;
    if (opts.help) {
      ctx.out(`usage: board ${command.usage}`);
      return 0;
    }
    const dir = typeof opts.dir === "string" ? import_node_path6.default.resolve(ctx.cwd, opts.dir) : ctx.cwd;
    command.run({ ...ctx, cwd: dir }, { pos: parsed.positionals, opts });
    return 0;
  } catch (e) {
    if (e instanceof UserError) ctx.err(`board: ${e.message}`);
    else ctx.err(`board: unexpected error: ${e.stack ?? e}`);
    return 1;
  }
}

// cli/src/index.ts
process.exitCode = run(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  out: (l) => process.stdout.write(l + "\n"),
  err: (l) => process.stderr.write(l + "\n")
});
