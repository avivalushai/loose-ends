// ~/.loose-ends/{settings,auth}.json — the only state outside a project.
// Neither file ever holds board content.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { type Ctx, homeDir, nowIso } from "./context.js";
import { writeJsonAtomic } from "./fsutil.js";

/** Where the site lives. One constant: the domain isn't bought yet. */
export const SITE_URL = "https://looseends.dev";
export const siteUrl = (ctx: Ctx) => (ctx.env.LOOSE_ENDS_SITE || SITE_URL).replace(/\/$/, "");

export interface Settings {
  installId: string;
  telemetry: boolean;
  toldAboutTelemetry?: boolean;
}

export interface Auth {
  token: string;
  userId: string;
  email?: string;
  name?: string;
  site: string;
  savedAt: string;
}

const settingsFile = (ctx: Ctx) => path.join(homeDir(ctx), "settings.json");
const authFile = (ctx: Ctx) => path.join(homeDir(ctx), "auth.json");

function readJson<T>(file: string): Partial<T> {
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf8"));
    return v && typeof v === "object" ? (v as Partial<T>) : {};
  } catch {
    return {};
  }
}

/** Settings, creating the anonymous install id on first use. */
export function readSettings(ctx: Ctx): Settings {
  const raw = readJson<Settings>(settingsFile(ctx));
  const settings: Settings = {
    installId: typeof raw.installId === "string" && raw.installId ? raw.installId : crypto.randomUUID(),
    telemetry: raw.telemetry !== false,
    ...(raw.toldAboutTelemetry ? { toldAboutTelemetry: true } : {}),
  };
  if (raw.installId !== settings.installId) writeSettings(ctx, settings);
  return settings;
}

export function writeSettings(ctx: Ctx, settings: Settings): void {
  writeJsonAtomic(settingsFile(ctx), settings);
}

export const readAuth = (ctx: Ctx): Auth | null => {
  const a = readJson<Auth>(authFile(ctx));
  return a.token && a.userId ? (a as Auth) : null;
};

export function writeAuth(ctx: Ctx, auth: Omit<Auth, "savedAt">): void {
  writeJsonAtomic(authFile(ctx), { ...auth, savedAt: nowIso(ctx) });
  try {
    fs.chmodSync(authFile(ctx), 0o600); // it's a bearer token
  } catch {
    /* best effort */
  }
}

export function clearAuth(ctx: Ctx): boolean {
  try {
    fs.rmSync(authFile(ctx));
    return true;
  } catch {
    return false;
  }
}

/** Said once, on the first command that reports anything. */
export function telemetryNoticeOnce(ctx: Ctx): string | null {
  const s = readSettings(ctx);
  if (s.toldAboutTelemetry || !s.telemetry) return null;
  writeSettings(ctx, { ...s, toldAboutTelemetry: true });
  return "Loose Ends counts which actions happen (names and counts only — never titles, notes or paths). Turn it off with `board telemetry off`.";
}
