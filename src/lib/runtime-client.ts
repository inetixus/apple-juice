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
  // (see runtime-native/src/main.rs). Probe that same set.
  48_321, 48_322, 48_323,
];

/**
 * Where the native Runtime binary is published. Binaries are NOT committed to
 * the repo (.gitignore: dist/, public/*.exe) — they live on GitHub Releases.
 * Bump RUNTIME_RELEASE_TAG when cutting a new Runtime release; every download
 * URL is derived from it so there's a single thing to change.
 */
export const RUNTIME_RELEASE_TAG = "v0.6.1";
const RUNTIME_RELEASE_BASE = `https://github.com/inetixus/apple-juice/releases/download/${RUNTIME_RELEASE_TAG}`;

/** The releases landing page (for "other platforms" / manual download). */
export const RUNTIME_RELEASES_PAGE = `https://github.com/inetixus/apple-juice/releases/tag/${RUNTIME_RELEASE_TAG}`;

export type RuntimeOS = "windows" | "macos" | "linux";

/**
 * Release asset file names per OS. These MUST match the asset names produced by
 * .github/workflows/runtime-release.yml and uploaded to the release.
 */
export const RUNTIME_ASSETS: Record<RuntimeOS, string> = {
  windows: "apple-juice-runtime-windows-x64.exe",
  macos: "apple-juice-runtime-macos", // universal (arm64 + x64) via lipo
  linux: "apple-juice-runtime-linux-x64",
};

/** Build the download URL for a given OS from the release tag + asset name. */
export function runtimeDownloadUrl(os: RuntimeOS): string {
  return `${RUNTIME_RELEASE_BASE}/${RUNTIME_ASSETS[os]}`;
}

/**
 * Which platforms actually have a published binary right now. Today only the
 * Windows build ships; add "macos"/"linux" here once the CI workflow
 * (.github/workflows/runtime-release.yml) attaches those assets to the release.
 */
export const RUNTIME_AVAILABLE_PLATFORMS: RuntimeOS[] = ["windows"];

export function isRuntimeAvailable(os: RuntimeOS): boolean {
  return RUNTIME_AVAILABLE_PLATFORMS.includes(os);
}

/** Best-effort browser OS detection (defaults to Windows — the primary build). */
export function detectOS(): RuntimeOS {
  if (typeof navigator === "undefined") return "windows";
  const ua = `${navigator.userAgent} ${navigator.platform ?? ""}`.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";
  return "windows";
}

/** Windows download URL (kept for back-compat / default callers). */
export const RUNTIME_DOWNLOAD_URL = runtimeDownloadUrl("windows");

/**
 * Public VirusTotal report for the published binary, so users can verify the
 * download is clean before running it. Durable SHA-256 permalink (matches the
 * v0.6.1 windows-x64 binary). Update alongside RUNTIME_RELEASE_TAG on each
 * release.
 */
export const RUNTIME_VIRUSTOTAL_URL =
  "https://www.virustotal.com/gui/file/f9313fef309dd274c2b91d50cc226a2d89c043a1c193f257e5ce534157347d02";

/** localStorage keys shared by the connect flow and the dashboard status badge. */
export const RUNTIME_TOKEN_KEY = "aj.runtime.token";
export const RUNTIME_BASE_KEY = "aj.runtime.baseUrl";
/** Set once a pair has ever succeeded, so we can tell "never connected" apart. */
export const RUNTIME_EVER_KEY = "aj.runtime.everConnected";

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
