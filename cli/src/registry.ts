// ~/.loose-ends/projects.json — every board on this machine (SPEC §3).

import fs from "node:fs";
import path from "node:path";
import { type Ctx, homeDir, nowIso } from "./context.js";
import { writeJsonAtomic, withLock } from "./fsutil.js";

export interface RegistryEntry {
  path: string;
  name: string;
  key: string;
  addedAt: string;
}

export const registryFile = (ctx: Ctx) => path.join(homeDir(ctx), "projects.json");

export function readRegistry(ctx: Ctx): RegistryEntry[] {
  const file = registryFile(ctx);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(data)) return [];
    return data.filter(
      (e): e is RegistryEntry =>
        e && typeof e.path === "string" && typeof e.name === "string" && typeof e.key === "string",
    );
  } catch {
    return []; // a corrupt registry must never block board work; it's rebuilt as projects init
  }
}

/** Add or refresh a project (matched by path). Returns true if it was new. */
export function registerProject(ctx: Ctx, entry: { path: string; name: string; key: string }): boolean {
  const file = registryFile(ctx);
  return withLock(file + ".lock", () => {
    const list = readRegistry(ctx);
    const existing = list.find((e) => e.path === entry.path);
    if (existing) {
      existing.name = entry.name;
      existing.key = entry.key;
    } else {
      list.push({ ...entry, addedAt: nowIso(ctx) });
    }
    writeJsonAtomic(file, list);
    return !existing;
  });
}
