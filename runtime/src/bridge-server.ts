/**
 * Apple Juice Runtime — loopback bridge HTTP server.
 *
 * Binds STRICTLY to 127.0.0.1 (never 0.0.0.0) and exposes a tiny JSON API the
 * Apple Juice web dashboard calls to drive the OFFICIAL Roblox Studio MCP server
 * running locally as a child process. Every mutating request is gated by the
 * PairingManager (Origin + Host + per-session token), per R2.3 / R2 §4b.
 *
 * Endpoints:
 *   GET  /health        — liveness + whether the official MCP child is up. (open)
 *   POST /pair          — body {code}; exchanges a pair code for a session token.
 *   GET  /tools         — list official MCP tools. (auth)
 *   POST /call          — body {tool,args}; call a tool. (auth)
 *
 * NOTE on HTTPS→loopback (R2 §4a): a page on https://apple-juice.online cannot
 * call http://127.0.0.1 directly (mixed content + PNA). Production must front
 * this with the cert/PNA strategy (loopback hostname + TLS, or PNA preflight).
 * This server implements CORS + PNA preflight handling; the TLS option is a
 * deployment concern layered on top. Documented in MCP_PARITY_PLAN D.2 §4a.
 */

import http from "http";
import { PairingManager, extractBearer } from "./security.ts";
import { McpStdioClient } from "./mcp-stdio.ts";
import { studioMcpLaunch, officialStudioMcpInstalled } from "./official-mcp.ts";
import { runRuntimeAgent } from "./agent-loop.ts";

export interface BridgeServerOptions {
  /** Loopback port (0 = ephemeral). */
  port?: number;
  allowedOrigins: string[];
  /** VPS base URL for LLM inference proxying (OpenAI-compatible). */
  inferenceBaseUrl: string;
  /** Logger. */
  log?: (msg: string) => void;
}

export interface BridgeHandle {
  port: number;
  pairing: PairingManager;
  /** The current pair code to display in the Runtime UI. */
  pairCode: string;
  close: () => Promise<void>;
}

function readBody(req: http.IncomingMessage, maxBytes = 256 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      data += c.toString("utf8");
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export async function startBridgeServer(
  opts: BridgeServerOptions,
): Promise<BridgeHandle> {
  const log = opts.log ?? (() => {});
  const port = opts.port ?? 0;

  if (!officialStudioMcpInstalled()) {
    log(
      "WARNING: official Roblox Studio MCP not found. Ensure Studio is installed " +
        "and MCP is enabled (https://create.roblox.com/docs/studio/mcp).",
    );
  }

  // Spawn + handshake the official MCP server.
  const mcp = new McpStdioClient({
    launch: studioMcpLaunch(),
    onStderr: (line) => log(`[mcp] ${line}`),
    onExit: (code) => log(`[mcp] exited (code ${code})`),
  });
  try {
    await mcp.start();
    log("Official Roblox Studio MCP connected over stdio.");
  } catch (err) {
    log(`Failed to start official MCP: ${(err as Error).message}`);
  }

  // allowedHosts: only loopback addresses on our actual port (set after listen).
  const pairing = new PairingManager({
    allowedOrigins: opts.allowedOrigins,
    allowedHosts: [], // filled in after we know the port
  });

  const applyCors = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const origin = req.headers.origin;
    if (origin && pairing.checkOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    // Private Network Access preflight (R2 §4a, certless fast path).
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  };

  const json = (res: http.ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };

  const server = http.createServer(async (req, res) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const origin = req.headers.origin ?? null;
    const host = req.headers.host ?? null;

    try {
      // ── open: health ─────────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/health") {
        json(res, 200, {
          ok: true,
          mcpRunning: mcp.isRunning(),
          mcpInstalled: officialStudioMcpInstalled(),
        });
        return;
      }

      // ── pair: exchange a pair code for a token ───────────────────────
      if (req.method === "POST" && url.pathname === "/pair") {
        if (!pairing.checkOrigin(origin)) return json(res, 403, { error: "Forbidden" });
        if (!pairing.checkHost(host)) return json(res, 403, { error: "Forbidden" });
        const body = JSON.parse((await readBody(req)) || "{}");
        const result = pairing.pair(String(body.code ?? ""));
        if (!result.ok) return json(res, 401, { error: "Pairing failed", reason: result.reason });
        return json(res, 200, { token: result.token });
      }

      // ── auth gate for everything below ───────────────────────────────
      const token = extractBearer(req.headers.authorization);
      const auth = pairing.authorize({ origin, host, token });
      if (!auth.ok) {
        log(`Rejected ${req.method} ${url.pathname}: ${auth.reason}`);
        return json(res, 401, { error: "Unauthorized", reason: auth.reason });
      }

      // ── tools/list ───────────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/tools") {
        const tools = await mcp.listTools();
        return json(res, 200, { tools });
      }

      // ── tools/call ───────────────────────────────────────────────────
      if (req.method === "POST" && url.pathname === "/call") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const tool = String(body.tool ?? "");
        const args = (body.args && typeof body.args === "object") ? body.args : {};
        if (!tool) return json(res, 400, { error: "Missing tool" });
        const result = await mcp.callTool(tool, args);
        return json(res, 200, { result });
      }

      // ── agent (Option C): run the LOCAL agent loop, stream progress (SSE) ──
      if (req.method === "POST" && url.pathname === "/agent") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const prompt = String(body.prompt ?? "");
        const sessionKey = String(body.sessionKey ?? "");
        const model = body.model ? String(body.model) : undefined;
        const history = Array.isArray(body.history) ? body.history : [];
        if (!prompt) return json(res, 400, { error: "Missing prompt" });
        if (!sessionKey) return json(res, 400, { error: "Missing sessionKey (needed for inference)" });

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const sse = (event: string, data: unknown) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        const result = await runRuntimeAgent({
          mcp,
          inference: { baseUrl: opts.inferenceBaseUrl, sessionKey, model },
          prompt,
          history,
          onProgress: (p) => sse("progress", p),
        });
        sse("result", result);
        res.write("event: done\ndata: {}\n\n");
        res.end();
        return;
      }

      json(res, 404, { error: "Not found" });
    } catch (err) {
      log(`Request error: ${(err as Error).message}`);
      json(res, 500, { error: "Internal error" });
    }
  });

  await new Promise<void>((resolve, reject) => {
    // Bind STRICTLY to loopback — never 0.0.0.0. If the preferred port is taken,
    // fall back through the dashboard's known candidate ports, then ephemeral.
    const candidates = [port, 48_322, 48_323, 0].filter(
      (p, i, a) => a.indexOf(p) === i,
    );
    let idx = 0;
    const tryListen = () => {
      const p = candidates[idx];
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && idx < candidates.length - 1) {
          idx += 1;
          tryListen();
        } else {
          reject(err);
        }
      });
      server.listen(p, "127.0.0.1", () => resolve());
    };
    tryListen();
  });

  const addr = server.address();
  const boundPort = typeof addr === "object" && addr ? addr.port : port;

  // Now that we know the port, set the expected Host values (anti DNS-rebind).
  pairing.setAllowedHosts([`127.0.0.1:${boundPort}`, `localhost:${boundPort}`]);

  const pairCode = pairing.newPairCode();
  log(`Apple Juice Runtime bridge on http://127.0.0.1:${boundPort}`);
  log(`Pair code: ${pairCode}`);

  // Periodic sweep of expired codes/tokens.
  const sweepTimer = setInterval(() => pairing.sweep(), 60_000);

  return {
    port: boundPort,
    pairing,
    pairCode,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(sweepTimer);
        mcp.stop();
        server.close(() => resolve());
      }),
  };
}
