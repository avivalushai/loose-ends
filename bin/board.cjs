#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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

// cli/src/context.ts
function actor(ctx, flag2) {
  const v = flag2 ?? ctx.env.LOOSE_ENDS_BY ?? (ctx.env.CLAUDECODE ? "claude" : "user");
  if (v !== "claude" && v !== "user") throw new UserError(`--by must be claude or user (got "${v}")`);
  return v;
}
var import_node_os, import_node_path, UserError, homeDir, nowIso;
var init_context = __esm({
  "cli/src/context.ts"() {
    "use strict";
    import_node_os = __toESM(require("node:os"), 1);
    import_node_path = __toESM(require("node:path"), 1);
    UserError = class extends Error {
    };
    homeDir = (ctx) => ctx.env.LOOSE_ENDS_HOME || import_node_path.default.join(import_node_os.default.homedir(), ".loose-ends");
    nowIso = (ctx) => {
      const pinned = ctx.env.LOOSE_ENDS_NOW;
      return (pinned ? new Date(pinned) : /* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
    };
  }
});

// cli/src/fsutil.ts
function writeFileAtomic(file, data) {
  import_node_fs.default.mkdirSync(import_node_path2.default.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  import_node_fs.default.writeFileSync(tmp, data);
  import_node_fs.default.renameSync(tmp, file);
}
function writeJsonAtomic(file, value) {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + "\n");
}
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
var import_node_fs, import_node_path2, sleep;
var init_fsutil = __esm({
  "cli/src/fsutil.ts"() {
    "use strict";
    import_node_fs = __toESM(require("node:fs"), 1);
    import_node_path2 = __toESM(require("node:path"), 1);
    sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  }
});

// cli/src/account.ts
function readJson(file) {
  try {
    const v = JSON.parse(import_node_fs2.default.readFileSync(file, "utf8"));
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function readSettings(ctx) {
  const raw = readJson(settingsFile(ctx));
  const settings = {
    installId: typeof raw.installId === "string" && raw.installId ? raw.installId : import_node_crypto.default.randomUUID(),
    telemetry: raw.telemetry !== false,
    ...raw.toldAboutTelemetry ? { toldAboutTelemetry: true } : {}
  };
  if (raw.installId !== settings.installId) writeSettings(ctx, settings);
  return settings;
}
function writeSettings(ctx, settings) {
  writeJsonAtomic(settingsFile(ctx), settings);
}
function writeAuth(ctx, auth) {
  writeJsonAtomic(authFile(ctx), { ...auth, savedAt: nowIso(ctx) });
  try {
    import_node_fs2.default.chmodSync(authFile(ctx), 384);
  } catch {
  }
}
function clearAuth(ctx) {
  try {
    import_node_fs2.default.rmSync(authFile(ctx));
    return true;
  } catch {
    return false;
  }
}
var import_node_crypto, import_node_fs2, import_node_path3, SITE_URL, siteUrl, settingsFile, authFile, readAuth;
var init_account = __esm({
  "cli/src/account.ts"() {
    "use strict";
    import_node_crypto = __toESM(require("node:crypto"), 1);
    import_node_fs2 = __toESM(require("node:fs"), 1);
    import_node_path3 = __toESM(require("node:path"), 1);
    init_context();
    init_fsutil();
    SITE_URL = "https://looseends.dev";
    siteUrl = (ctx) => (ctx.env.LOOSE_ENDS_SITE || SITE_URL).replace(/\/$/, "");
    settingsFile = (ctx) => import_node_path3.default.join(homeDir(ctx), "settings.json");
    authFile = (ctx) => import_node_path3.default.join(homeDir(ctx), "auth.json");
    readAuth = (ctx) => {
      const a = readJson(authFile(ctx));
      return a.token && a.userId ? a : null;
    };
  }
});

// cli/src/analytics.ts
function safeProps(props = {}) {
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED.has(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string" && v.length <= MAX_LEN && /^[a-z0-9_-]+$/i.test(v)) out[k] = v;
  }
  return out;
}
function track(ctx, event, props = {}) {
  try {
    const settings = readSettings(ctx);
    if (!settings.telemetry) return;
    const key = ctx.env.LOOSE_ENDS_POSTHOG_KEY;
    if (!key) return;
    const auth = readAuth(ctx);
    const body = JSON.stringify({
      api_key: key,
      event,
      distinct_id: auth?.userId ?? settings.installId,
      properties: { ...safeProps(props), $lib: "loose-ends-cli" },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2e3);
    void fetch(ctx.env.LOOSE_ENDS_ANALYTICS_URL || HOST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal
    }).catch(() => {
    }).finally(() => clearTimeout(timer));
  } catch {
  }
}
var ALLOWED, MAX_LEN, HOST;
var init_analytics = __esm({
  "cli/src/analytics.ts"() {
    "use strict";
    init_account();
    ALLOWED = /* @__PURE__ */ new Set(["view", "from", "to", "by", "type", "command", "projects", "cards", "count", "source"]);
    MAX_LEN = 24;
    HOST = "https://eu.i.posthog.com/i/v0/e/";
  }
});

// cli/src/features.ts
function findFeature(board2, input) {
  const want = /^\d+$/.test(input) ? `${board2.project.key}-${input}` : input.toUpperCase();
  const f = board2.features.find((x) => x.key === want);
  if (!f) throw new UserError(`no card ${want}`);
  return f;
}
function stamp(ctx, f, by, logText) {
  const at = nowIso(ctx);
  f.updatedAt = at;
  f.updatedBy = by;
  if (logText) f.log.push({ at, by, text: logText });
}
function statusLog(to, note3) {
  const base = { idea: "Moved to ideas", active: "Started", parked: "Parked", review: "Moved to review", done: "Done" }[to];
  return note3 && to !== "idea" && to !== "done" ? `${base} \u2014 ${note3}` : base;
}
function setStatus(ctx, f, to, by, note3) {
  if (note3 !== void 0) f.note = note3;
  if (to === "parked" && !f.note.trim())
    throw new UserError(`parking needs a note saying where you stopped (--note "...")`);
  if (f.status === to && note3 === void 0) return;
  f.status = to;
  stamp(ctx, f, by, statusLog(to, note3 ?? ""));
}
function progress(f) {
  return { done: f.steps.filter((s2) => s2.done).length, total: f.steps.length };
}
function sortFeatures(fs10) {
  return [...fs10].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt)
  );
}
function activeFeature(board2) {
  return sortFeatures(board2.features.filter((f) => f.status === "active"))[0];
}
function fileFits(f, file) {
  if (!f.files.length) return true;
  const areas = new Set(f.files.map(area));
  return areas.has(area(file));
}
function ageDays(ctx, iso) {
  return Math.floor((Date.parse(nowIso(ctx)) - Date.parse(iso)) / 864e5);
}
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
var STATUS_ORDER, NOTE_LABEL, area, clip;
var init_features = __esm({
  "cli/src/features.ts"() {
    "use strict";
    init_context();
    STATUS_ORDER = ["active", "parked", "review", "idea", "done"];
    NOTE_LABEL = { active: "Next", parked: "Stopped", review: "Check" };
    area = (file) => file.split("/").slice(0, 2).join("/");
    clip = (s2, n) => s2.length > n ? s2.slice(0, n - 1) + "\u2026" : s2;
  }
});

// cli/src/registry.ts
function readRegistry(ctx) {
  const file = registryFile(ctx);
  if (!import_node_fs3.default.existsSync(file)) return [];
  try {
    const data = JSON.parse(import_node_fs3.default.readFileSync(file, "utf8"));
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
var import_node_fs3, import_node_path4, registryFile;
var init_registry = __esm({
  "cli/src/registry.ts"() {
    "use strict";
    import_node_fs3 = __toESM(require("node:fs"), 1);
    import_node_path4 = __toESM(require("node:path"), 1);
    init_context();
    init_fsutil();
    registryFile = (ctx) => import_node_path4.default.join(homeDir(ctx), "projects.json");
  }
});

// cli/src/schema.ts
function validateBoard(b) {
  const errs = [];
  const err = (path11, msg) => errs.push(`${path11}: ${msg}`);
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
  for (const k of ["nextNum", "nextNoteNum"])
    if (!Number.isInteger(b[k]) || b[k] < 1) err(k, "must be a positive integer");
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
  if (!Array.isArray(b.notes)) {
    err("notes", "must be an array");
    return errs;
  }
  const seenNotes = /* @__PURE__ */ new Set();
  b.notes.forEach((n, i) => {
    const p = `notes[${i}]`;
    if (!isObj(n)) return err(p, "must be an object");
    const m = isStr(n.id) ? NOTE_ID_RE.exec(n.id) : null;
    if (!m) err(`${p}.id`, "must look like KEY-N12");
    else {
      if (projectKey && m[1] !== projectKey) err(`${p}.id`, `prefix must be ${projectKey}`);
      if (Number.isInteger(b.nextNoteNum) && Number(m[2]) >= b.nextNoteNum)
        err(`${p}.id`, "number must be below nextNoteNum");
      if (seenNotes.has(n.id)) err(`${p}.id`, `duplicate id ${n.id}`);
      seenNotes.add(n.id);
    }
    if (!oneOf(NOTE_KINDS, n.kind)) err(`${p}.kind`, `must be one of ${NOTE_KINDS.join(", ")}`);
    if (!isStr(n.title) || !n.title.trim()) err(`${p}.title`, "must be a non-empty string");
    for (const k of ["body", "url", "file"]) if (!isStr(n[k])) err(`${p}.${k}`, "must be a string");
    if (!Array.isArray(n.cards) || !n.cards.every(isStr)) err(`${p}.cards`, "must be an array of card keys");
    else for (const key of n.cards) if (!seen.has(key)) err(`${p}.cards`, `no card ${key} on this board`);
    for (const k of ["createdAt", "updatedAt"])
      if (!isStr(n[k]) || !ISO_RE.test(n[k])) err(`${p}.${k}`, "must be an ISO-8601 UTC timestamp");
    if (!oneOf(ACTORS, n.updatedBy)) err(`${p}.updatedBy`, `must be one of ${ACTORS.join(", ")}`);
  });
  return errs;
}
function emptyBoard(name, key) {
  return {
    schemaVersion: SCHEMA_VERSION,
    project: { name, key },
    settings: { granularity: "normal" },
    nextNum: 1,
    nextNoteNum: 1,
    features: [],
    notes: []
  };
}
var SCHEMA_VERSION, STATUSES, TYPES, NOTE_KINDS, ACTORS, GRANULARITIES, KEY_RE, NOTE_ID_RE, ISO_RE, isObj, isStr, oneOf;
var init_schema = __esm({
  "cli/src/schema.ts"() {
    "use strict";
    SCHEMA_VERSION = 2;
    STATUSES = ["idea", "active", "parked", "review", "done"];
    TYPES = ["feature", "bug", "chore", "question"];
    NOTE_KINDS = ["brainstorm", "plan", "reference"];
    ACTORS = ["claude", "user"];
    GRANULARITIES = ["coarse", "normal", "fine"];
    KEY_RE = /^[A-Z][A-Z0-9]{1,5}$/;
    NOTE_ID_RE = /^([A-Z][A-Z0-9]*)-N(\d+)$/;
    ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
    isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    isStr = (v) => typeof v === "string";
    oneOf = (list2, v) => isStr(v) && list2.includes(v);
  }
});

// cli/src/notes.ts
function findNote(board2, input) {
  const raw = input.trim().toUpperCase();
  const want = /^\d+$/.test(raw) ? `${board2.project.key}-N${raw}` : /^N\d+$/.test(raw) ? `${board2.project.key}-${raw}` : raw;
  const n = board2.notes.find((x) => x.id === want);
  if (!n) throw new UserError(`no note ${want}`);
  return n;
}
function stampNote(ctx, n, by) {
  n.updatedAt = nowIso(ctx);
  n.updatedBy = by;
}
function noteTarget(n) {
  return n.url || n.file || "";
}
function sortNotes(ns) {
  return [...ns].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.updatedAt.localeCompare(a.updatedAt)
  );
}
function formatNoteLine(n, idWidth = 0) {
  const parts = [n.id.padEnd(idWidth), n.kind.padEnd(10), n.title];
  const target = noteTarget(n);
  if (target) parts.push(`\u2014 ${clip2(target, 60)}`);
  else if (n.body) parts.push(`\u2014 ${clip2(oneLine(n.body), 60)}`);
  if (n.cards.length) parts.push(`\u2192 ${n.cards.join(" ")}`);
  return parts.join("  ");
}
function formatNoteDetail(ctx, n) {
  const lines = [`${n.id}  ${n.title}`, `${n.kind} \xB7 updated ${ageLabel(ctx, n.updatedAt)} by ${n.updatedBy}`];
  if (n.url) lines.push(`Link: ${n.url}`);
  if (n.file) lines.push(`File: ${n.file}`);
  if (n.cards.length) lines.push(`Cards: ${n.cards.join(", ")}`);
  if (n.body) lines.push("", n.body);
  return lines.join("\n");
}
var KIND_ORDER, clip2, oneLine;
var init_notes = __esm({
  "cli/src/notes.ts"() {
    "use strict";
    init_context();
    init_features();
    KIND_ORDER = ["brainstorm", "plan", "reference"];
    clip2 = (s2, n) => s2.length > n ? s2.slice(0, n - 1) + "\u2026" : s2;
    oneLine = (s2) => s2.replace(/\s+/g, " ").trim();
  }
});

// cli/src/migrations.ts
function migrate(raw, migrations = MIGRATIONS, target = SCHEMA_VERSION) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new MigrationError("board.json is not a JSON object");
  let board2 = raw;
  const from = board2.schemaVersion;
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
    board2 = { ...step2(structuredClone(board2)), schemaVersion: v + 1 };
    v++;
  }
  return { board: board2, from, to: v, migrated: v !== from };
}
var MIGRATIONS, MigrationError;
var init_migrations = __esm({
  "cli/src/migrations.ts"() {
    "use strict";
    init_schema();
    MIGRATIONS = {
      // v1 → v2: brainstorms, plans and references live beside the cards.
      1: (board2) => ({ ...board2, nextNoteNum: 1, notes: [] })
    };
    MigrationError = class extends Error {
    };
  }
});

// cli/src/store.ts
function findBoard(start) {
  let dir = import_node_path5.default.resolve(start);
  for (; ; ) {
    const file = boardFileFor(dir);
    if (import_node_fs4.default.existsSync(file)) return { root: dir, file };
    const parent = import_node_path5.default.dirname(dir);
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
    raw = JSON.parse(import_node_fs4.default.readFileSync(file, "utf8"));
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
    import_node_fs4.default.copyFileSync(file, `${file}.v${res.from}.bak`);
    writeJsonAtomic(file, res.board);
  }
  return res.board;
}
function writeBoard(file, board2) {
  const errs = validateBoard(board2);
  if (errs.length) throw new Error(`refusing to write an invalid board:
  ${errs.join("\n  ")}`);
  writeJsonAtomic(file, board2);
}
function mutateBoard(loc, fn) {
  return withLock(loc.file + ".lock", () => {
    const board2 = readBoard(loc.file);
    const result = fn(board2);
    writeBoard(loc.file, board2);
    return result;
  });
}
var import_node_fs4, import_node_path5, BOARD_DIR, BOARD_FILE, boardFileFor;
var init_store = __esm({
  "cli/src/store.ts"() {
    "use strict";
    import_node_fs4 = __toESM(require("node:fs"), 1);
    import_node_path5 = __toESM(require("node:path"), 1);
    init_context();
    init_fsutil();
    init_migrations();
    init_schema();
    BOARD_DIR = ".board";
    BOARD_FILE = "board.json";
    boardFileFor = (root) => import_node_path5.default.join(root, BOARD_DIR, BOARD_FILE);
  }
});

// server/src/discover.ts
function cwdFromSession(file) {
  let text;
  try {
    const fd = import_node_fs5.default.openSync(file, "r");
    const buf = Buffer.alloc(64 * 1024);
    const read = import_node_fs5.default.readSync(fd, buf, 0, buf.length, 0);
    import_node_fs5.default.closeSync(fd);
    text = buf.subarray(0, read).toString("utf8");
  } catch {
    return null;
  }
  for (const line of text.split("\n")) {
    if (!line.includes('"cwd"')) continue;
    try {
      const cwd = JSON.parse(line).cwd;
      if (typeof cwd === "string" && cwd.startsWith("/")) return cwd;
    } catch {
    }
  }
  return null;
}
function looksLikeAProject(ctx, dir) {
  const home = import_node_os2.default.homedir();
  const resolved = import_node_path6.default.resolve(dir);
  if (resolved === home || resolved === import_node_path6.default.parse(resolved).root) return false;
  if (import_node_path6.default.basename(resolved).startsWith(".")) return false;
  if (resolved.startsWith(import_node_path6.default.resolve(claudeHome(ctx)) + import_node_path6.default.sep)) return false;
  if (resolved.split(import_node_path6.default.sep).includes("Library")) return false;
  return true;
}
function discoverProjects(ctx) {
  const dir = import_node_path6.default.join(claudeHome(ctx), "projects");
  if (!import_node_fs5.default.existsSync(dir)) return [];
  const registered = new Set(readRegistry(ctx).map((e) => e.path));
  const found = /* @__PURE__ */ new Map();
  for (const entry of import_node_fs5.default.readdirSync(dir)) {
    const projectDir = import_node_path6.default.join(dir, entry);
    let sessions;
    try {
      if (!import_node_fs5.default.statSync(projectDir).isDirectory()) continue;
      sessions = import_node_fs5.default.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    if (!sessions.length) continue;
    const newest = sessions.map((f) => import_node_path6.default.join(projectDir, f)).sort((a, b) => import_node_fs5.default.statSync(b).mtimeMs - import_node_fs5.default.statSync(a).mtimeMs)[0];
    const cwd = cwdFromSession(newest);
    if (!cwd || registered.has(cwd) || found.has(cwd)) continue;
    if (!import_node_fs5.default.existsSync(cwd) || import_node_fs5.default.existsSync(boardFileFor(cwd))) continue;
    if (!looksLikeAProject(ctx, cwd)) continue;
    found.set(cwd, { path: cwd, name: prettyName(cwd), lastSeen: new Date(import_node_fs5.default.statSync(newest).mtimeMs).toISOString() });
  }
  return [...found.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}
var import_node_fs5, import_node_os2, import_node_path6, claudeHome, isKnownProject;
var init_discover = __esm({
  "server/src/discover.ts"() {
    "use strict";
    import_node_fs5 = __toESM(require("node:fs"), 1);
    import_node_os2 = __toESM(require("node:os"), 1);
    import_node_path6 = __toESM(require("node:path"), 1);
    init_commands();
    init_registry();
    init_store();
    claudeHome = (ctx) => ctx.env.LOOSE_ENDS_CLAUDE_HOME || ctx.env.CLAUDE_CONFIG_DIR || import_node_path6.default.join(import_node_os2.default.homedir(), ".claude");
    isKnownProject = (ctx, candidate) => discoverProjects(ctx).some((c) => c.path === import_node_path6.default.resolve(candidate));
  }
});

// server/src/projects.ts
function listProjects(ctx) {
  return readRegistry(ctx).filter((e) => import_node_fs6.default.existsSync(boardFileFor(e.path))).map((e) => ({ id: projectId(e.path), name: e.name, key: e.key, path: e.path, addedAt: e.addedAt }));
}
function findProject(ctx, id) {
  return listProjects(ctx).find((p) => p.id === id);
}
function loadBoard(project2) {
  return readBoard(boardFileFor(project2.path));
}
function summarize(project2) {
  const base = { ...project2, counts: Object.fromEntries(STATUSES.map((s2) => [s2, 0])) };
  let board2;
  try {
    board2 = loadBoard(project2);
  } catch (e) {
    return { ...base, total: 0, parked: 0, percentComplete: 0, error: e.message };
  }
  for (const f of board2.features) base.counts[f.status]++;
  const total = board2.features.length;
  return {
    ...base,
    name: board2.project.name,
    key: board2.project.key,
    total,
    parked: base.counts.parked,
    percentComplete: total ? Math.round(100 * base.counts.done / total) : 0
  };
}
var import_node_crypto2, import_node_fs6, projectId;
var init_projects = __esm({
  "server/src/projects.ts"() {
    "use strict";
    import_node_crypto2 = __toESM(require("node:crypto"), 1);
    import_node_fs6 = __toESM(require("node:fs"), 1);
    init_registry();
    init_schema();
    init_store();
    projectId = (path11) => import_node_crypto2.default.createHash("sha1").update(path11).digest("hex").slice(0, 8);
  }
});

// server/src/api.ts
function board(ctx, project2, argv) {
  const out = [];
  const err = [];
  const code = run([...argv, "--json"], {
    cwd: project2.path,
    env: { ...ctx.env, LOOSE_ENDS_BY: "user" },
    // the UI is the user typing
    out: (l) => out.push(l),
    err: (l) => err.push(l)
  });
  if (code !== 0) throw new HttpError(400, err.join("\n").replace(/^board: /, "") || "board command failed");
  return JSON.parse(out.join("\n") || "null");
}
function project(ctx, id) {
  const p = findProject(ctx, id);
  if (!p) throw new HttpError(404, `no project ${id}`);
  return p;
}
function applyPatch(ctx, p, key, patch) {
  const argv = ["update", key];
  if (patch.title !== void 0) argv.push("--title", str(patch.title, "title"));
  if (patch.note !== void 0) argv.push("--note", str(patch.note, "note"));
  if (patch.status !== void 0) argv.push("--status", str(patch.status, "status"));
  if (patch.type !== void 0) argv.push("--type", str(patch.type, "type"));
  for (const d of patch.doneWhen ?? []) argv.push("--done-when", str(d, "doneWhen entry"));
  if (argv.length > 2) board(ctx, p, argv);
  if (patch.steps) {
    const before = feature(p, key).steps;
    const after = patch.steps.map((s2) => ({ text: str(s2?.text, "step text"), done: !!s2?.done }));
    for (const s2 of before) if (!after.some((a) => a.text === s2.text)) board(ctx, p, ["step", key, s2.text, "--remove"]);
    for (const s2 of after) {
      const was = before.find((b) => b.text === s2.text);
      if (!was) board(ctx, p, ["step", key, s2.text, ...s2.done ? ["--done"] : []]);
      else if (was.done !== s2.done) board(ctx, p, ["step", key, s2.text, s2.done ? "--done" : "--undone"]);
    }
  }
  return feature(p, key);
}
function handleApi(ctx, req) {
  const { method, path: path11 } = req;
  const seg = path11.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (seg[0] === "discover" && seg.length === 1) {
    if (method !== "GET") throw new HttpError(405, "use GET");
    return discoverProjects(ctx);
  }
  if (seg[0] !== "projects") return void 0;
  if (seg.length === 1) {
    if (method === "GET") return listProjects(ctx).map(summarize);
    if (method !== "POST") throw new HttpError(405, "use GET or POST");
    const b = req.body ?? {};
    const dir = str(b.path, "path");
    if (!isKnownProject(ctx, dir)) throw new HttpError(403, "that folder isn't a project Claude Code has worked in, or it already has a board");
    const argv = ["init"];
    for (const [flag2, key] of [["--name", "name"], ["--key", "key"]])
      if (b[key] !== void 0 && b[key] !== "") argv.push(flag2, str(b[key], key));
    return board(ctx, { id: "", name: "", key: "", path: dir, addedAt: "" }, argv);
  }
  const p = project(ctx, seg[1]);
  if (seg.length === 3 && seg[2] === "board") {
    if (method !== "GET") throw new HttpError(405, "use GET");
    return loadBoard(p);
  }
  if (seg[2] === "notes") {
    const b = req.body ?? {};
    const fields = [["--title", "title"], ["--body", "body"], ["--url", "url"], ["--file", "file"]];
    if (seg.length === 3) {
      if (method !== "POST") throw new HttpError(405, "use POST");
      const argv = ["note", "add", str(b.kind, "kind"), str(b.title, "title")];
      for (const [flag2, key] of fields)
        if (key !== "title" && b[key] !== void 0 && b[key] !== "") argv.push(flag2, str(b[key], key));
      for (const c of b.cards ?? []) argv.push("--card", str(c, "card key"));
      return board(ctx, p, argv);
    }
    if (seg.length === 4) {
      const id = seg[3].toUpperCase();
      note(p, id);
      if (method === "DELETE") return board(ctx, p, ["note", "rm", id]);
      if (method !== "PATCH") throw new HttpError(405, "use PATCH or DELETE");
      const argv = ["note", "update", id];
      if (b.kind !== void 0 && b.kind !== "") argv.push("--kind", str(b.kind, "kind"));
      for (const [flag2, key] of fields) if (b[key] !== void 0) argv.push(flag2, str(b[key], key));
      for (const c of b.cards ?? []) argv.push("--card", str(c, "card key"));
      return argv.length > 3 ? board(ctx, p, argv) : note(p, id);
    }
  }
  if (seg[2] !== "features") throw new HttpError(404, `no route ${path11}`);
  if (seg.length === 3) {
    if (method !== "POST") throw new HttpError(405, "use POST");
    const b = req.body ?? {};
    const argv = ["add", str(b.title, "title")];
    for (const [flag2, key] of [["--status", "status"], ["--type", "type"], ["--note", "note"]])
      if (b[key] !== void 0 && b[key] !== "") argv.push(flag2, str(b[key], key));
    for (const s2 of b.steps ?? []) argv.push("--step", str(s2?.text, "step text"));
    for (const d of b.doneWhen ?? []) argv.push("--done-when", str(d, "doneWhen entry"));
    return board(ctx, p, argv);
  }
  if (seg.length === 4) {
    const key = seg[3].toUpperCase();
    feature(p, key);
    if (method === "PATCH") return applyPatch(ctx, p, key, req.body ?? {});
    if (method === "DELETE") return board(ctx, p, ["delete", key]);
    throw new HttpError(405, "use PATCH or DELETE");
  }
  throw new HttpError(404, `no route ${path11}`);
}
var HttpError, feature, note, str;
var init_api = __esm({
  "server/src/api.ts"() {
    "use strict";
    init_cli();
    init_discover();
    init_projects();
    HttpError = class extends Error {
      constructor(status, message) {
        super(message);
        this.status = status;
      }
    };
    feature = (project2, key) => {
      const f = loadBoard(project2).features.find((x) => x.key === key);
      if (!f) throw new HttpError(404, `no card ${key}`);
      return f;
    };
    note = (project2, id) => {
      const n = loadBoard(project2).notes.find((x) => x.id === id);
      if (!n) throw new HttpError(404, `no note ${id}`);
      return n;
    };
    str = (v, what) => {
      if (typeof v !== "string") throw new HttpError(400, `${what} must be a string`);
      return v;
    };
  }
});

// server/src/watch.ts
function watchBoards(ctx, onChange, { debounceMs = 60 } = {}) {
  const watchers = [];
  const timers = /* @__PURE__ */ new Map();
  let closed = false;
  const fire = (id) => {
    const k = id ?? "*";
    clearTimeout(timers.get(k));
    timers.set(
      k,
      setTimeout(() => {
        timers.delete(k);
        if (!closed) onChange(id);
      }, debounceMs).unref()
    );
  };
  const watch = (target, handler) => {
    try {
      const w = import_node_fs7.default.watch(target, { persistent: false }, handler);
      w.on("error", () => {
      });
      watchers.push(w);
    } catch {
    }
  };
  const rebuild = () => {
    while (watchers.length) watchers.pop().close();
    if (closed) return;
    watch(import_node_path7.default.dirname(registryFile(ctx)), (_e, file) => {
      if (!file || String(file).startsWith("projects.json")) {
        rebuild();
        fire(null);
      }
    });
    for (const p of listProjects(ctx)) watch(import_node_path7.default.join(p.path, BOARD_DIR), () => fire(p.id));
  };
  try {
    import_node_fs7.default.mkdirSync(import_node_path7.default.dirname(registryFile(ctx)), { recursive: true });
  } catch {
  }
  rebuild();
  return {
    close() {
      closed = true;
      for (const t of timers.values()) clearTimeout(t);
      while (watchers.length) watchers.pop().close();
    },
    rebuild
  };
}
var import_node_fs7, import_node_path7;
var init_watch = __esm({
  "server/src/watch.ts"() {
    "use strict";
    import_node_fs7 = __toESM(require("node:fs"), 1);
    import_node_path7 = __toESM(require("node:path"), 1);
    init_registry();
    init_store();
    init_projects();
  }
});

// server/src/server.ts
var server_exports = {};
__export(server_exports, {
  DEFAULT_PORT: () => DEFAULT_PORT,
  createServer: () => createServer,
  listen: () => listen
});
function defaultUiDir() {
  const here = typeof __dirname === "string" ? __dirname : import_node_path8.default.dirname((0, import_node_url.fileURLToPath)(__filename));
  const candidates = [import_node_path8.default.resolve(here, "../../ui"), import_node_path8.default.resolve(here, "../ui")];
  return candidates.find((d) => import_node_fs8.default.existsSync(import_node_path8.default.join(d, "index.html"))) ?? candidates[0];
}
function cors(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
    if (req.headers["access-control-request-private-network"] === "true")
      res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1e6) throw new HttpError(413, "body too large");
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return void 0;
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "body must be JSON");
  }
}
function serveStatic(res, urlPath, uiDir) {
  const rel = urlPath === "/" || urlPath === "/app" ? "index.html" : urlPath.replace(/^\/+/, "");
  const file = import_node_path8.default.join(uiDir, rel);
  if (!file.startsWith(uiDir + import_node_path8.default.sep) || !import_node_fs8.default.existsSync(file) || !import_node_fs8.default.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return void res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": MIME[import_node_path8.default.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  import_node_fs8.default.createReadStream(file).pipe(res);
}
function createServer(ctx, options = {}) {
  const uiDir = options.uiDir ?? defaultUiDir();
  const clients = /* @__PURE__ */ new Set();
  const watcher = watchBoards(ctx, (projectId2) => {
    for (const res of clients) send(res, "board", { project: projectId2 });
  });
  const send = (res, event, data) => {
    try {
      res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
    } catch {
      clients.delete(res);
    }
  };
  const server = import_node_http.default.createServer((req, res) => {
    void (async () => {
      const urlPath = new URL(req.url ?? "/", "http://localhost").pathname;
      cors(req, res);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return void res.end();
      }
      if (!ALLOWED_HOST.test(req.headers.host ?? "")) return json(res, 403, { error: "loopback only" });
      if (urlPath === "/api/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        clients.add(res);
        send(res, "hello", { ok: true });
        const beat = setInterval(() => res.write(": ping\n\n"), 25e3).unref();
        req.on("close", () => {
          clearInterval(beat);
          clients.delete(res);
        });
        return;
      }
      if (urlPath.startsWith("/api/")) {
        try {
          const body = req.method === "POST" || req.method === "PATCH" ? await readBody(req) : void 0;
          const result = handleApi(ctx, { method: req.method ?? "GET", path: urlPath, body });
          if (result === void 0) return json(res, 404, { error: `no route ${urlPath}` });
          return json(res, req.method === "POST" ? 201 : 200, result);
        } catch (e) {
          if (e instanceof HttpError) return json(res, e.status, { error: e.message });
          return json(res, 500, { error: e.message });
        }
      }
      if (req.method !== "GET") return json(res, 405, { error: "use GET" });
      serveStatic(res, urlPath, uiDir);
    })();
  });
  server.on("close", () => {
    watcher.close();
    for (const c of clients) c.end();
    clients.clear();
  });
  return Object.assign(server, { clientCount: () => clients.size });
}
function listen(ctx, port = DEFAULT_PORT, options = {}) {
  const tries = options.tries ?? 10;
  return new Promise((resolve, reject) => {
    const server = createServer(ctx, options);
    server.once("error", (e) => {
      if (e.code === "EADDRINUSE" && tries > 0) resolve(listen(ctx, port + 1, { ...options, tries: tries - 1 }));
      else reject(e);
    });
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const actual = typeof addr === "object" && addr ? addr.port : port;
      resolve({ server, url: `http://localhost:${actual}` });
    });
  });
}
var import_node_fs8, import_node_http, import_node_path8, import_node_url, DEFAULT_PORT, ALLOWED_ORIGIN, ALLOWED_HOST, MIME, json;
var init_server = __esm({
  "server/src/server.ts"() {
    "use strict";
    import_node_fs8 = __toESM(require("node:fs"), 1);
    import_node_http = __toESM(require("node:http"), 1);
    import_node_path8 = __toESM(require("node:path"), 1);
    import_node_url = require("node:url");
    init_api();
    init_watch();
    DEFAULT_PORT = 4747;
    ALLOWED_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$|^https:\/\/(www\.)?looseends\.dev$/;
    ALLOWED_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
    MIME = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon"
    };
    json = (res, status, body) => {
      const text = JSON.stringify(body, null, 2);
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(text) });
      res.end(text);
    };
  }
});

// cli/src/commands.ts
function emit(ctx, opts, json2, text) {
  if (opts.json) ctx.out(JSON.stringify(json2, null, 2));
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
  return import_node_path9.default.basename(dir).replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "Project";
}
function deriveKey(name) {
  const words = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const first = (words[0] ?? "").replace(/^[0-9]+/, "");
  let key = first.length >= 2 ? first.slice(0, 4) : words.map((w) => w[0]).join("").slice(0, 4);
  if (!/^[A-Z]/.test(key)) key = "P" + key;
  return (key + "XX").slice(0, Math.max(2, Math.min(key.length, 4)));
}
function init(ctx, { opts }) {
  const root = import_node_path9.default.resolve(ctx.cwd);
  const file = boardFileFor(root);
  let board2;
  let created = false;
  if (import_node_fs9.default.existsSync(file)) {
    board2 = readBoard(file);
    if (opts.name || opts.key) throw new UserError(`board already exists in ${BOARD_DIR}/ \u2014 rename with the UI or edit settings later`);
  } else {
    const name = str2(opts, "name")?.trim() || prettyName(root);
    const key = (str2(opts, "key") ?? deriveKey(name)).toUpperCase();
    if (!KEY_RE.test(key)) throw new UserError("--key must be 2\u20136 letters/digits, starting with a letter (e.g. LOOP)");
    board2 = emptyBoard(name, key);
    writeBoard(file, board2);
    writeFileAtomic(import_node_path9.default.join(root, BOARD_DIR, ".gitignore"), "*.lock\n*.tmp\n*.bak\n");
    created = true;
  }
  const isNew = registerProject(ctx, { path: root, name: board2.project.name, key: board2.project.key });
  emit(ctx, opts, { created, registered: isNew, project: board2.project, file, registry: registryFile(ctx) }, [
    created ? `Created board ${board2.project.name} (${board2.project.key}) in ${BOARD_DIR}/board.json` : `Board ${board2.project.name} (${board2.project.key}) already exists`,
    isNew ? `Registered in ${registryFile(ctx)}` : `Already registered`
  ]);
}
function listCmd(ctx, { opts }) {
  const board2 = readBoard(requireBoard(ctx).file);
  const statuses = str2(opts, "status")?.split(",").map((s2) => parseStatus(s2.trim()));
  const type = parseType(str2(opts, "type"));
  let fs10 = board2.features;
  if (statuses) fs10 = fs10.filter((f) => statuses.includes(f.status));
  else if (!opts.all) fs10 = fs10.filter((f) => f.status !== "done");
  if (type) fs10 = fs10.filter((f) => f.type === type);
  fs10 = sortFeatures(fs10);
  const w = Math.max(0, ...fs10.map((f) => f.key.length));
  const hidden = !statuses && !opts.all ? board2.features.filter((f) => f.status === "done").length : 0;
  const lines = fs10.length ? fs10.map((f) => formatLine(f, w)) : ["No cards."];
  if (hidden) lines.push(`(+${hidden} done \u2014 use --all)`);
  emit(ctx, opts, fs10, lines);
}
function show(ctx, { pos, opts }) {
  const board2 = readBoard(requireBoard(ctx).file);
  const f = findFeature(board2, need(pos, 0, "card key (e.g. LOOP-3)"));
  emit(ctx, opts, f, formatDetail(ctx, f));
}
function context(ctx, { opts }) {
  const loc = findBoard(ctx.cwd);
  if (!loc) {
    return emit(ctx, opts, { board: null }, "Loose Ends: no board in this project yet. Offer to create one with `board init`.");
  }
  const b = readBoard(loc.file);
  const work = b.features.filter((f) => f.type !== "question");
  const questions = sortFeatures(b.features.filter((f) => f.type === "question" && f.status !== "done"));
  const by = (s2) => sortFeatures(work.filter((f) => f.status === s2));
  const counts = Object.fromEntries(STATUSES.map((s2) => [s2, b.features.filter((f) => f.status === s2).length]));
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
          notes: sortNotes(b.notes)
        },
        null,
        2
      )
    );
  const summary = STATUSES.filter((s2) => counts[s2]).map((s2) => `${counts[s2]} ${s2}`).join(", ") || "empty";
  const lines = [`Loose Ends board: ${b.project.name} (${b.project.key}) \u2014 ${summary}`];
  const section = (title, fs10, extra) => {
    if (!fs10.length) return;
    lines.push(`${title}:`);
    for (const f of fs10) {
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
  if (questions.length) {
    lines.push("Open questions:");
    for (const q of questions)
      lines.push(`  ${q.key} ${q.title}${q.status === "review" && q.note ? ` \u2014 answered: ${q.note}` : ""}`);
  }
  const notes = NOTE_KINDS.filter((k) => noteCounts[k]).map((k) => `${noteCounts[k]} ${k}${noteCounts[k] === 1 ? "" : "s"}`);
  if (notes.length) lines.push(`Notes: ${notes.join(" \xB7 ")} \u2014 \`board note list\``);
  ctx.out(lines.join("\n"));
}
function add(ctx, { pos, opts }) {
  const title = need(pos, 0, `title (e.g. board add "Export loop as WAV")`).trim();
  if (!title) throw new UserError("title can't be empty");
  const status = parseStatus(str2(opts, "status")) ?? "idea";
  const type = parseType(str2(opts, "type")) ?? "feature";
  const note3 = str2(opts, "note") ?? str2(opts, "next") ?? "";
  const by = actor(ctx, str2(opts, "by"));
  const loc = requireBoard(ctx);
  const f = mutateBoard(loc, (b) => {
    const at = nowIso(ctx);
    const f2 = {
      key: `${b.project.key}-${b.nextNum}`,
      title,
      type,
      status,
      note: note3,
      doneWhen: list(opts, "done-when"),
      steps: list(opts, "step").map((text) => ({ text, done: false })),
      files: projectFiles(loc.root, ctx.cwd, list(opts, "file")),
      createdAt: at,
      updatedAt: at,
      updatedBy: by,
      log: [{ at, by, text: status === "idea" ? "Created" : `Created \u2014 ${status}` }]
    };
    if (status === "parked" && !note3.trim()) throw new UserError(`parking needs a note saying where you stopped (--note "...")`);
    b.nextNum++;
    b.features.push(f2);
    return f2;
  });
  emit(ctx, opts, f, `Added ${f.key} ${f.title} (${f.status})`);
}
function update(ctx, { pos, opts }) {
  const keyArg = need(pos, 0, "card key");
  const by = actor(ctx, str2(opts, "by"));
  const status = parseStatus(str2(opts, "status"));
  const type = parseType(str2(opts, "type"));
  const title = str2(opts, "title")?.trim();
  const note3 = str2(opts, "note") ?? str2(opts, "next");
  const doneWhen = list(opts, "done-when");
  if (title === "") throw new UserError("title can't be empty");
  if (!status && !type && title === void 0 && note3 === void 0 && !doneWhen.length && !list(opts, "file").length && !list(opts, "unfile").length)
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
    const root = requireBoard(ctx).root;
    const added = projectFiles(root, ctx.cwd, list(opts, "file")).filter((x) => !f2.files.includes(x));
    if (added.length) {
      f2.files.push(...added);
      logs.push(`Files: ${added.join(", ")}`);
    }
    const dropped = projectFiles(root, ctx.cwd, list(opts, "unfile")).filter((x) => f2.files.includes(x));
    if (dropped.length) {
      f2.files = f2.files.filter((x) => !dropped.includes(x));
      logs.push(`Removed files: ${dropped.join(", ")}`);
    }
    if (status && status !== f2.status) {
      setStatus(ctx, f2, status, by, note3);
    } else {
      if (note3 !== void 0 && note3 !== f2.note) {
        f2.note = note3;
        logs.push(note3 ? `Note: ${note3}` : "Cleared note");
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
    const by = actor(ctx, str2(opts, "by"));
    const note3 = str2(opts, "note");
    const f = mutateBoard(requireBoard(ctx), (b) => {
      const f2 = findFeature(b, keyArg);
      setStatus(ctx, f2, to, by, note3);
      return f2;
    });
    emit(ctx, opts, f, `${f.key} ${f.title} \u2192 ${f.status}`);
  };
}
function step(ctx, { pos, opts }) {
  const keyArg = need(pos, 0, "card key");
  const text = need(pos, 1, `step text or number (e.g. board step LOOP-3 "Render buffer")`).trim();
  const by = actor(ctx, str2(opts, "by"));
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
  const intoArg = str2(opts, "into");
  if (!intoArg) throw new UserError("missing --into <card>");
  const by = actor(ctx, str2(opts, "by"));
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
function projectFiles(root, cwd, paths) {
  const rels = paths.map((p) => import_node_path9.default.relative(root, import_node_path9.default.resolve(cwd, p))).filter((r) => r && !r.startsWith("..") && !import_node_path9.default.isAbsolute(r)).map((r) => r.split(import_node_path9.default.sep).join("/")).filter((r) => r !== BOARD_DIR && !r.startsWith(BOARD_DIR + "/"));
  return [...new Set(rels)];
}
function touch(ctx, { pos, opts }) {
  if (!pos.length) throw new UserError("missing file(s)");
  const loc = findBoard(ctx.cwd);
  const nothing = (why) => opts.json ? ctx.out(JSON.stringify({ card: null, added: [], reason: why })) : void 0;
  if (!loc) return nothing("no board");
  const rels = projectFiles(loc.root, ctx.cwd, pos);
  if (!rels.length) return nothing("no files inside the project");
  const target = str2(opts, "card");
  const board2 = readBoard(loc.file);
  const probe = target ? findFeature(board2, target) : activeFeature(board2);
  if (!probe) return nothing("no active card");
  const wanted = (f, r) => !f.files.includes(r) && (!!target || fileFits(f, r));
  if (!rels.some((r) => wanted(probe, r)))
    return nothing(rels.every((r) => probe.files.includes(r)) ? "already attached" : "no card these files belong to");
  const by = actor(ctx, str2(opts, "by"));
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
function remove(ctx, { pos, opts }) {
  const keyArg = need(pos, 0, "card key");
  const f = mutateBoard(requireBoard(ctx), (b) => {
    const f2 = findFeature(b, keyArg);
    b.features = b.features.filter((x) => x !== f2);
    return f2;
  });
  emit(ctx, opts, f, `Deleted ${f.key} ${f.title}`);
}
function ui(ctx, { opts }) {
  const port = str2(opts, "port") ? Number(str2(opts, "port")) : void 0;
  if (port !== void 0 && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new UserError("--port must be a port number");
  void Promise.resolve().then(() => (init_server(), server_exports)).then(({ listen: listen2, DEFAULT_PORT: DEFAULT_PORT2 }) => listen2(ctx, port ?? DEFAULT_PORT2)).then(({ url }) => {
    const projects = readRegistry(ctx).length;
    ctx.out(`Loose Ends \u2192 ${url}`);
    ctx.out(`${projects} project${projects === 1 ? "" : "s"} \xB7 board data stays on this machine \xB7 Ctrl-C to stop`);
    if (!opts["no-open"]) openBrowser(url);
  }).catch((e) => {
    ctx.err(`board: can't start the server: ${e.message}`);
    process.exitCode = 1;
  });
}
function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    (0, import_node_child_process.spawn)(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {
  }
}
function ask(ctx, { pos, opts }) {
  add(ctx, { pos, opts: { ...opts, type: "question" } });
}
function answer(ctx, { pos, opts }) {
  const keyArg = need(pos, 0, "question key");
  const text = (pos[1] ?? str2(opts, "note") ?? "").trim();
  if (!text) throw new UserError(`missing the answer (board answer LE-7 "what you found out")`);
  const by = actor(ctx, str2(opts, "by"));
  const f = mutateBoard(requireBoard(ctx), (b) => {
    const f2 = findFeature(b, keyArg);
    if (f2.type !== "question")
      throw new UserError(`${f2.key} is a ${f2.type}, not a question \u2014 use \`board update ${f2.key} --note\``);
    setStatus(ctx, f2, opts.done ? "done" : "review", by, text);
    return f2;
  });
  emit(ctx, opts, f, `${f.key} ${f.status === "done" ? "answered and closed" : "answered \u2014 decide when you're ready"}`);
}
function parseKind(v) {
  if (v === void 0) throw new UserError(`missing kind \u2014 one of ${NOTE_KINDS.join(", ")}`);
  const k = v.toLowerCase().replace(/s$/, "");
  if (!NOTE_KINDS.includes(k)) throw new UserError(`kind must be one of ${NOTE_KINDS.join(", ")}`);
  return k;
}
function noteCards(b, keys) {
  return [...new Set(keys.map((k) => findFeature(b, k).key))];
}
function noteFile(ctx, root, v) {
  if (v === void 0) return void 0;
  if (!v) return "";
  const [rel] = projectFiles(root, ctx.cwd, [v]);
  if (!rel) throw new UserError(`${v} is outside this project`);
  return rel;
}
function note2(ctx, { pos, opts }) {
  const sub = (pos[0] ?? "list").toLowerCase();
  const rest = pos.slice(1);
  const subs = {
    add: noteAdd,
    list: noteList,
    ls: noteList,
    show: noteShow,
    update: noteUpdate,
    edit: noteUpdate,
    link: noteLink,
    rm: noteRemove,
    delete: noteRemove
  };
  const fn = subs[sub];
  if (!fn) throw new UserError(`unknown: board note ${sub} \u2014 use add, list, show, update, link or rm`);
  fn(ctx, rest, opts);
}
function noteAdd(ctx, pos, opts) {
  const kind = parseKind(pos[0]);
  const title = need(pos, 1, `title (e.g. board note add reference "The CRDT paper" --url ...)`).trim();
  if (!title) throw new UserError("title can't be empty");
  const by = actor(ctx, str2(opts, "by"));
  const loc = requireBoard(ctx);
  const n = mutateBoard(loc, (b) => {
    const at = nowIso(ctx);
    const n2 = {
      id: `${b.project.key}-N${b.nextNoteNum}`,
      kind,
      title,
      body: str2(opts, "body") ?? "",
      url: str2(opts, "url") ?? "",
      file: noteFile(ctx, loc.root, str2(opts, "file")) ?? "",
      cards: noteCards(b, list(opts, "card")),
      createdAt: at,
      updatedAt: at,
      updatedBy: by
    };
    b.nextNoteNum++;
    b.notes.push(n2);
    return n2;
  });
  emit(ctx, opts, n, `Added ${n.id} ${n.title} (${n.kind})`);
}
function noteList(ctx, _pos, opts) {
  const b = readBoard(requireBoard(ctx).file);
  const kind = str2(opts, "kind") ? parseKind(str2(opts, "kind")) : void 0;
  const ns = sortNotes(kind ? b.notes.filter((n) => n.kind === kind) : b.notes);
  const w = Math.max(0, ...ns.map((n) => n.id.length));
  emit(ctx, opts, ns, ns.length ? ns.map((n) => formatNoteLine(n, w)) : ["No notes."]);
}
function noteShow(ctx, pos, opts) {
  const b = readBoard(requireBoard(ctx).file);
  const n = findNote(b, need(pos, 0, "note id (e.g. LOOP-N3)"));
  emit(ctx, opts, n, formatNoteDetail(ctx, n));
}
function noteUpdate(ctx, pos, opts) {
  const idArg = need(pos, 0, "note id");
  const by = actor(ctx, str2(opts, "by"));
  const loc = requireBoard(ctx);
  const fields = ["title", "body", "url", "file"];
  if (!fields.some((f) => str2(opts, f) !== void 0) && !list(opts, "card").length && !str2(opts, "kind"))
    throw new UserError("nothing to update (use --title, --body, --url, --file, --kind or --card)");
  const n = mutateBoard(loc, (b) => {
    const n2 = findNote(b, idArg);
    const title = str2(opts, "title")?.trim();
    if (title === "") throw new UserError("title can't be empty");
    if (title !== void 0) n2.title = title;
    if (str2(opts, "kind") !== void 0) n2.kind = parseKind(str2(opts, "kind"));
    if (str2(opts, "body") !== void 0) n2.body = str2(opts, "body");
    if (str2(opts, "url") !== void 0) n2.url = str2(opts, "url");
    const file = noteFile(ctx, loc.root, str2(opts, "file"));
    if (file !== void 0) n2.file = file;
    const cards = list(opts, "card");
    if (cards.length) n2.cards = [.../* @__PURE__ */ new Set([...n2.cards, ...noteCards(b, cards)])];
    stampNote(ctx, n2, by);
    return n2;
  });
  emit(ctx, opts, n, `Updated ${formatNoteLine(n)}`);
}
function noteLink(ctx, pos, opts) {
  const idArg = need(pos, 0, "note id");
  const keys = [...pos.slice(1), ...list(opts, "card")];
  if (!keys.length) throw new UserError("missing card(s) to link (board note link LOOP-N3 LOOP-4)");
  const by = actor(ctx, str2(opts, "by"));
  const { n, added } = mutateBoard(requireBoard(ctx), (b) => {
    const n2 = findNote(b, idArg);
    const added2 = noteCards(b, keys).filter((k) => !n2.cards.includes(k));
    n2.cards.push(...added2);
    if (added2.length) stampNote(ctx, n2, by);
    return { n: n2, added: added2 };
  });
  emit(ctx, opts, n, added.length ? `${n.id} \u2192 ${added.join(", ")}` : `${n.id} already links those`);
}
function noteRemove(ctx, pos, opts) {
  const idArg = need(pos, 0, "note id");
  const n = mutateBoard(requireBoard(ctx), (b) => {
    const n2 = findNote(b, idArg);
    b.notes = b.notes.filter((x) => x !== n2);
    return n2;
  });
  emit(ctx, opts, n, `Deleted ${n.id} ${n.title}`);
}
async function postJson(url, body, timeoutMs = 1e4) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal
    });
    const text = await res.text();
    const json2 = text ? JSON.parse(text) : {};
    if (!res.ok) throw new UserError(json2.error || `${res.status} ${res.statusText}`);
    return json2;
  } catch (e) {
    if (e instanceof UserError) throw e;
    if (e.name === "AbortError") throw new UserError(`${url} didn't answer in time`);
    throw new UserError(`can't reach ${url}: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}
function login(ctx, { opts }) {
  const site = siteUrl(ctx);
  void (async () => {
    try {
      const start = await postJson(`${site}/api/device/start`, {});
      const verifyUrl = start.verifyUrl ?? `${site}/link?code=${start.userCode}`;
      ctx.out(`Your code: ${start.userCode}`);
      ctx.out(`Approve it at ${verifyUrl}`);
      if (!opts["no-open"]) openBrowser(verifyUrl);
      const intervalMs = Math.max(1, Number(start.interval) || 2) * 1e3;
      const deadline = Date.now() + (Number(start.expiresIn) || 600) * 1e3;
      for (; ; ) {
        await wait(intervalMs);
        if (Date.now() > deadline) throw new UserError("the code expired \u2014 run `board login` again");
        const poll = await postJson(`${site}/api/device/poll`, { deviceCode: start.deviceCode });
        if (poll.status === "pending") continue;
        if (poll.status === "denied") throw new UserError("sign-in was declined");
        if (poll.status === "expired") throw new UserError("the code expired \u2014 run `board login` again");
        if (poll.status !== "approved" || !poll.token) throw new UserError(`unexpected answer: ${JSON.stringify(poll)}`);
        writeAuth(ctx, { token: poll.token, userId: poll.userId, email: poll.email, name: poll.name, site });
        track(ctx, "login", { source: "cli" });
        ctx.out(poll.email ? `Signed in as ${poll.email}` : "Signed in");
        ctx.out("Your boards stay on this machine \u2014 signing in only ties usage counts to your account.");
        return;
      }
    } catch (e) {
      ctx.err(`board: ${e instanceof UserError ? e.message : e.message}`);
      process.exitCode = 1;
    }
  })();
}
function logout(ctx, { opts }) {
  const had = clearAuth(ctx);
  emit(ctx, opts, { signedOut: had }, had ? "Signed out" : "You weren't signed in");
}
function telemetry(ctx, { pos, opts }) {
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
    settings.telemetry ? "Telemetry on \u2014 action names and counts only, never titles, notes or paths." : "Telemetry off \u2014 nothing is sent.",
    auth ? `Signed in as ${auth.email ?? auth.userId}` : "Not signed in (events would be anonymous)."
  ]);
}
var import_node_child_process, import_node_fs9, import_node_path9, str2, list, park, review, done, wait;
var init_commands = __esm({
  "cli/src/commands.ts"() {
    "use strict";
    import_node_child_process = require("node:child_process");
    import_node_fs9 = __toESM(require("node:fs"), 1);
    import_node_path9 = __toESM(require("node:path"), 1);
    init_account();
    init_analytics();
    init_context();
    init_features();
    init_fsutil();
    init_registry();
    init_schema();
    init_notes();
    init_store();
    str2 = (o, k) => typeof o[k] === "string" ? o[k] : void 0;
    list = (o, k) => Array.isArray(o[k]) ? o[k] : [];
    park = statusCommand("parked");
    review = statusCommand("review");
    done = statusCommand("done");
    wait = (ms) => new Promise((r) => setTimeout(r, ms));
  }
});

// cli/src/cli.ts
function helpText() {
  return [
    "board \u2014 the Loose Ends feature board",
    "",
    "Usage:",
    ...Object.values(COMMANDS).map((c) => `  board ${c.usage}`),
    "",
    "Global: --json (machine output)  --by claude|user  -C, --dir <path>",
    "Cards can be referred to as LOOP-3 or just 3; notes as LOOP-N3, N3 or 3."
  ].join("\n");
}
function run(argv, ctx) {
  const [name, ...rest] = argv;
  if (!name || name === "help" || name === "--help" || name === "-h") {
    ctx.out(helpText());
    return 0;
  }
  if (name === "--version" || name === "-v") {
    ctx.out("0.2.0");
    return 0;
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
    const dir = typeof opts.dir === "string" ? import_node_path10.default.resolve(ctx.cwd, opts.dir) : ctx.cwd;
    command.run({ ...ctx, cwd: dir }, { pos: parsed.positionals, opts });
    return 0;
  } catch (e) {
    if (e instanceof UserError) ctx.err(`board: ${e.message}`);
    else ctx.err(`board: unexpected error: ${e.stack ?? e}`);
    return 1;
  }
}
var import_node_path10, import_node_util, GLOBAL, s, many, flag, COMMANDS;
var init_cli = __esm({
  "cli/src/cli.ts"() {
    "use strict";
    import_node_path10 = __toESM(require("node:path"), 1);
    import_node_util = require("node:util");
    init_commands();
    init_context();
    GLOBAL = {
      json: { type: "boolean" },
      by: { type: "string" },
      dir: { type: "string", short: "C" },
      help: { type: "boolean", short: "h" }
    };
    s = { type: "string" };
    many = { type: "string", multiple: true };
    flag = { type: "boolean" };
    COMMANDS = {
      init: { usage: `init [--name "Looper"] [--key LOOP]`, options: { name: s, key: s }, run: init },
      list: { usage: "list [--status parked[,review]] [--type bug|question] [--all]", options: { status: s, type: s, all: flag }, run: listCmd },
      show: { usage: "show LOOP-3", options: {}, run: show },
      add: {
        usage: `add "Title" [--status active] [--type bug] [--next "..."] [--step "..."]... [--done-when "..."]... [--file path]...`,
        options: { status: s, type: s, next: s, note: s, step: many, "done-when": many, file: many },
        run: add
      },
      update: {
        usage: "update LOOP-3 [--title ...] [--note ...] [--status ...] [--type ...] [--done-when ...]... [--file path]... [--unfile path]...",
        options: { title: s, note: s, next: s, status: s, type: s, "done-when": many, file: many, unfile: many },
        run: update
      },
      step: { usage: `step LOOP-3 "Render buffer"|2 [--done|--undone|--remove]`, options: { done: flag, undone: flag, remove: flag }, run: step },
      park: { usage: `park LOOP-3 --note "Where we stopped"`, options: { note: s }, run: park },
      review: { usage: `review LOOP-3 [--note "What to check"]`, options: { note: s }, run: review },
      done: { usage: "done LOOP-3", options: {}, run: done },
      merge: { usage: "merge LOOP-15 --into LOOP-3", options: { into: s }, run: merge },
      ask: {
        usage: `ask "Which auth provider?" [--status active] [--note "..."]`,
        options: { status: s, next: s, note: s, step: many, "done-when": many, file: many },
        run: ask
      },
      answer: { usage: `answer LOOP-7 "What you found out" [--done]`, options: { note: s, done: flag }, run: answer },
      note: {
        usage: `note add brainstorm|plan|reference "Title" [--body ...] [--url ...] [--file ...] [--card LOOP-3]...
         note list [--kind plan] \xB7 note show LOOP-N3 \xB7 note update LOOP-N3 ... \xB7 note link LOOP-N3 LOOP-4 \xB7 note rm LOOP-N3`,
        options: { kind: s, title: s, body: s, url: s, file: s, card: many },
        run: note2
      },
      delete: { usage: "delete LOOP-3", options: {}, run: remove },
      touch: { usage: "touch <file>... [--card LOOP-3]", options: { card: s }, run: touch },
      context: { usage: "context", options: {}, run: context },
      ui: { usage: "ui [--port 4747] [--no-open]", options: { port: s, "no-open": flag }, run: ui },
      login: { usage: "login [--no-open]", options: { "no-open": flag }, run: login },
      logout: { usage: "logout", options: {}, run: logout },
      telemetry: { usage: "telemetry [off|on|status]", options: {}, run: telemetry }
    };
  }
});

// cli/src/index.ts
init_cli();
process.exitCode = run(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  out: (l) => process.stdout.write(l + "\n"),
  err: (l) => process.stderr.write(l + "\n")
});
