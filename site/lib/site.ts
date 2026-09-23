// Site config and the wiring that decides which store and auth are live.
// Everything the deployment needs is an env var; nothing has a secret default.

import { memoryStore, supabaseStore, type Store } from "./store.js";

/** The domain isn't bought yet — change it here and nowhere else. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://looseends.dev";

export const INSTALL_STEPS = [
  "/plugin marketplace add avivalushai/loose-ends",
  "/plugin install loose-ends@loose-ends",
  "/board login",
];

export const isProd = process.env.NODE_ENV === "production";

export const clerkConfigured = () =>
  !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

let memo: Store | null = null;

/**
 * Supabase when it's configured. In development without it, an in-memory store
 * so the flow can be exercised locally; in production that would silently lose
 * sign-ins, so it's an error instead.
 */
export function store(): Store {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return supabaseStore(url, key);
  if (isProd) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production");
  return (memo ??= memoryStore());
}
