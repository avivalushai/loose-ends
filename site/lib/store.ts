// The only two tables we have (SPEC §9). No board content, ever.
//
// `users` is written by the auth provider's webhook; `device_links` by the
// device-code flow. An in-memory implementation backs the tests, and the
// Supabase one is a thin wrapper over the same interface.

export interface User {
  id: string;
  email?: string;
  name?: string;
  createdAt: string;
}

export interface DeviceLink {
  code: string; // shown to the user
  deviceCodeHash: string; // what the CLI polls with
  userId?: string;
  tokenHash?: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  expiresAt: string;
  claimedAt?: string;
}

export interface Store {
  createDeviceLink(link: DeviceLink): Promise<void>;
  deviceLinkByCode(code: string): Promise<DeviceLink | null>;
  deviceLinkByDeviceHash(hash: string): Promise<DeviceLink | null>;
  updateDeviceLink(code: string, patch: Partial<DeviceLink>): Promise<void>;
  upsertUser(user: User): Promise<void>;
  user(id: string): Promise<User | null>;
}

export function memoryStore(): Store & { links: Map<string, DeviceLink>; users: Map<string, User> } {
  const links = new Map<string, DeviceLink>();
  const users = new Map<string, User>();
  return {
    links,
    users,
    async createDeviceLink(link) {
      links.set(link.code, link);
    },
    async deviceLinkByCode(code) {
      return links.get(code) ?? null;
    },
    async deviceLinkByDeviceHash(hash) {
      return [...links.values()].find((l) => l.deviceCodeHash === hash) ?? null;
    },
    async updateDeviceLink(code, patch) {
      const l = links.get(code);
      if (l) links.set(code, { ...l, ...patch });
    },
    async upsertUser(user) {
      users.set(user.id, { ...users.get(user.id), ...user });
    },
    async user(id) {
      return users.get(id) ?? null;
    },
  };
}

/** Supabase-backed store. Shapes match the two tables in site/supabase/schema.sql. */
export function supabaseStore(url: string, serviceKey: string): Store {
  const rest = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
  const row = <T>(rows: T[] | null): T | null => (rows && rows.length ? rows[0]! : null);

  const toDb = (l: Partial<DeviceLink>) => ({
    ...(l.code !== undefined && { code: l.code }),
    ...(l.deviceCodeHash !== undefined && { device_code_hash: l.deviceCodeHash }),
    ...(l.userId !== undefined && { user_id: l.userId }),
    ...(l.tokenHash !== undefined && { token_hash: l.tokenHash }),
    ...(l.status !== undefined && { status: l.status }),
    ...(l.createdAt !== undefined && { created_at: l.createdAt }),
    ...(l.expiresAt !== undefined && { expires_at: l.expiresAt }),
    ...(l.claimedAt !== undefined && { claimed_at: l.claimedAt }),
  });
  const fromDb = (r: Record<string, unknown> | null): DeviceLink | null =>
    r
      ? {
          code: r.code as string,
          deviceCodeHash: r.device_code_hash as string,
          userId: (r.user_id as string) ?? undefined,
          tokenHash: (r.token_hash as string) ?? undefined,
          status: r.status as DeviceLink["status"],
          createdAt: r.created_at as string,
          expiresAt: r.expires_at as string,
          claimedAt: (r.claimed_at as string) ?? undefined,
        }
      : null;

  return {
    async createDeviceLink(link) {
      await rest("device_links", { method: "POST", body: JSON.stringify(toDb(link)) });
    },
    async deviceLinkByCode(code) {
      return fromDb(row(await rest(`device_links?code=eq.${encodeURIComponent(code)}&limit=1`)));
    },
    async deviceLinkByDeviceHash(hash) {
      return fromDb(row(await rest(`device_links?device_code_hash=eq.${encodeURIComponent(hash)}&limit=1`)));
    },
    async updateDeviceLink(code, patch) {
      await rest(`device_links?code=eq.${encodeURIComponent(code)}`, { method: "PATCH", body: JSON.stringify(toDb(patch)) });
    },
    async upsertUser(user) {
      await rest("users", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ id: user.id, email: user.email, name: user.name, created_at: user.createdAt }),
      });
    },
    async user(id) {
      const r = row<Record<string, unknown>>(await rest(`users?id=eq.${encodeURIComponent(id)}&limit=1`));
      return r ? { id: r.id as string, email: r.email as string, name: r.name as string, createdAt: r.created_at as string } : null;
    },
  };
}
