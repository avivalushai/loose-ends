// The local server: JSON API + SSE + the bundled UI. It listens on loopback
// only, and board data never leaves this machine.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Ctx } from "../../cli/src/context.js";
import { HttpError, handleApi } from "./api.js";
import { watchBoards } from "./watch.js";

export const DEFAULT_PORT = 4747;

// Works both from source (server/src → ../../ui) and from the CJS bundle (bin/ → ../ui).
declare const __dirname: string | undefined;
function defaultUiDir(): string {
  const here = typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../ui"), path.resolve(here, "../ui")];
  return candidates.find((d) => fs.existsSync(path.join(d, "index.html"))) ?? candidates[0]!;
}

/** The hosted UI may talk to this server; a random web page may not. */
const ALLOWED_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$|^https:\/\/(www\.)?looseends\.dev$/;

/** Reject DNS-rebinding: only loopback hostnames may reach us. */
const ALLOWED_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function cors(req: http.IncomingMessage, res: http.ServerResponse): void {
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
    // Chrome's Private Network Access: a public page reaching localhost must be let in explicitly.
    if (req.headers["access-control-request-private-network"] === "true")
      res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
}

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
};

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 1_000_000) throw new HttpError(413, "body too large");
    chunks.push(c as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "body must be JSON");
  }
}

function serveStatic(res: http.ServerResponse, urlPath: string, uiDir: string): void {
  const rel = urlPath === "/" || urlPath === "/app" ? "index.html" : urlPath.replace(/^\/+/, "");
  const file = path.join(uiDir, rel);
  if (!file.startsWith(uiDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return void res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}

export interface ServerOptions {
  uiDir?: string;
}

export function createServer(ctx: Ctx, options: ServerOptions = {}) {
  const uiDir = options.uiDir ?? defaultUiDir();
  const clients = new Set<http.ServerResponse>();
  const watcher = watchBoards(ctx, (projectId) => {
    for (const res of clients) send(res, "board", { project: projectId });
  });

  const send = (res: http.ServerResponse, event: string, data: unknown) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      clients.delete(res);
    }
  };

  const server = http.createServer((req, res) => {
    void (async () => {
      const urlPath = new URL(req.url ?? "/", "http://localhost").pathname;
      cors(req, res);

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return void res.end();
      }
      if (!ALLOWED_HOST.test(req.headers.host ?? "")) return json(res, 403, { error: "loopback only" });

      if (urlPath === "/api/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        clients.add(res);
        send(res, "hello", { ok: true });
        const beat = setInterval(() => res.write(": ping\n\n"), 25_000).unref();
        req.on("close", () => {
          clearInterval(beat);
          clients.delete(res);
        });
        return;
      }

      if (urlPath.startsWith("/api/")) {
        try {
          const body = req.method === "POST" || req.method === "PATCH" ? await readBody(req) : undefined;
          const result = handleApi(ctx, { method: req.method ?? "GET", path: urlPath, body });
          if (result === undefined) return json(res, 404, { error: `no route ${urlPath}` });
          return json(res, req.method === "POST" ? 201 : 200, result);
        } catch (e) {
          if (e instanceof HttpError) return json(res, e.status, { error: e.message });
          return json(res, 500, { error: (e as Error).message });
        }
      }

      if (req.method !== "GET") return json(res, 405, { error: "use GET" });
      serveStatic(res, urlPath, uiDir);
    })();
  });

  server.on("close", () => {
    watcher.close();
    for (const c of clients) c.end();
    clients.clear();
  });

  return Object.assign(server, { clientCount: () => clients.size });
}

/** Start on `port`, stepping to the next free port if it's taken. */
export function listen(
  ctx: Ctx,
  port = DEFAULT_PORT,
  options: ServerOptions & { tries?: number } = {},
): Promise<{ server: http.Server; url: string }> {
  const tries = options.tries ?? 10;
  return new Promise((resolve, reject) => {
    const server = createServer(ctx, options);
    server.once("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "EADDRINUSE" && tries > 0) resolve(listen(ctx, port + 1, { ...options, tries: tries - 1 }));
      else reject(e);
    });
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const actual = typeof addr === "object" && addr ? addr.port : port;
      resolve({ server, url: `http://localhost:${actual}` });
    });
  });
}
