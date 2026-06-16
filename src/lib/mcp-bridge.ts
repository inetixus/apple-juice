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

/**
 * Plugin side, LONG-POLL variant: wait up to `waitMs` for a command to appear,
 * internally fast-polling the KV, and return it the instant it lands (or null
 * if the hold elapses). This collapses the old "client polls every 0.2s + a
 * full HTTP round trip per attempt" into ONE held request — most of the latency
 * win of a blocking pop, without needing Redis. Opt-in: callers that pass
 * waitMs<=0 get the original single-shot behavior.
 *
 * `waitMs` is clamped so a held request can never exceed the serverless budget.
 */
const MAX_LONGPOLL_MS = 25_000;
export async function dequeueCommandWaiting(
  sessionKey: string,
  waitMs: number,
  pollMs = 120,
): Promise<BridgeCommand | null> {
  // Fast path / opt-out: behave exactly like the original single-shot dequeue.
  const immediate = await dequeueCommand(sessionKey);
  if (immediate || waitMs <= 0) return immediate;

  const hold = Math.min(Math.max(0, waitMs), MAX_LONGPOLL_MS);
  const deadline = Date.now() + hold;
  while (Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, pollMs));
    const cmd = await dequeueCommand(sessionKey);
    if (cmd) return cmd;
  }
  return null;
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
 * MCP server side, LONG-POLL variant: hold up to `waitMs` for a result to
 * appear, returning it the instant it lands (or null if the hold elapses).
 * Opt-in mirror of dequeueCommandWaiting for the /api/mcp/poll route, so the
 * MCP server can hold one request instead of issuing many short polls.
 */
export async function getResultWaiting(
  sessionKey: string,
  requestId: string,
  waitMs: number,
  pollMs = 80,
): Promise<BridgeResult | null> {
  const immediate = await getResult(sessionKey, requestId);
  if (immediate || waitMs <= 0) return immediate;

  const hold = Math.min(Math.max(0, waitMs), MAX_LONGPOLL_MS);
  const deadline = Date.now() + hold;
  while (Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, pollMs));
    const r = await getResult(sessionKey, requestId);
    if (r) return r;
  }
  return null;
}

/**
 * MCP server side: wait for a command's result, polling the store until it
 * arrives or the timeout elapses. Resolves with an error result on timeout.
 *
 * Uses ADAPTIVE backoff: a tight initial interval so the common fast result
 * lands quickly, ramping to a calmer interval so a slow tool doesn't hammer the
 * KV. (`pollMs` sets the FLOOR; the original fixed-150ms behavior is preserved
 * as a sensible ceiling.)
 */
export async function awaitResult(
  sessionKey: string,
  requestId: string,
  timeoutMs = 30000,
  pollMs = 60,
): Promise<BridgeResult> {
  const deadline = Date.now() + timeoutMs;
  let interval = Math.max(20, pollMs);
  const maxInterval = 200;
  while (Date.now() < deadline) {
    const r = await getResult(sessionKey, requestId);
    if (r) return r;
    await new Promise((res) => setTimeout(res, interval));
    // Ramp up gently toward maxInterval so slow tools don't spin the KV.
    interval = Math.min(maxInterval, Math.round(interval * 1.3));
  }
  return {
    requestId,
    ok: false,
    error: "Timed out waiting for the Studio plugin to respond.",
    completedAt: Date.now(),
  };
}
