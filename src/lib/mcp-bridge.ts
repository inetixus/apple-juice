/**
 * MCP Bridge store — the transport layer between our MCP server (which the
 * kiro-cli agent talks to) and the user's Studio plugin.
 *
 * Flow per tool call:
 *   1. MCP server calls enqueueCommand(sessionKey, cmd) -> returns requestId
 *   2. Studio plugin long-polls dequeueCommand(sessionKey) -> gets the cmd
 *   3. Plugin executes it in Studio, calls submitResult(sessionKey, requestId, result)
 *   4. MCP server's awaitResult(sessionKey, requestId) resolves
 *
 * Backed by the same KV store (Turso) so it works across serverless instances.
 * Everything is keyed per session and TTL-bounded.
 */

import { getRedis } from "@/lib/store";

export interface BridgeCommand {
  requestId: string;
  tool: string;
  args: Record<string, unknown>;
  enqueuedAt: number;
}

export interface BridgeResult {
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  completedAt: number;
}

const QUEUE_PREFIX = "mcp:queue:";     // list of pending commands (JSON array)
const RESULT_PREFIX = "mcp:result:";   // a single result by requestId
const TTL = 120; // seconds — commands/results are short-lived
const MAX_QUEUE_LEN = 50; // bound the per-session queue (one in-flight in practice)

function queueKey(sessionKey: string) {
  return `${QUEUE_PREFIX}${sessionKey}`;
}
function resultKey(sessionKey: string, requestId: string) {
  return `${RESULT_PREFIX}${sessionKey}:${requestId}`;
}

function genId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

/** MCP server side: enqueue a command for the plugin to execute. */
export async function enqueueCommand(
  sessionKey: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<string> {
  const redis = getRedis();
  const requestId = genId();
  const cmd: BridgeCommand = { requestId, tool, args, enqueuedAt: Date.now() };

  const raw = await redis.get<string>(queueKey(sessionKey));
  let queue: BridgeCommand[] = [];
  if (raw) {
    try {
      queue = typeof raw === "string" ? JSON.parse(raw) : (raw as BridgeCommand[]);
    } catch {
      queue = [];
    }
  }
  queue.push(cmd);
  // Bound the queue so a runaway/compromised producer can't grow it without
  // limit. The MCP flow is one-command-in-flight per session, so this is well
  // above normal; if exceeded, drop the oldest pending commands.
  if (queue.length > MAX_QUEUE_LEN) {
    queue = queue.slice(queue.length - MAX_QUEUE_LEN);
  }
  await redis.set(queueKey(sessionKey), JSON.stringify(queue), { ex: TTL });
  return requestId;
}

/** Plugin side: pull the next pending command (FIFO), or null if none. */
export async function dequeueCommand(
  sessionKey: string,
): Promise<BridgeCommand | null> {
  const redis = getRedis();
  const raw = await redis.get<string>(queueKey(sessionKey));
  if (!raw) return null;
  let queue: BridgeCommand[] = [];
  try {
    queue = typeof raw === "string" ? JSON.parse(raw) : (raw as BridgeCommand[]);
  } catch {
    return null;
  }
  if (queue.length === 0) return null;
  const next = queue.shift()!;
  await redis.set(queueKey(sessionKey), JSON.stringify(queue), { ex: TTL });
  return next;
}

/** Plugin side: submit the result of an executed command. */
export async function submitResult(
  sessionKey: string,
  result: BridgeResult,
): Promise<void> {
  const redis = getRedis();
  await redis.set(
    resultKey(sessionKey, result.requestId),
    JSON.stringify(result),
    { ex: TTL },
  );
}

/** MCP server side: poll for a result by requestId. */
export async function getResult(
  sessionKey: string,
  requestId: string,
): Promise<BridgeResult | null> {
  const redis = getRedis();
  const raw = await redis.get<string>(resultKey(sessionKey, requestId));
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : (raw as BridgeResult);
  } catch {
    return null;
  }
}

/**
 * MCP server side: wait for a command's result, polling the store until it
 * arrives or the timeout elapses. Resolves with an error result on timeout.
 */
export async function awaitResult(
  sessionKey: string,
  requestId: string,
  timeoutMs = 30000,
  pollMs = 150,
): Promise<BridgeResult> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await getResult(sessionKey, requestId);
    if (r) return r;
    await new Promise((res) => setTimeout(res, pollMs));
  }
  return {
    requestId,
    ok: false,
    error: "Timed out waiting for the Studio plugin to respond.",
    completedAt: Date.now(),
  };
}
