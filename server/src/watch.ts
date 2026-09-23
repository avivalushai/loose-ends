// Watches every registered board plus the registry itself, and tells listeners
// which project changed. Watchers are re-built whenever the registry changes.

import fs from "node:fs";
import path from "node:path";
import type { Ctx } from "../../cli/src/context.js";
import { registryFile } from "../../cli/src/registry.js";
import { BOARD_DIR } from "../../cli/src/store.js";
import { listProjects } from "./projects.js";

export type ChangeListener = (projectId: string | null) => void;

export function watchBoards(ctx: Ctx, onChange: ChangeListener, { debounceMs = 60 } = {}) {
  const watchers: fs.FSWatcher[] = [];
  const timers = new Map<string, NodeJS.Timeout>();
  let closed = false;

  const fire = (id: string | null) => {
    const k = id ?? "*";
    clearTimeout(timers.get(k));
    timers.set(
      k,
      setTimeout(() => {
        timers.delete(k);
        if (!closed) onChange(id);
      }, debounceMs).unref(),
    );
  };

  const watch = (target: string, handler: fs.WatchListener<string>) => {
    try {
      const w = fs.watch(target, { persistent: false }, handler);
      w.on("error", () => {}); // a deleted folder must not take the server down
      watchers.push(w);
    } catch {
      /* unreadable path: skip it */
    }
  };

  const rebuild = () => {
    while (watchers.length) watchers.pop()!.close();
    if (closed) return;
    watch(path.dirname(registryFile(ctx)), (_e, file) => {
      if (!file || String(file).startsWith("projects.json")) {
        rebuild();
        fire(null); // the project list itself changed
      }
    });
    for (const p of listProjects(ctx)) watch(path.join(p.path, BOARD_DIR), () => fire(p.id));
  };

  try {
    fs.mkdirSync(path.dirname(registryFile(ctx)), { recursive: true });
  } catch {
    /* nothing to watch yet */
  }
  rebuild();

  return {
    close() {
      closed = true;
      for (const t of timers.values()) clearTimeout(t);
      while (watchers.length) watchers.pop()!.close();
    },
    rebuild,
  };
}
