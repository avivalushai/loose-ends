// schemaVersion migrations. To change the schema:
//   1. bump SCHEMA_VERSION in schema.ts
//   2. add MIGRATIONS[oldVersion] = (board) => upgradedBoard
//   3. add a fixture test in cli/test/migrations.test.ts
// Each migration takes a board at version N and returns one at version N+1.

import { SCHEMA_VERSION } from "./schema.js";

export type Migration = (board: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Record<number, Migration> = {
  // v1 is the first released schema; nothing to migrate yet.
};

export class MigrationError extends Error {}

export interface MigrateResult {
  board: Record<string, unknown>;
  from: number;
  to: number;
  migrated: boolean;
}

export function migrate(
  raw: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): MigrateResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new MigrationError("board.json is not a JSON object");
  let board = raw as Record<string, unknown>;
  const from = board.schemaVersion;
  if (!Number.isInteger(from) || (from as number) < 1)
    throw new MigrationError("board.json has no valid schemaVersion");
  if ((from as number) > target)
    throw new MigrationError(
      `board.json is schemaVersion ${from}, but this CLI only knows up to ${target}. Update the Loose Ends plugin.`,
    );

  let v = from as number;
  while (v < target) {
    const step = migrations[v];
    if (!step) throw new MigrationError(`no migration from schemaVersion ${v} to ${v + 1}`);
    board = { ...step(structuredClone(board)), schemaVersion: v + 1 };
    v++;
  }
  return { board, from: from as number, to: v, migrated: v !== from };
}
