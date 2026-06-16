#!/usr/bin/env node
/**
 * Apple Juice Studio MCP server.
 *
 * A true MCP server (stdio transport) that kiro-cli connects to. Each tool
 * bridges a command into the user's live Roblox Studio session via the Apple
 * Juice web app's MCP bridge endpoints:
 *
 *   kiro-cli  ⇄  THIS server (stdio MCP)  ⇄  /api/mcp/*  ⇄  Studio plugin
 *
 * The model can now do REAL interactive tool calls — read a script, edit it,
 * run a playtest, read the errors, fix — each round-tripping into Studio.
 *
 * Required env:
 *   AJ_SESSION_KEY   — the paired Studio session this run targets
 *   AJ_BRIDGE_URL    — base URL of the web app (e.g. https://apple-juice.online)
 *   AJ_BRIDGE_SECRET — shared secret authorizing the MCP server to enqueue
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SESSION_KEY = process.env.AJ_SESSION_KEY ?? "";
const BRIDGE_URL = (process.env.AJ_BRIDGE_URL ?? "https://apple-juice.online").replace(/\/$/, "");
const BRIDGE_SECRET = process.env.AJ_BRIDGE_SECRET ?? "";

function log(...args: unknown[]) {
  // stderr so it doesn't corrupt the stdio MCP protocol on stdout
  console.error("[studio-mcp]", ...args);
}

/**
 * Run a Studio command through the bridge: enqueue it, then poll for the
 * result. Returns the result payload or throws with a readable error.
 */
async function runStudioCommand(
  tool: string,
  args: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<unknown> {
  if (!SESSION_KEY) throw new Error("AJ_SESSION_KEY is not set");

  // 1. Enqueue
  const enqRes = await fetch(`${BRIDGE_URL}/api/mcp/enqueue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BRIDGE_SECRET}`,
    },
    body: JSON.stringify({ key: SESSION_KEY, tool, args }),
  });
  if (!enqRes.ok) {
    throw new Error(`Failed to enqueue command (${enqRes.status}): ${await enqRes.text()}`);
  }
  const { requestId } = (await enqRes.json()) as { requestId: string };
  if (!requestId) throw new Error("Bridge did not return a requestId");

  // 2. Poll for the result. Use server-held long-polling (?wait) so the result
  //    comes back the instant the plugin posts it, instead of many short polls.
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const wait = Math.max(0, Math.min(remaining, 20000));
    const r = await fetch(
      `${BRIDGE_URL}/api/mcp/poll?key=${encodeURIComponent(SESSION_KEY)}&requestId=${encodeURIComponent(requestId)}&wait=${wait}`,
      { headers: { Authorization: `Bearer ${BRIDGE_SECRET}` } },
    );
    if (r.ok) {
      const body = (await r.json()) as { result?: { ok: boolean; data?: unknown; error?: string } };
      if (body.result) {
        if (body.result.ok) return body.result.data ?? null;
        throw new Error(body.result.error || "Studio command failed");
      }
    }
    // Held request returned empty (hold elapsed with no result) — loop again.
    // Tiny yield avoids a hot loop if the server returns immediately.
    await new Promise((res) => setTimeout(res, 50));
  }
  throw new Error("Timed out waiting for Studio to respond. Is the plugin connected?");
}

function textResult(data: unknown) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "studio_get_tree",
    description:
      "Get the current Roblox Studio project hierarchy (services, folders, scripts, instances) as a path list. Call this first to understand the project.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "studio_search_game_tree",
    description:
      "Explore the instance hierarchy with filters (more focused than studio_get_tree). Filter by path (root), instanceType (ClassName/IsA), keyword (name substring), and depth (1-10).",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        instanceType: { type: "string" },
        keyword: { type: "string" },
        depth: { type: "number" },
      },
    },
  },
  {
    name: "studio_read_script",
    description: "Read the full source of a script by its full path (e.g. 'ServerScriptService.Main').",
    inputSchema: {
      type: "object" as const,
      properties: { path: { type: "string", description: "Full dotted path to the script" } },
      required: ["path"],
    },
  },
  {
    name: "studio_script_search",
    description:
      "Fuzzy-search script NAMES across the project (case-insensitive substring). Returns up to 10 dotted paths. Use to locate a script when you don't know its exact path.",
    inputSchema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Name fragment to search for" } },
      required: ["query"],
    },
  },
  {
    name: "studio_script_grep",
    description:
      "Search the CONTENTS of every script for a string (case-insensitive). Returns up to 50 matches as 'path:line: text'. Use to find where a remote/API/symbol is used or defined.",
    inputSchema: {
      type: "object" as const,
      properties: { pattern: { type: "string", description: "Text to search for across all sources" } },
      required: ["pattern"],
    },
  },
  {
    name: "studio_inspect_instance",
    description:
      "Detailed info about ONE instance: readable properties, custom attributes, child count and child summary. Use before modifying an instance.",
    inputSchema: {
      type: "object" as const,
      properties: { path: { type: "string", description: "Full dotted path to the instance" } },
      required: ["path"],
    },
  },
  {
    name: "studio_multi_edit",
    description:
      "Apply ordered search/replace edits to a script (creates it if missing). Prefer over studio_write_script for changes to existing files. Empty search appends.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Dotted path to the script" },
        type: { type: "string", enum: ["Script", "LocalScript", "ModuleScript"] },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              search: { type: "string" },
              replace: { type: "string" },
            },
            required: ["search", "replace"],
          },
        },
      },
      required: ["path", "edits"],
    },
  },
  {
    name: "studio_start_playtest",
    description: "Start an agent-controlled playtest (does not auto-stop). Poll studio_console_output, then studio_stop_playtest.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "studio_stop_playtest",
    description: "Stop the current agent-controlled playtest; returns a summary of captured errors.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "studio_console_output",
    description: "Return console errors/warnings captured so far in the current/last playtest.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "studio_write_script",
    description:
      "Create or overwrite a script. Provide the COMPLETE source. type is Script | LocalScript | ModuleScript.",
    inputSchema: {
      type: "object" as const,
      properties: {
        parent: { type: "string", description: "Parent path, e.g. 'ServerScriptService'" },
        name: { type: "string" },
        type: { type: "string", enum: ["Script", "LocalScript", "ModuleScript"] },
        code: { type: "string", description: "The full Luau source" },
      },
      required: ["parent", "name", "type", "code"],
    },
  },
  {
    name: "studio_create_instance",
    description: "Create a non-script instance (RemoteEvent, Folder, ScreenGui, Part, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        parent: { type: "string" },
        className: { type: "string" },
        instanceName: { type: "string" },
      },
      required: ["parent", "className", "instanceName"],
    },
  },
  {
    name: "studio_delete",
    description: "Delete an instance by name within a parent path.",
    inputSchema: {
      type: "object" as const,
      properties: { parent: { type: "string" }, name: { type: "string" } },
      required: ["parent", "name"],
    },
  },
  {
    name: "studio_rename",
    description: "Rename an instance. oldPath is the full path; newName is the new name.",
    inputSchema: {
      type: "object" as const,
      properties: { oldPath: { type: "string" }, newName: { type: "string" } },
      required: ["oldPath", "newName"],
    },
  },
  {
    name: "studio_move",
    description: "Move an instance to a new parent. oldPath -> newParentPath.",
    inputSchema: {
      type: "object" as const,
      properties: { oldPath: { type: "string" }, newParentPath: { type: "string" } },
      required: ["oldPath", "newParentPath"],
    },
  },
  {
    name: "studio_run_playtest",
    description:
      "Run a short automated playtest in Studio and return any runtime errors/warnings. Use after writing code to verify it works.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "studio_get_logs",
    description: "Get recent output/console logs from Studio.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

// ── Server wiring ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "apple-juice-studio", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    const data = await runStudioCommand(name, args as Record<string, unknown>);
    return textResult(data);
  } catch (e: any) {
    return {
      content: [{ type: "text" as const, text: `Error: ${e?.message || String(e)}` }],
      isError: true,
    };
  }
});

async function main() {
  log(`starting; session=${SESSION_KEY ? "set" : "MISSING"} bridge=${BRIDGE_URL}`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("connected over stdio");
}

main().catch((e) => {
  log("fatal:", e);
  process.exit(1);
});
