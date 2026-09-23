import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { safeProps } from "../src/analytics.js";
import { run } from "../src/cli.js";
import { approve, poll, start } from "../../site/lib/device.js";
import { memoryStore } from "../../site/lib/store.js";
import { type Sandbox, sandbox } from "./helpers.js";

const servers: http.Server[] = [];
afterEach(() => {
  while (servers.length) servers.pop()!.close();
});

/**
 * A stand-in for the site, running the real device-code logic over an
 * in-memory store — so `board login` is tested against the actual protocol.
 */
async function fakeSite(opts: { autoApprove?: boolean; deny?: boolean } = {}) {
  const store = memoryStore();
  await store.upsertUser({ id: "user_1", email: "aviv@example.com", name: "Aviv", createdAt: new Date().toISOString() });
  let siteUrl = "";
  const server = http.createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      const send = (status: number, v: unknown) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(v));
      };
      if (req.url === "/api/device/start") {
        const started = await start(store, siteUrl);
        if (opts.autoApprove || opts.deny) await approve(store, started.userCode, "user_1", opts.deny ? "deny" : "approve");
        return send(200, { ...started, interval: 0.01 });
      }
      if (req.url === "/api/device/poll") return send(200, await poll(store, body.deviceCode));
      send(404, { error: "no route" });
    })();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  servers.push(server);
  siteUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { store, siteUrl };
}

/** `board login` finishes asynchronously; wait for auth.json to appear. */
async function until(check: () => boolean, ms = 4000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline && !check()) await new Promise((r) => setTimeout(r, 20));
  return check();
}

const authFile = (sb: Sandbox) => path.join(sb.home, "auth.json");
const readAuthFile = (sb: Sandbox) => JSON.parse(fs.readFileSync(authFile(sb), "utf8"));

describe("the device-code flow", () => {
  it("hands the token to whoever holds the device code, once", async () => {
    const store = memoryStore();
    await store.upsertUser({ id: "u1", email: "a@b.c", createdAt: new Date().toISOString() });
    const started = await start(store, "https://looseends.dev");

    expect(started.userCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(started.verifyUrl).toBe(`https://looseends.dev/link?code=${started.userCode}`);
    expect(await poll(store, started.deviceCode)).toEqual({ status: "pending" });

    expect(await approve(store, started.userCode.toLowerCase(), "u1")).toEqual({ ok: true });
    const res = await poll(store, started.deviceCode);
    expect(res).toMatchObject({ status: "approved", userId: "u1", email: "a@b.c" });
    expect((res as { token: string }).token).toMatch(/^le_[\w-]{40,}$/);

    // the token is never stored, only its hash — and it can't be claimed twice
    const link = await store.deviceLinkByCode(started.userCode);
    expect(link!.tokenHash).toHaveLength(64);
    expect(JSON.stringify(link)).not.toContain((res as { token: string }).token);
    expect(await poll(store, started.deviceCode)).toEqual({ status: "expired" });
  });

  it("won't approve an unknown, expired or already-used code", async () => {
    const store = memoryStore();
    const started = await start(store, "https://looseends.dev");
    expect(await approve(store, "ZZZZ-ZZZZ", "u1")).toEqual({ ok: false, reason: "unknown" });
    expect(await approve(store, started.userCode, "u1")).toEqual({ ok: true });
    expect(await approve(store, started.userCode, "u2")).toEqual({ ok: false, reason: "used" });

    const old = await start(store, "https://looseends.dev");
    const later = new Date(Date.now() + 11 * 60_000);
    expect(await approve(store, old.userCode, "u1", "approve", later)).toEqual({ ok: false, reason: "expired" });
    expect(await poll(store, old.deviceCode, later)).toEqual({ status: "expired" });
  });

  it("tells the CLI nothing when the device code is wrong, and reports a refusal", async () => {
    const store = memoryStore();
    expect(await poll(store, "not-a-real-device-code")).toEqual({ status: "expired" });

    const started = await start(store, "https://looseends.dev");
    await approve(store, started.userCode, "u1", "deny");
    expect(await poll(store, started.deviceCode)).toEqual({ status: "denied" });
  });

  it("guesses of the short user code can't claim a token", async () => {
    const store = memoryStore();
    const started = await start(store, "https://looseends.dev");
    await approve(store, started.userCode, "u1");
    // knowing the user code is not enough: polling takes the secret device code
    expect(await poll(store, started.userCode)).toEqual({ status: "expired" });
    expect(await poll(store, started.deviceCode)).toMatchObject({ status: "approved" });
  });
});

describe("board login / logout", () => {
  it("signs in and stores the token privately", async () => {
    const { siteUrl } = await fakeSite({ autoApprove: true });
    const sb = sandbox({ LOOSE_ENDS_SITE: siteUrl });
    // login finishes after run() returns, so watch the output as it arrives
    const out: string[] = [];
    const code = run(["login", "--no-open"], { cwd: sb.root, env: sb.env, out: (l) => out.push(l), err: (l) => out.push(l) });
    expect(code).toBe(0);

    expect(await until(() => fs.existsSync(authFile(sb)))).toBe(true);
    expect(out.join("\n")).toMatch(/Your code: [A-Z2-9]{4}-[A-Z2-9]{4}/);
    expect(out.join("\n")).toContain("Signed in as aviv@example.com");
    expect(out.join("\n")).toContain("stay on this machine");
    const auth = readAuthFile(sb);
    expect(auth).toMatchObject({ userId: "user_1", email: "aviv@example.com", site: siteUrl });
    expect(auth.token).toMatch(/^le_/);
    expect(fs.statSync(authFile(sb)).mode & 0o777).toBe(0o600);
  });

  it("reports a refusal instead of hanging", async () => {
    const { siteUrl } = await fakeSite({ deny: true });
    const sb = sandbox({ LOOSE_ENDS_SITE: siteUrl });
    sb.board("login", "--no-open");
    expect(await until(() => process.exitCode === 1)).toBe(true);
    expect(fs.existsSync(authFile(sb))).toBe(false);
    process.exitCode = 0;
  });

  it("logs out, and says so when there was nothing to do", () => {
    const sb = sandbox();
    expect(sb.board("logout").out).toBe("You weren't signed in");
    fs.mkdirSync(sb.home, { recursive: true });
    fs.writeFileSync(authFile(sb), JSON.stringify({ token: "le_x", userId: "u1" }));
    expect(sb.board("logout").out).toBe("Signed out");
    expect(fs.existsSync(authFile(sb))).toBe(false);
  });
});

describe("board telemetry", () => {
  it("is on by default, turns off, and stays off", () => {
    const sb = sandbox();
    expect(sb.board("telemetry").out).toContain("Telemetry on");
    expect(sb.board("telemetry", "off").out).toContain("Telemetry off — nothing is sent.");
    expect(sb.json("telemetry")).toMatchObject({ telemetry: false, signedIn: false });
    expect(sb.board("telemetry", "on").out).toContain("Telemetry on");
    expect(sb.board("telemetry", "sideways").err).toContain("off");
  });

  it("keeps one anonymous install id", () => {
    const sb = sandbox();
    const first = sb.json("telemetry").installId;
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(sb.json("telemetry").installId).toBe(first);
  });
});

describe("what analytics may send", () => {
  it("passes enum values and counts through", () => {
    expect(safeProps({ view: "board", from: "active", to: "parked", by: "claude", projects: 4, cards: 37 })).toEqual({
      view: "board",
      from: "active",
      to: "parked",
      by: "claude",
      projects: 4,
      cards: 37,
    });
  });

  it("drops anything that could carry board content", () => {
    expect(
      safeProps({
        title: "Save loops to library",
        note: "Switched to fix playback drift",
        path: "/Users/aviv/Projects/looper",
        project: "Looper",
        key: "LOOP-3",
        files: ["src/store/library.ts"],
        email: "aviv@example.com",
        // right key, but a value that isn't an enum
        view: "a note about my secret project",
        to: "/Users/aviv/secret",
      }),
    ).toEqual({});
  });

  it("sends nothing at all without a project key", async () => {
    const sb = sandbox();
    const calls: string[] = [];
    const server = http.createServer((req, res) => {
      calls.push(req.url ?? "");
      res.end("{}");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    servers.push(server);
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/capture`;

    const { track } = await import("../src/analytics.js");
    const ctx = { cwd: sb.root, env: { ...sb.env, LOOSE_ENDS_ANALYTICS_URL: url }, out: () => {}, err: () => {} };
    track(ctx, "board_opened");
    await new Promise((r) => setTimeout(r, 150));
    expect(calls).toEqual([]); // no LOOSE_ENDS_POSTHOG_KEY set

    track({ ...ctx, env: { ...ctx.env, LOOSE_ENDS_POSTHOG_KEY: "phc_test" } }, "board_opened");
    await until(() => calls.length > 0);
    expect(calls).toEqual(["/capture"]);
  });

  it("stays quiet once telemetry is off", async () => {
    const sb = sandbox();
    sb.board("telemetry", "off");
    const calls: string[] = [];
    const server = http.createServer((req, res) => {
      calls.push(req.url ?? "");
      res.end("{}");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    servers.push(server);
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/capture`;

    const { track } = await import("../src/analytics.js");
    track(
      { cwd: sb.root, env: { ...sb.env, LOOSE_ENDS_ANALYTICS_URL: url, LOOSE_ENDS_POSTHOG_KEY: "phc_test" }, out: () => {}, err: () => {} },
      "feature_added",
      { by: "claude" },
    );
    await new Promise((r) => setTimeout(r, 200));
    expect(calls).toEqual([]);
  });
});
