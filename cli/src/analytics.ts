// Anonymous usage events (SPEC §7). Event names and counts only.
//
// The rule this file exists to enforce: board content NEVER leaves the machine.
// Properties are filtered against an allowlist of keys whose values are small
// enumerations or numbers — a title, note, path or project name has no way through.

import { type Ctx } from "./context.js";
import { readAuth, readSettings } from "./account.js";

export type EventName =
  | "board_opened"
  | "view_changed"
  | "feature_added"
  | "status_changed"
  | "handoff_clicked"
  | "filter_used"
  | "session_start"
  | "cli_command"
  | "login";

/** Only these keys are ever sent, and only as enums or numbers. */
const ALLOWED = new Set(["view", "from", "to", "by", "type", "command", "projects", "cards", "count", "source"]);
const MAX_LEN = 24;

export function safeProps(props: Record<string, unknown> = {}): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED.has(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    // strings must look like an enum value: short, no spaces, no separators
    else if (typeof v === "string" && v.length <= MAX_LEN && /^[a-z0-9_-]+$/i.test(v)) out[k] = v;
  }
  return out;
}

const HOST = "https://eu.i.posthog.com/i/v0/e/"; // EU region only

/** Fire-and-forget: telemetry must never slow down or fail a board command. */
export function track(ctx: Ctx, event: EventName, props: Record<string, unknown> = {}): void {
  try {
    const settings = readSettings(ctx);
    if (!settings.telemetry) return;
    const key = ctx.env.LOOSE_ENDS_POSTHOG_KEY;
    if (!key) return; // no project key yet: nothing is sent anywhere

    const auth = readAuth(ctx);
    const body = JSON.stringify({
      api_key: key,
      event,
      distinct_id: auth?.userId ?? settings.installId,
      properties: { ...safeProps(props), $lib: "loose-ends-cli" },
      timestamp: new Date().toISOString(),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    void fetch(ctx.env.LOOSE_ENDS_ANALYTICS_URL || HOST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  } catch {
    /* analytics can never break a command */
  }
}
