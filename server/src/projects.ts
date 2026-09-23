// Reading the registry and each project's board. Writes never happen here —
// they go through the CLI (see api.ts).

import crypto from "node:crypto";
import fs from "node:fs";
import type { Ctx } from "../../cli/src/context.js";
import { readRegistry } from "../../cli/src/registry.js";
import type { Board, Status } from "../../cli/src/schema.js";
import { STATUSES } from "../../cli/src/schema.js";
import { boardFileFor, readBoard } from "../../cli/src/store.js";

export interface Project {
  id: string;
  name: string;
  key: string;
  path: string;
  addedAt: string;
}

export interface ProjectSummary extends Project {
  counts: Record<Status, number>;
  total: number;
  parked: number;
  percentComplete: number;
  error?: string;
}

/** Stable, path-derived id — survives restarts, and keeps paths out of URLs. */
export const projectId = (path: string) => crypto.createHash("sha1").update(path).digest("hex").slice(0, 8);

/** Registered projects whose board still exists on disk. */
export function listProjects(ctx: Ctx): Project[] {
  return readRegistry(ctx)
    .filter((e) => fs.existsSync(boardFileFor(e.path)))
    .map((e) => ({ id: projectId(e.path), name: e.name, key: e.key, path: e.path, addedAt: e.addedAt }));
}

export function findProject(ctx: Ctx, id: string): Project | undefined {
  return listProjects(ctx).find((p) => p.id === id);
}

export function loadBoard(project: Project): Board {
  return readBoard(boardFileFor(project.path));
}

export function summarize(project: Project): ProjectSummary {
  const base = { ...project, counts: Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number> };
  let board: Board;
  try {
    board = loadBoard(project);
  } catch (e) {
    return { ...base, total: 0, parked: 0, percentComplete: 0, error: (e as Error).message };
  }
  for (const f of board.features) base.counts[f.status]++;
  const total = board.features.length;
  return {
    ...base,
    name: board.project.name,
    key: board.project.key,
    total,
    parked: base.counts.parked,
    percentComplete: total ? Math.round((100 * base.counts.done) / total) : 0,
  };
}
