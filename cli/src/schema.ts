// board.json schema (SPEC §3) and a dependency-free validator.

export const SCHEMA_VERSION = 1;

export const STATUSES = ["idea", "active", "parked", "review", "done"] as const;
export const TYPES = ["feature", "bug", "chore"] as const;
export const ACTORS = ["claude", "user"] as const;
export const GRANULARITIES = ["coarse", "normal", "fine"] as const;

export type Status = (typeof STATUSES)[number];
export type FeatureType = (typeof TYPES)[number];
export type Actor = (typeof ACTORS)[number];
export type Granularity = (typeof GRANULARITIES)[number];

export interface Step {
  text: string;
  done: boolean;
}

export interface LogEntry {
  at: string;
  by: Actor;
  text: string;
}

export interface Feature {
  key: string;
  title: string;
  type: FeatureType;
  status: Status;
  note: string;
  doneWhen: string[];
  steps: Step[];
  files: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy: Actor;
  log: LogEntry[];
}

export interface Board {
  schemaVersion: number;
  project: { name: string; key: string };
  settings: { granularity: Granularity };
  nextNum: number;
  features: Feature[];
}

export const KEY_RE = /^[A-Z][A-Z0-9]{1,5}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const oneOf = <T extends readonly string[]>(list: T, v: unknown): v is T[number] =>
  isStr(v) && (list as readonly string[]).includes(v);

/** Returns a list of problems; empty means the board is valid. */
export function validateBoard(b: unknown): string[] {
  const errs: string[] = [];
  const err = (path: string, msg: string) => errs.push(`${path}: ${msg}`);

  if (!isObj(b)) return ["board: must be an object"];
  if (b.schemaVersion !== SCHEMA_VERSION) err("schemaVersion", `must be ${SCHEMA_VERSION}`);

  if (!isObj(b.project)) err("project", "must be an object");
  else {
    if (!isStr(b.project.name) || !b.project.name.trim()) err("project.name", "must be a non-empty string");
    if (!isStr(b.project.key) || !KEY_RE.test(b.project.key))
      err("project.key", "must be 2–6 uppercase letters/digits, starting with a letter");
  }

  if (!isObj(b.settings)) err("settings", "must be an object");
  else if (!oneOf(GRANULARITIES, b.settings.granularity))
    err("settings.granularity", `must be one of ${GRANULARITIES.join(", ")}`);

  if (!Number.isInteger(b.nextNum) || (b.nextNum as number) < 1) err("nextNum", "must be a positive integer");

  if (!Array.isArray(b.features)) {
    err("features", "must be an array");
    return errs;
  }

  const projectKey = isObj(b.project) && isStr(b.project.key) ? b.project.key : null;
  const seen = new Set<string>();
  b.features.forEach((f, i) => {
    const p = `features[${i}]`;
    if (!isObj(f)) return err(p, "must be an object");

    const m = isStr(f.key) ? /^([A-Z][A-Z0-9]*)-(\d+)$/.exec(f.key) : null;
    if (!m) err(`${p}.key`, "must look like KEY-123");
    else {
      if (projectKey && m[1] !== projectKey) err(`${p}.key`, `prefix must be ${projectKey}`);
      if (Number.isInteger(b.nextNum) && Number(m[2]) >= (b.nextNum as number))
        err(`${p}.key`, "number must be below nextNum");
      if (seen.has(f.key as string)) err(`${p}.key`, `duplicate key ${f.key}`);
      seen.add(f.key as string);
    }

    if (!isStr(f.title) || !f.title.trim()) err(`${p}.title`, "must be a non-empty string");
    if (!oneOf(TYPES, f.type)) err(`${p}.type`, `must be one of ${TYPES.join(", ")}`);
    if (!oneOf(STATUSES, f.status)) err(`${p}.status`, `must be one of ${STATUSES.join(", ")}`);
    if (!isStr(f.note)) err(`${p}.note`, "must be a string");
    if (!Array.isArray(f.doneWhen) || !f.doneWhen.every(isStr)) err(`${p}.doneWhen`, "must be an array of strings");
    if (!Array.isArray(f.files) || !f.files.every(isStr)) err(`${p}.files`, "must be an array of strings");

    if (!Array.isArray(f.steps)) err(`${p}.steps`, "must be an array");
    else
      f.steps.forEach((s, j) => {
        if (!isObj(s) || !isStr(s.text) || typeof s.done !== "boolean")
          err(`${p}.steps[${j}]`, "must be { text: string, done: boolean }");
      });

    for (const k of ["createdAt", "updatedAt"] as const)
      if (!isStr(f[k]) || !ISO_RE.test(f[k] as string)) err(`${p}.${k}`, "must be an ISO-8601 UTC timestamp");
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

export function emptyBoard(name: string, key: string): Board {
  return {
    schemaVersion: SCHEMA_VERSION,
    project: { name, key },
    settings: { granularity: "normal" },
    nextNum: 1,
    features: [],
  };
}
