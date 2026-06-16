/**
 * Browser-side client for the Apple Juice Runtime (the local .exe).
 *
 * The dashboard uses this to detect a running Runtime on the user's machine,
 * pair with it (R2.3 pair code), and route prompts to the LOCAL agent loop
 * (Option C) — streaming progress back. When no Runtime is present, the
 * dashboard falls back to the cloud (Tier 1) path.
 *
 * NOTE (R2 §4a): reaching http://127.0.0.1 from an https page is subject to
 * mixed-content / Private Network Access rules. This client probes a small set
 * of candidate ports; production may instead use a fixed loopback hostname with
 * TLS. Probing is best-effort and fails closed (→ cloud fallback).
 */

const DEFAULT_CANDIDATE_PORTS = [
  // The Runtime binds to 48321 by default, falling back to 48322/48323 if taken
  // (see runtime/src/index.ts + bridge-server.ts). Probe that same set.
  48_321, 48_322, 48_323,
];

export interface RuntimeHealth {
  ok: boolean;
  mcpRunning: boolean;
  mcpInstalled: boolean;
  baseUrl: string;
}

export type RuntimeProgress =
  | { kind: "thinking"; text: string }
  | { kind: "tool_start"; tool: string }
  | { kind: "tool_end"; tool: string; ok: boolean }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

/** Probe candidate loopback ports for a live Runtime. Returns the first found. */
export async function detectRuntime(
  ports: number[] = DEFAULT_CANDIDATE_PORTS,
  timeoutMs = 600,
): Promise<RuntimeHealth | null> {
  for (const port of ports) {
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${baseUrl}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        if (data?.ok) {
          return {
            ok: true,
            mcpRunning: !!data.mcpRunning,
            mcpInstalled: !!data.mcpInstalled,
            baseUrl,
          };
        }
      }
    } catch {
      /* not on this port — keep probing */
    }
  }
  return null;
}

/** Exchange a pair code (shown by the Runtime) for a session token. */
export async function pairRuntime(
  baseUrl: string,
  code: string,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) return { ok: true, token: data.token };
    return { ok: false, error: data.reason || data.error || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Run a prompt through the LOCAL Runtime agent loop, streaming progress.
 * `sessionKey` is the user's cloud session key (for inference billing on the VPS).
 */
export async function runLocalAgent(
  opts: {
    baseUrl: string;
    token: string;
    sessionKey: string;
    prompt: string;
    model?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  },
  onProgress: (p: RuntimeProgress) => void,
): Promise<{ ok: boolean; message: string; error?: string }> {
  try {
    const res = await fetch(`${opts.baseUrl}/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.token}`,
      },
      body: JSON.stringify({
        prompt: opts.prompt,
        sessionKey: opts.sessionKey,
        model: opts.model,
        history: opts.history ?? [],
      }),
    });
    if (!res.ok || !res.body) {
      return { ok: false, message: "", error: `Runtime HTTP ${res.status}` };
    }

    // Parse the SSE stream (event: progress/result/done).
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let finalMessage = "";
    let ok = true;

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const blocks = buf.split("\n\n");
      buf = blocks.pop() || "";
      for (const block of blocks) {
        let event = "message";
        let dataLine = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
        }
        if (!dataLine) continue;
        let data: unknown;
        try {
          data = JSON.parse(dataLine);
        } catch {
          continue;
        }
        if (event === "progress") {
          onProgress(data as RuntimeProgress);
        } else if (event === "result") {
          const r = data as { message?: string; error?: string };
          finalMessage = r.message ?? finalMessage;
          if (r.error) ok = false;
        }
      }
    }
    return { ok, message: finalMessage || "Done." };
  } catch (err) {
    return { ok: false, message: "", error: err instanceof Error ? err.message : String(err) };
  }
}
