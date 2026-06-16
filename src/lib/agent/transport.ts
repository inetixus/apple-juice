/**
 * StudioTransport — the single seam the agent codes against to reach Roblox
 * Studio, regardless of HOW it gets there.
 *
 * Plan refs: R1.2 (transport, not MCP) + R2.1 (capability provider) + R2.4
 * (build order: this abstraction lands FIRST so every later path — optimized
 * remote bridge, the Apple Juice Runtime local helper, the CLI — plugs into ONE
 * entry point instead of scattering if(local)/else if(remote) across the agent).
 *
 *   Agent
 *     └── StudioTransport
 *           ├── RemoteTransport -> cloud bridge (/api/mcp/* via mcp-bridge)   [today]
 *           └── LocalTransport  -> Apple Juice Runtime -> official Roblox MCP  [later]
 *
 * The agent calls `transport.callTool("multi_edit", args)` and is ignorant of
 * whether it is hitting Vercel, localhost, or stdio. Capabilities are negotiated
 * ONCE per session (R2.1) and used to BOTH guard call sites AND condition the
 * system prompt, so the model never plans around a tool it can't use.
 */

import {
  runStudioTool,
  isStudioBridgeLive,
  type StudioTool,
  type StudioToolResult,
} from "@/lib/agent/studio-bridge";

/**
 * What a transport can DO this session. The remote bridge and the local Runtime
 * diverge (e.g. execute_luau is available locally via the official MCP, but is
 * disabled on our marketplace plugin), so the agent must negotiate this rather
 * than assume. Injected into the system prompt + checked at call sites.
 */
export interface StudioCapabilities {
  /** Tool names this transport can execute. */
  tools: string[];
  /** Arbitrary Luau execution (loadstring). Local/official MCP only today. */
  executeLuau: boolean;
  /** Real viewport screen capture (vs. our server-side geometry renderer). */
  screenCapture: boolean;
  /** Player input simulation (keyboard/mouse/navigation) during playtests. */
  inputSimulation: boolean;
  /** True when running on the user's machine (loopback) vs. the remote bridge. */
  local: boolean;
}

/** The abstraction the agent loop depends on. */
export interface StudioTransport {
  /** Stable id for logging/telemetry ("remote" | "local" | "cli"). */
  readonly kind: string;
  /** Execute a single Studio tool and return a normalized result. Never throws. */
  callTool(
    tool: StudioTool,
    args?: Record<string, unknown>,
  ): Promise<StudioToolResult>;
  /** Negotiate what this transport can do this session (cached by callers). */
  capabilities(): Promise<StudioCapabilities>;
  /** Liveness probe — is the underlying Studio connection usable right now? */
  isLive(timeoutMs?: number): Promise<boolean>;
}

/**
 * The tool surface our OWN plugin supports today (the no-install web path).
 * Kept conservative and explicit so capabilities never over-promise. As Phase 3
 * adds handlers (script_search, script_grep, inspect_instance, multi_edit,
 * split playtest), extend this list.
 */
const REMOTE_TOOLS: StudioTool[] = [
  "studio_get_tree",
  "studio_search_game_tree",
  "studio_read_script",
  "studio_write_script",
  "studio_create_instance",
  "studio_set_properties",
  "studio_build_model",
  "studio_inspect_build",
  "studio_inspect_instance",
  "studio_script_search",
  "studio_script_grep",
  "studio_multi_edit",
  "studio_start_playtest",
  "studio_stop_playtest",
  "studio_console_output",
  "studio_delete",
  "studio_rename",
  "studio_move",
  "studio_run_playtest",
  "studio_get_logs",
];

/**
 * RemoteTransport — the cloud bridge that exists today. Tool calls round-trip
 * through the KV-backed queue (mcp-bridge) to the user's Studio plugin. This is
 * the no-install web path and the current default.
 *
 * It deliberately reports the RESTRICTED capability set: execute_luau and input
 * simulation are NOT available through our marketplace plugin (disabled for
 * compliance), and "screen capture" is our server-side geometry renderer rather
 * than a true viewport grab, so it's reported false here.
 */
export class RemoteTransport implements StudioTransport {
  readonly kind = "remote";

  constructor(private readonly sessionKey: string) {}

  callTool(
    tool: StudioTool,
    args: Record<string, unknown> = {},
  ): Promise<StudioToolResult> {
    return runStudioTool(this.sessionKey, tool, args);
  }

  async capabilities(): Promise<StudioCapabilities> {
    return {
      tools: [...REMOTE_TOOLS],
      executeLuau: false,
      screenCapture: false,
      inputSimulation: false,
      local: false,
    };
  }

  isLive(timeoutMs = 6000): Promise<boolean> {
    return isStudioBridgeLive(this.sessionKey, timeoutMs);
  }
}

/**
 * Factory: pick the transport for a session. Today this always returns the
 * RemoteTransport. When the Apple Juice Runtime (local helper) lands, this is
 * the single place that will detect it and return a LocalTransport instead —
 * the agent loop does not change.
 *
 * AGENT-PLACEMENT GATE (important): the agent loop currently runs SERVER-SIDE
 * (Vercel), which CANNOT reach a user's 127.0.0.1 Runtime. So a server-side
 * LocalTransport cannot connect directly. Wiring the local path therefore
 * requires one of:
 *   (a) running the agent loop client-side (in the dashboard) so it can call
 *       the Runtime's loopback bridge directly, or
 *   (b) the Runtime relaying tool calls (the dashboard talks to the Runtime,
 *       the agent stays remote but tool calls are proxied through the browser).
 * The Runtime helper itself is implemented in /runtime; LocalTransport is the
 * client-side adapter that calls its loopback bridge. Until the placement
 * decision is made + implemented, the factory returns RemoteTransport.
 */
export function getStudioTransport(sessionKey: string): StudioTransport {
  return new RemoteTransport(sessionKey);
}
