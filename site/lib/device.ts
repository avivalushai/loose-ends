// The device-code flow behind `board login` (SPEC §9).
//
//   CLI  → start()    gets a user code (shown) and a device code (secret)
//   user → approve()  signs in on the site and approves the user code
//   CLI  → poll()     polls with the device code and receives the token once
//
// Two codes, not one: the user code is read aloud off a terminal and typed into
// a browser, so it must be short — which also makes it guessable. Only the
// secret device code can claim the token.

import crypto from "node:crypto";
import type { DeviceLink, Store } from "./store.js";

export const CODE_TTL_SECONDS = 600;
export const POLL_INTERVAL_SECONDS = 2;

/** Ambiguous characters left out: no O/0, I/1, U (it turns codes into words). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTVWXYZ23456789";

export const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

function userCode(): string {
  const pick = () =>
    Array.from(crypto.randomBytes(4))
      .map((b) => ALPHABET[b % ALPHABET.length])
      .join("");
  return `${pick()}-${pick()}`;
}

export interface StartResult {
  userCode: string;
  deviceCode: string;
  verifyUrl: string;
  interval: number;
  expiresIn: number;
}

export async function start(store: Store, siteUrl: string, now = new Date()): Promise<StartResult> {
  const code = userCode();
  const deviceCode = crypto.randomBytes(32).toString("base64url");
  await store.createDeviceLink({
    code,
    deviceCodeHash: hash(deviceCode),
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CODE_TTL_SECONDS * 1000).toISOString(),
  });
  return {
    userCode: code,
    deviceCode,
    verifyUrl: `${siteUrl.replace(/\/$/, "")}/link?code=${encodeURIComponent(code)}`,
    interval: POLL_INTERVAL_SECONDS,
    expiresIn: CODE_TTL_SECONDS,
  };
}

const expired = (link: DeviceLink, now: Date) => Date.parse(link.expiresAt) < now.getTime();

export type ApproveResult = { ok: true } | { ok: false; reason: "unknown" | "expired" | "used" };

/** Called from the browser, with a signed-in user. */
export async function approve(
  store: Store,
  code: string,
  userId: string,
  decision: "approve" | "deny" = "approve",
  now = new Date(),
): Promise<ApproveResult> {
  const link = await store.deviceLinkByCode(code.trim().toUpperCase());
  if (!link) return { ok: false, reason: "unknown" };
  if (expired(link, now)) return { ok: false, reason: "expired" };
  if (link.status !== "pending") return { ok: false, reason: "used" };
  await store.updateDeviceLink(link.code, { status: decision === "approve" ? "approved" : "denied", userId });
  return { ok: true };
}

export type PollResult =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "expired" }
  | { status: "approved"; token: string; userId: string; email?: string; name?: string };

/**
 * The token is minted here, handed over once, and only its hash is kept —
 * so the database never holds anything that can be replayed.
 */
export async function poll(store: Store, deviceCode: string, now = new Date()): Promise<PollResult> {
  const link = await store.deviceLinkByDeviceHash(hash(deviceCode));
  if (!link) return { status: "expired" }; // unknown device code: say nothing more
  if (link.status === "denied") return { status: "denied" };
  if (expired(link, now)) return { status: "expired" };
  if (link.status !== "approved" || !link.userId) return { status: "pending" };
  if (link.claimedAt) return { status: "expired" }; // a token is handed over exactly once

  const token = `le_${crypto.randomBytes(32).toString("base64url")}`;
  await store.updateDeviceLink(link.code, { tokenHash: hash(token), claimedAt: now.toISOString() });
  const user = await store.user(link.userId);
  return { status: "approved", token, userId: link.userId, email: user?.email, name: user?.name };
}
