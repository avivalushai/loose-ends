import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string) => fs.readFileSync(path.join(repo, p), "utf8");

/** site/lib reads env at call time, so each test stubs what it needs. */
async function site() {
  vi.resetModules();
  return import("../../site/lib/site.js");
}

afterEach(() => vi.unstubAllEnvs());

describe("site configuration", () => {
  it("offers the three install steps from the spec", async () => {
    const { INSTALL_STEPS } = await site();
    expect(INSTALL_STEPS).toEqual([
      "/plugin marketplace add avivalushai/loose-ends",
      "/plugin install loose-ends@loose-ends",
      "/board login",
    ]);
  });

  it("keeps the unbought domain in exactly one place per side", async () => {
    const { SITE_URL } = await site();
    expect(SITE_URL).toBe("https://looseends.dev");
    const cliHits = (read("cli/src/account.ts").match(/looseends\.dev/g) ?? []).length;
    expect(cliHits).toBe(1);
    // and nowhere else in the CLI or server
    for (const f of ["cli/src/cli.ts", "cli/src/commands.ts", "server/src/api.ts"]) expect(read(f)).not.toContain("looseends.dev");
  });

  it("uses the in-memory store in development and refuses it in production", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    const dev = await site();
    expect(dev.store()).toBeTruthy();
    expect(dev.store()).toBe(dev.store()); // one store per process, or sign-ins vanish

    vi.stubEnv("NODE_ENV", "production");
    const prod = await site();
    expect(() => prod.store()).toThrow(/SUPABASE_URL/);
  });

  it("treats auth as configured only when both Clerk keys are present", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    expect((await site()).clerkConfigured()).toBe(false);
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    expect((await site()).clerkConfigured()).toBe(true);
  });
});

describe("the site's promises", () => {
  it("says on the landing page that boards stay on the machine", () => {
    const landing = read("site/app/page.tsx");
    expect(landing).toContain("never leave your machine");
    expect(landing).toContain(".board/board.json");
    expect(read("site/app/privacy/page.tsx")).toContain("localhost:4747"); // the port belongs on the detail page
  });

  it("lists on the privacy page exactly what is stored, and what never is", () => {
    const privacy = read("site/app/privacy/page.tsx");
    for (const stored of ["Email, name, sign-up date", "Counts of actions", "hash of the token"]) expect(privacy).toContain(stored);
    for (const never of ["Card titles", "Notes", "File paths", "Project names"]) expect(privacy).toContain(never);
    expect(privacy).toContain("board telemetry off");
  });

  it("never wires a secret into the client bundle", () => {
    // Anything NEXT_PUBLIC_ ends up in the browser, so the list of them is the whole risk.
    const PUBLIC_OK = new Set(["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]);
    for (const f of ["site/lib/site.ts", "site/lib/store.ts", "site/lib/auth.ts", "site/middleware.ts", "site/.env.example"])
      for (const name of read(f).match(/NEXT_PUBLIC_[A-Z0-9_]+/g) ?? []) expect(PUBLIC_OK, `${f}: ${name}`).toContain(name);
    expect(read("site/.env.example")).toContain("server-side only, never NEXT_PUBLIC_");
  });
});

describe("the hosted UI", () => {
  it("is the same page the local server serves", () => {
    const original = read("ui/index.html");
    const copy = path.join(repo, "site/public/app/index.html");
    if (!fs.existsSync(copy)) return; // built on demand by scripts/sync-ui.mjs
    expect(fs.readFileSync(copy, "utf8")).toBe(original);
  });

  it("talks to localhost when it isn't served from localhost", () => {
    const script = read("ui/index.html");
    expect(script).toContain("LOCAL.test(location.origin)?location.origin:'http://localhost:4747'");
  });
});
