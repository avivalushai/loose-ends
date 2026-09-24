import fs from "node:fs";
import http, { type Server } from "node:http";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { projectId } from "../../server/src/projects.js";
import { listen } from "../../server/src/server.js";
import { type Sandbox, sandbox, withBoard } from "./helpers.js";

const servers: Server[] = [];
afterEach(() => {
  while (servers.length) servers.pop()!.close();
});

/** A running server over a sandbox, plus a fetch helper bound to it. */
async function serve(sb: Sandbox) {
  const { server, url } = await listen({ cwd: sb.root, env: sb.env, out: () => {}, err: () => {} }, 0);
  servers.push(server);
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(url + path, init);
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
  const post = (path: string, body: unknown, method = "POST") =>
    call(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { url, server, call, post, id: projectId(sb.root) };
}

const seeded = () => {
  const sb = withBoard();
  sb.board("add", "Save loops", "--status", "active", "--next", "Wire Save", "--step", "Schema");
  sb.board("add", "Mobile layout", "--status", "parked", "--note", "Header overlaps");
  sb.board("add", "Dark mode", "--status", "done");
  return sb;
};

describe("GET /api/projects", () => {
  it("returns every registered project with its counts", async () => {
    const sb = seeded();
    const { call, id } = await serve(sb);
    const { status, body } = await call("/api/projects");
    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id,
      name: "My App",
      key: "APP",
      path: sb.root,
      total: 3,
      parked: 1,
      percentComplete: 33,
      counts: { idea: 0, active: 1, parked: 1, review: 0, done: 1 },
    });
  });

  it("skips projects whose folder is gone and survives a broken board", async () => {
    const sb = seeded();
    const { call } = await serve(sb);
    sb.write({ ...sb.read(), features: [{ key: "APP-1" }] });
    const { body } = await call("/api/projects");
    expect(body[0].error).toContain("invalid");
    expect(body[0].total).toBe(0);

    const empty = sandbox();
    const other = await serve(empty);
    expect((await other.call("/api/projects")).body).toEqual([]);
  });
});

describe("GET /api/projects/:id/board", () => {
  it("serves board.json as-is", async () => {
    const sb = seeded();
    const { call, id } = await serve(sb);
    const { status, body } = await call(`/api/projects/${id}/board`);
    expect(status).toBe(200);
    expect(body).toEqual(sb.read());
  });

  it("404s for an unknown project or route", async () => {
    const { call, id } = await serve(seeded());
    expect((await call("/api/projects/deadbeef/board")).status).toBe(404);
    expect((await call(`/api/projects/${id}/nonsense`)).status).toBe(404);
    expect((await call("/api/nope")).status).toBe(404);
  });
});

describe("writing through the API", () => {
  it("adds a card and records the user as the author", async () => {
    const sb = withBoard();
    const { post, id } = await serve(sb);
    const { status, body } = await post(`/api/projects/${id}/features`, {
      title: "Export as WAV",
      status: "active",
      note: "Pick a sample rate",
      steps: [{ text: "Render buffer" }],
      doneWhen: ["The file opens in Audacity"],
    });
    expect(status).toBe(201);
    expect(body).toMatchObject({
      key: "APP-1",
      title: "Export as WAV",
      status: "active",
      note: "Pick a sample rate",
      steps: [{ text: "Render buffer", done: false }],
      doneWhen: ["The file opens in Audacity"],
      updatedBy: "user",
    });
    expect(sb.read().features).toHaveLength(1);
  });

  it("patches fields and diffs steps", async () => {
    const sb = seeded();
    const { post, id } = await serve(sb);
    const { status, body } = await post(
      `/api/projects/${id}/features/APP-1`,
      { title: "Save loops to library", note: "Wire the Save button", steps: [{ text: "Schema", done: true }, { text: "Save button", done: false }] },
      "PATCH",
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({
      title: "Save loops to library",
      note: "Wire the Save button",
      steps: [{ text: "Schema", done: true }, { text: "Save button", done: false }],
    });
    // removing a step is a step diff too
    const after = await post(`/api/projects/${id}/features/APP-1`, { steps: [{ text: "Save button", done: true }] }, "PATCH");
    expect(after.body.steps).toEqual([{ text: "Save button", done: true }]);
  });

  it("moves status, keeps the CLI's rules, and deletes", async () => {
    const sb = seeded();
    const { post, call, id } = await serve(sb);
    const parked = await post(`/api/projects/${id}/features/APP-1`, { status: "parked", note: "Schema drafted" }, "PATCH");
    expect(parked.body).toMatchObject({ status: "parked", note: "Schema drafted" });
    expect(parked.body.log.at(-1).text).toBe("Parked — Schema drafted");

    // the UI can't break the board's rules: parking with no note is refused
    const bad = await post(`/api/projects/${id}/features/APP-3`, { status: "parked", note: "" }, "PATCH");
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("note");

    expect((await call(`/api/projects/${id}/features/APP-2`, { method: "DELETE" })).status).toBe(200);
    expect(sb.read().features.map((f: any) => f.key)).toEqual(["APP-1", "APP-3"]);
  });

  it("rejects bad input and wrong methods", async () => {
    const sb = seeded();
    const { call, post, id } = await serve(sb);
    expect((await post(`/api/projects/${id}/features`, { title: 42 })).status).toBe(400);
    expect((await post(`/api/projects/${id}/features/APP-1`, { status: "wip" }, "PATCH")).status).toBe(400);
    expect((await post(`/api/projects/${id}/features/APP-99`, { title: "x" }, "PATCH")).status).toBe(404);
    expect((await call(`/api/projects/${id}/features`, { method: "GET" })).status).toBe(405);
    expect((await post(`/api/projects/${id}/features/APP-1`, { title: "x" })).status).toBe(405);
    expect(
      (await call(`/api/projects/${id}/features`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{oops" })).status,
    ).toBe(400);
  });
});

describe("live updates", () => {
  it("pushes an event when a board changes on disk", async () => {
    const sb = seeded();
    const { url, id } = await serve(sb);
    const res = await fetch(url + "/api/events");
    const reader = res.body!.getReader();
    let stream = "";
    void (async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        stream += new TextDecoder().decode(value);
      }
    })();
    const until = async (want: string, ms = 3000) => {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline && !stream.includes(want)) await new Promise((r) => setTimeout(r, 25));
      return stream;
    };

    expect(await until("event: hello")).toContain("event: hello");
    sb.board("add", "New idea from the CLI");
    const text = await until("event: board");
    expect(text).toContain("event: board");
    expect(text).toContain(`"project":"${id}"`);
    await reader.cancel();
  });
});

describe("serving the UI and staying local", () => {
  it("serves the bundled UI at / and 404s outside it", async () => {
    const { url } = await serve(seeded());
    const page = await fetch(url + "/");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toContain("Loose Ends");
    expect((await fetch(url + "/../package.json")).status).toBe(404);
  });

  it("allows the hosted UI and localhost, refuses other origins", async () => {
    const { url } = await serve(seeded());
    const preflight = await fetch(url + "/api/projects", {
      method: "OPTIONS",
      headers: { Origin: "https://looseends.dev", "Access-Control-Request-Method": "GET", "Access-Control-Request-Private-Network": "true" },
    });
    expect(preflight.headers.get("access-control-allow-origin")).toBe("https://looseends.dev");
    expect(preflight.headers.get("access-control-allow-private-network")).toBe("true");
    expect(preflight.headers.get("vary")).toContain("Origin");

    const evil = await fetch(url + "/api/projects", { headers: { Origin: "https://evil.example" } });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("refuses requests that didn't come in on loopback", async () => {
    const { url } = await serve(seeded());
    const port = Number(new URL(url).port);
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { host: "127.0.0.1", port, path: "/api/projects", headers: { Host: "boards.evil.example" } },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", reject);
      req.end();
    });
    expect(status).toBe(403); // DNS rebinding: a public hostname pointed at 127.0.0.1
  });
});

describe("adopting a project from the UI", () => {
  /** A sandbox with a fake Claude Code history for a folder that has no board. */
  const withHistory = () => {
    const sb = sandbox();
    sb.env.LOOSE_ENDS_CLAUDE_HOME = path.join(sb.home, "claude");
    const dir = path.join(sb.env.LOOSE_ENDS_CLAUDE_HOME, "projects", "-encoded-name");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "s.jsonl"), JSON.stringify({ type: "user", cwd: sb.root }) + "\n");
    return sb;
  };

  it("lists folders Claude Code worked in that have no board", async () => {
    const sb = withHistory();
    const { call } = await serve(sb);
    const { status, body } = await call("/api/discover");
    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ path: sb.root, name: "My App" });
  });

  it("creates the board, after which the folder is a project and not a candidate", async () => {
    const sb = withHistory();
    const { call, post } = await serve(sb);
    const { status, body } = await post("/api/projects", { path: sb.root, name: "Owl" });
    expect(status).toBe(201);
    expect(body).toMatchObject({ created: true, project: { name: "Owl" } });
    expect(fs.existsSync(path.join(sb.root, ".board/board.json"))).toBe(true);

    expect((await call("/api/discover")).body).toEqual([]);
    expect((await call("/api/projects")).body.map((p: any) => p.name)).toEqual(["Owl"]);
  });

  it("refuses to create a board in a folder it wasn't told about", async () => {
    const sb = withHistory();
    const { post } = await serve(sb);
    const outside = path.dirname(sb.root);
    const r = await post("/api/projects", { path: outside });
    expect(r.status).toBe(403);
    expect(r.body.error).toContain("Claude Code has worked in");
    expect(fs.existsSync(path.join(outside, ".board"))).toBe(false);

    expect((await post("/api/projects", { path: "/etc" })).status).toBe(403);
    expect((await post("/api/projects", {})).status).toBe(400);
  });
});
