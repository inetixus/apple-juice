/**
 * Apple Juice Runtime — official MCP stdio client.
 *
 * Spawns the OFFICIAL Roblox Studio MCP server as a child process and speaks
 * the MCP JSON-RPC protocol over its stdin/stdout (newline-delimited JSON, per
 * the MCP stdio transport). The Runtime relays the dashboard's tool calls into
 * this child and streams responses back — so the dashboard drives Roblox's own
 * first-party tools at localhost speed (R1.1: wrap, don't reimplement).
 */

import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

export interface McpLaunch {
  command: string;
  args: string[];
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

export interface McpStdioOptions {
  launch: McpLaunch;
  /** Per-request timeout (ms). */
  requestTimeoutMs?: number;
  /** Called with each stderr line from the child (logging). */
  onStderr?: (line: string) => void;
  /** Called once if the child exits. */
  onExit?: (code: number | null) => void;
}

/**
 * Minimal JSON-RPC-over-stdio client for the official MCP server. Handles the
 * MCP handshake (initialize), tools/list, and tools/call.
 */
export class McpStdioClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private buffer = "";
  private readonly requestTimeoutMs: number;

  constructor(private readonly opts: McpStdioOptions) {
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 30_000;
  }

  /** Spawn the child and perform the MCP initialize handshake. */
  async start(): Promise<void> {
    if (this.child) return;
    const { command, args } = this.opts.launch;
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    this.child = child;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.onStdout(chunk));

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (this.opts.onStderr) {
        for (const line of chunk.split("\n")) {
          if (line.trim()) this.opts.onStderr(line);
        }
      }
    });

    child.on("exit", (code) => {
      this.child = null;
      // Reject everything still in flight so callers don't hang.
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error("MCP server exited"));
      }
      this.pending.clear();
      this.opts.onExit?.(code);
    });

    // MCP handshake.
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "apple-juice-runtime", version: "1.0.0" },
    });
    this.notify("notifications/initialized", {});
  }

  /** List the tools the official server exposes. */
  async listTools(): Promise<unknown> {
    return this.request("tools/list", {});
  }

  /** Call a tool by name with arguments. */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.request("tools/call", { name, arguments: args });
  }

  /** Whether the child is currently running. */
  isRunning(): boolean {
    return this.child !== null;
  }

  /** Terminate the child process. */
  stop(): void {
    if (this.child) {
      try {
        this.child.kill();
      } catch {
        /* ignore */
      }
      this.child = null;
    }
  }

  // ── internals ──────────────────────────────────────────────────────────

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    // MCP stdio frames are newline-delimited JSON.
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      let msg: { id?: number; result?: unknown; error?: { message?: string } };
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // ignore non-JSON noise
      }
      if (typeof msg.id === "number" && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(msg.error.message ?? "MCP error"));
        else p.resolve(msg.result);
      }
    }
  }

  private send(obj: Record<string, unknown>): void {
    if (!this.child) throw new Error("MCP server not started");
    this.child.stdin.write(JSON.stringify(obj) + "\n");
  }

  private notify(method: string, params: Record<string, unknown>): void {
    this.send({ jsonrpc: "2.0", method, params });
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request '${method}' timed out`));
      }, this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send({ jsonrpc: "2.0", id, method, params });
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}
