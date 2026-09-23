import fs from "node:fs";
import path from "node:path";

/** Write via temp file + rename so readers never see a half-written file. */
export function writeFileAtomic(file: string, data: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

export function writeJsonAtomic(file: string, value: unknown): void {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + "\n");
}

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Cross-process lock (hooks may run `board touch` concurrently with other writes).
 * mkdir is atomic; a lock older than `staleMs` is assumed abandoned.
 */
export function withLock<T>(lockPath: string, fn: () => T, { timeoutMs = 3000, staleMs = 10_000 } = {}): T {
  const start = Date.now();
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  for (;;) {
    try {
      fs.mkdirSync(lockPath);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > staleMs) {
          fs.rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue; // lock vanished between mkdir and stat
      }
      if (Date.now() - start > timeoutMs) throw new Error(`board is locked (${lockPath}); try again`);
      sleep(25);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}
