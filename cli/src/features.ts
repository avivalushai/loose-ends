// Pure helpers over a Board: lookup, status changes, formatting.

import { type Ctx, UserError, nowIso } from "./context.js";
import type { Actor, Board, Feature, Status } from "./schema.js";

export const STATUS_ORDER: Status[] = ["active", "parked", "review", "idea", "done"];

const NOTE_LABEL: Partial<Record<Status, string>> = { active: "Next", parked: "Stopped", review: "Check" };

export function findFeature(board: Board, input: string): Feature {
  const want = /^\d+$/.test(input) ? `${board.project.key}-${input}` : input.toUpperCase();
  const f = board.features.find((x) => x.key === want);
  if (!f) throw new UserError(`no card ${want}`);
  return f;
}

export function stamp(ctx: Ctx, f: Feature, by: Actor, logText?: string): void {
  const at = nowIso(ctx);
  f.updatedAt = at;
  f.updatedBy = by;
  if (logText) f.log.push({ at, by, text: logText });
}

export function statusLog(to: Status, note: string): string {
  const base = { idea: "Moved to ideas", active: "Started", parked: "Parked", review: "Moved to review", done: "Done" }[to];
  return note && to !== "idea" && to !== "done" ? `${base} — ${note}` : base;
}

/** Change status (and optionally note). Parking always needs a note: that's the whole point. */
export function setStatus(ctx: Ctx, f: Feature, to: Status, by: Actor, note?: string): void {
  if (note !== undefined) f.note = note;
  if (to === "parked" && !f.note.trim())
    throw new UserError(`parking needs a note saying where you stopped (--note "...")`);
  if (f.status === to && note === undefined) return;
  f.status = to;
  stamp(ctx, f, by, statusLog(to, note ?? ""));
}

export function progress(f: Feature): { done: number; total: number } {
  return { done: f.steps.filter((s) => s.done).length, total: f.steps.length };
}

export function sortFeatures(fs: Feature[]): Feature[] {
  return [...fs].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt),
  );
}

/** The card `touch` attaches files to: the most recently updated active card. */
export function activeFeature(board: Board): Feature | undefined {
  return sortFeatures(board.features.filter((f) => f.status === "active"))[0];
}

export function ageDays(ctx: Ctx, iso: string): number {
  return Math.floor((Date.parse(nowIso(ctx)) - Date.parse(iso)) / 86_400_000);
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function formatLine(f: Feature, keyWidth = 0): string {
  const { done, total } = progress(f);
  const parts = [f.key.padEnd(keyWidth), f.status.padEnd(6), f.title];
  if (f.type !== "feature") parts.push(`[${f.type}]`);
  if (total) parts.push(`(${done}/${total})`);
  const label = NOTE_LABEL[f.status];
  if (label && f.note) parts.push(`— ${label}: ${clip(f.note, 70)}`);
  return parts.join("  ").replace(/ {2}\[/, " [");
}

export function formatDetail(ctx: Ctx, f: Feature): string {
  const { done, total } = progress(f);
  const lines = [`${f.key}  ${f.title}`, `${f.status} · ${f.type} · updated ${ageLabel(ctx, f.updatedAt)} by ${f.updatedBy}`];
  const label = NOTE_LABEL[f.status] ?? "Note";
  if (f.note) lines.push(`${label}: ${f.note}`);
  if (f.doneWhen.length) lines.push("Done when:", ...f.doneWhen.map((d) => `  - ${d}`));
  if (total) lines.push(`Steps (${done}/${total}):`, ...f.steps.map((s, i) => `  ${i + 1}. [${s.done ? "x" : " "}] ${s.text}`));
  if (f.files.length) lines.push("Files:", ...f.files.map((x) => `  ${x}`));
  if (f.log.length) lines.push("Log:", ...f.log.slice(-5).map((e) => `  ${e.at.slice(0, 16).replace("T", " ")} ${e.by}: ${e.text}`));
  return lines.join("\n");
}

export function ageLabel(ctx: Ctx, iso: string): string {
  const mins = Math.floor((Date.parse(nowIso(ctx)) - Date.parse(iso)) / 60_000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}
