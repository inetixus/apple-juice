/**
 * The Apple Juice agentic loop.
 *
 * A real, server-side, multi-step agent that drives Roblox Studio through the
 * plugin tool bridge. Unlike the legacy single-shot generator (which just
 * emitted a scripts array and *told* the model to "run a playtest"), this loop
 * actually:
 *
 *   1. Explores the project (reads the tree + relevant scripts).
 *   2. Writes / edits code live in Studio.
 *   3. Runs a real playtest and reads the actual runtime errors.
 *   4. If the playtest fails, feeds the errors back to the model and fixes —
 *      repeating until it passes or the iteration budget is exhausted.
 *   5. Returns a final summary.
 *
 * Every tool call is executed against the user's Studio via `runStudioTool`,
 * and progress is streamed to the caller via `onProgress` so the dashboard can
 * render a live tool timeline.
 */

import {
  runLlmTurn,
  parseToolArgs,
  type LlmMessage,
  type LlmToolSchema,
} from "@/lib/agent/llm";
import {
  runPlaytest,
  inspectBuild,
  type StudioTool,
} from "@/lib/agent/studio-bridge";
import {
  getStudioTransport,
  type StudioTransport,
  type StudioCapabilities,
} from "@/lib/agent/transport";
import { renderBuild, type ViewDirection } from "@/lib/agent/render-build";
import { getAppleJuiceUISource, isUIRelatedPrompt } from "@/lib/apple-juice-ui-library";

export type AgentProgress =
  | { kind: "thinking"; text: string }
  | { kind: "tool_start"; tool: string; label: string }
  | { kind: "tool_end"; tool: string; ok: boolean; label: string }
  | { kind: "playtest"; passed: boolean; summary: string }
  | { kind: "vision"; image: string; direction: string; summary: string }
  | { kind: "phase"; phase: string };

export type AgentResult = {
  message: string;
  /** Scripts the agent wrote/changed, for the dashboard's diff/checkpoint UI. */
  scripts: {
    action: string;
    type: string;
    parent: string;
    name: string;
    code: string;
  }[];
  /** Inverse patch: applying these restores the pre-run state of touched
   *  scripts (used to persist a per-prompt revert checkpoint). */
  revert: {
    action: string;
    type: string;
    parent: string;
    name: string;
    code: string;
  }[];
  /** Final playtest verdict, if one ran. */
  playtestPassed: boolean | null;
  iterations: number;
  usage: { inputTokens: number; outputTokens: number };
  /** True when the loop wrapped up early due to the wall-clock budget. */
  timedOut?: boolean;
  error?: string;
};

/** Tool schemas exposed to the model. These mirror the plugin's capabilities. */
const AGENT_TOOLS: LlmToolSchema[] = [
  {
    name: "get_tree",
    description:
      "Return the current Roblox project tree (services, folders, scripts). Call this FIRST to understand the project before changing anything.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "search_game_tree",
    description:
      "Explore the instance hierarchy with filters — far more focused than get_tree for large places. Filter by a starting path, instance type (ClassName/IsA), a name keyword, and a depth limit.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional root to start from, e.g. Workspace.Map. Defaults to all services." },
        instanceType: { type: "string", description: "Optional class filter, e.g. 'RemoteEvent', 'BasePart', 'Script'." },
        keyword: { type: "string", description: "Optional case-insensitive name substring filter." },
        depth: { type: "number", description: "Max depth to descend (1-10, default 3)." },
      },
      required: [],
    },
  },
  {
    name: "read_script",
    description:
      "Read the full source of a script by its path or name. Always read a script before editing it.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Dotted path (e.g. 'ServerScriptService.Combat.Damage') or bare script name.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_script",
    description:
      "Create a new script or completely overwrite an existing one with the COMPLETE corrected source. Never write partial snippets.",
    parameters: {
      type: "object",
      properties: {
        parent: {
          type: "string",
          description:
            "Parent path, e.g. ServerScriptService, ReplicatedStorage, StarterPlayer.StarterPlayerScripts.",
        },
        name: { type: "string", description: "Script name." },
        type: {
          type: "string",
          enum: ["Script", "LocalScript", "ModuleScript"],
          description: "Script class.",
        },
        code: { type: "string", description: "The ENTIRE Luau source." },
      },
      required: ["parent", "name", "type", "code"],
    },
  },
  {
    name: "script_search",
    description:
      "Fuzzy-search script NAMES across the whole project (case-insensitive substring). Returns up to 10 dotted paths. Use during exploration to locate a script when you don't know its exact path.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name fragment to search for, e.g. 'Combat'." },
      },
      required: ["query"],
    },
  },
  {
    name: "script_grep",
    description:
      "Search the CONTENTS of every script for a string (case-insensitive). Returns up to 50 matches, each with a few lines of surrounding context (the '→' line is the hit) so you see the code topography before editing. Use to find where a RemoteEvent is fired, an API is used, or a symbol is defined.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Text to search for across all script sources." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "inspect_instance",
    description:
      "Return detailed info about ONE instance: readable properties, custom attributes, child count, and a child summary. Use before modifying an instance's properties so you reason about real state.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Full dotted path to the instance, e.g. Workspace.Tree.Trunk.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "multi_edit",
    description:
      "Apply an ordered list of targeted search/replace edits to an existing script (creates it if the path doesn't exist). PREFER this over write_script for changes to existing files — it preserves the rest of the file. Each edit's `search` must match exactly enough text to be unique; an empty `search` appends `replace` at the end.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Dotted path to the script, e.g. ServerScriptService.Combat.Damage.",
        },
        type: {
          type: "string",
          enum: ["Script", "LocalScript", "ModuleScript"],
          description: "Script class to use IF the script must be created.",
        },
        edits: {
          type: "array",
          description: "Ordered edits, each applied to the result of the previous.",
          items: {
            type: "object",
            properties: {
              search: { type: "string", description: "Exact text to find (empty = append)." },
              replace: { type: "string", description: "Replacement text." },
            },
            required: ["search", "replace"],
          },
        },
      },
      required: ["path", "edits"],
    },
  },
  {
    name: "create_instance",
    description:
      "Create a single instance with full property support. Use for non-script objects (Folder, RemoteEvent, ScreenGui) AND for individual 3D parts (Part, WedgePart, MeshPart, etc.). Set 3D properties via `properties` — Size/Position as [x,y,z] arrays, Color as [r,g,b] (0-255), Material/Shape as enum-name strings, Anchored as boolean. Create dependencies before the scripts that reference them.",
    parameters: {
      type: "object",
      properties: {
        parent: { type: "string", description: "Parent path, e.g. Workspace or ReplicatedStorage." },
        className: {
          type: "string",
          description: "Roblox class name, e.g. Part, WedgePart, RemoteEvent, Folder.",
        },
        instanceName: { type: "string", description: "Name for the instance." },
        properties: {
          type: "object",
          description:
            'Property map. Examples: {"Size":[4,1,2],"Position":[0,5,0],"Color":[163,162,165],"Material":"Wood","Anchored":true,"Orientation":[0,45,0]}.',
        },
      },
      required: ["parent", "className", "instanceName"],
    },
  },
  {
    name: "build_model",
    description:
      "Build a COMPLETE multi-part 3D model in ONE call — the preferred way to make anything physical (a tree, house, car, sword, character). Provide all parts with their properties; optionally weld them into one rigid Model. Far more efficient than creating parts one by one.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Model name." },
        parent: { type: "string", description: "Parent path (usually Workspace)." },
        parts: {
          type: "array",
          description:
            "Array of parts. Each: {className, name, properties:{Size:[x,y,z], Position:[x,y,z], Color:[r,g,b], Material, Anchored, Shape, Orientation:[x,y,z], Transparency, ...}}.",
          items: {
            type: "object",
            properties: {
              className: { type: "string" },
              name: { type: "string" },
              properties: { type: "object" },
            },
            required: ["className", "properties"],
          },
        },
        weld: {
          type: "boolean",
          description: "Weld all parts to the primary part so the model is rigid. Default true.",
        },
        primaryPart: {
          type: "string",
          description: "Name of the part to use as the model's PrimaryPart (defaults to the first).",
        },
      },
      required: ["name", "parent", "parts"],
    },
  },
  {
    name: "look_at_build",
    description:
      "SEE what you've built. Renders a real image of an instance in the workspace from a camera direction you choose, and returns it for you to visually inspect — check proportions, placement, gaps, floating/sunken parts, and overall shape, then fix issues. Use this after building something physical.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Dotted path to the instance to view, e.g. Workspace.Tree. Defaults to Workspace.",
        },
        direction: {
          type: "string",
          enum: ["iso", "front", "back", "left", "right", "top", "bottom"],
          description:
            "Camera direction. 'iso' (3/4 view) is most informative; use 'front'/'side'/'top' to check a specific axis.",
        },
      },
      required: [],
    },
  },
  {
    name: "set_properties",
    description:
      "Update properties on an EXISTING instance — move, recolor, resize, re-material, rotate, anchor/unanchor. Same property formats as create_instance.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Full dotted path to the instance, e.g. Workspace.Tree.Trunk.",
        },
        properties: {
          type: "object",
          description: 'Properties to set, e.g. {"Color":[255,0,0],"Position":[10,5,0]}.',
        },
      },
      required: ["path", "properties"],
    },
  },
  {
    name: "delete_instance",
    description: "Delete an instance by name within a parent path.",
    parameters: {
      type: "object",
      properties: {
        parent: { type: "string", description: "Parent path." },
        name: { type: "string", description: "Instance name to delete." },
      },
      required: ["parent", "name"],
    },
  },
  {
    name: "run_playtest",
    description:
      "Start a real playtest in Studio (~6s run session) and return any runtime errors/warnings captured. ALWAYS run this after writing or fixing code to verify it actually works.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "start_playtest",
    description:
      "Start an AGENT-CONTROLLED playtest (does not auto-stop). Use when you need to observe behavior over time: start it, poll console_output while it runs, then call stop_playtest. For a simple pass/fail check, use run_playtest instead.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "stop_playtest",
    description: "Stop the current agent-controlled playtest and return a summary of captured errors.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "console_output",
    description:
      "Return the console errors/warnings captured so far during the current (or last) playtest. Poll this while a start_playtest session runs to watch behavior live.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_logs",
    description:
      "Return the most recent runtime errors and warnings captured from the last playtest.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "execute_luau",
    description:
      "Run arbitrary Luau code directly in Studio's edit session and return the result or error. Use for batch operations, one-off queries, runtime inspection, or anything the focused tools don't cover. Keep code minimal and print/return confirmation. (Only available on the local runtime — not the cloud bridge.)",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "The Luau source to execute." },
      },
      required: ["code"],
    },
  },
  {
    name: "finish",
    description:
      "Call this ONLY after the code is written AND a playtest has passed (or you have exhausted reasonable fixes). Provide a concise summary of what you built and its current verified state.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "What was built/changed and the verified result.",
        },
      },
      required: ["summary"],
    },
  },
];

/** Map an agent tool name to the underlying Studio bridge tool + args. */
function toStudioCall(
  name: string,
  args: Record<string, unknown>,
): { tool: StudioTool; args: Record<string, unknown>; label: string } | null {
  switch (name) {
    case "get_tree":
      return { tool: "studio_get_tree", args: {}, label: "Reading project tree" };
    case "search_game_tree":
      return {
        tool: "studio_search_game_tree",
        args: {
          path: args.path,
          instanceType: args.instanceType,
          keyword: args.keyword,
          depth: args.depth,
        },
        label: `Searching game tree${args.instanceType ? ` for ${args.instanceType}` : ""}`,
      };
    case "read_script":
      return {
        tool: "studio_read_script",
        args: { path: args.path },
        label: `Reading ${args.path ?? "script"}`,
      };
    case "script_search":
      return {
        tool: "studio_script_search",
        args: { query: args.query },
        label: `Searching scripts for "${args.query ?? ""}"`,
      };
    case "script_grep":
      return {
        tool: "studio_script_grep",
        args: { pattern: args.pattern },
        label: `Grepping scripts for "${args.pattern ?? ""}"`,
      };
    case "inspect_instance":
      return {
        tool: "studio_inspect_instance",
        args: { path: args.path },
        label: `Inspecting ${args.path ?? "instance"}`,
      };
    case "multi_edit":
      return {
        tool: "studio_multi_edit",
        args: { path: args.path, type: args.type, edits: args.edits ?? [] },
        label: `Editing ${args.path ?? "script"} (${Array.isArray(args.edits) ? args.edits.length : 0} edits)`,
      };
    case "start_playtest":
      return { tool: "studio_start_playtest", args: {}, label: "Starting playtest" };
    case "stop_playtest":
      return { tool: "studio_stop_playtest", args: {}, label: "Stopping playtest" };
    case "console_output":
      return { tool: "studio_console_output", args: {}, label: "Reading console output" };
    case "execute_luau":
      return {
        tool: "studio_execute_luau",
        args: { code: args.code },
        label: "Executing Luau in Studio",
      };
    case "write_script":
      return {
        tool: "studio_write_script",
        args: {
          parent: args.parent,
          name: args.name,
          type: args.type ?? "Script",
          code: args.code ?? "",
        },
        label: `Writing ${args.parent ?? ""}.${args.name ?? "script"}`,
      };
    case "create_instance":
      return {
        tool: "studio_create_instance",
        args: {
          parent: args.parent,
          className: args.className,
          instanceName: args.instanceName,
          properties: args.properties ?? {},
        },
        label: `Creating ${args.className ?? "instance"} "${args.instanceName ?? ""}"`,
      };
    case "build_model":
      return {
        tool: "studio_build_model",
        args: {
          name: args.name,
          parent: args.parent ?? "Workspace",
          parts: args.parts ?? [],
          weld: args.weld,
          primaryPart: args.primaryPart,
        },
        label: `Building model "${args.name ?? "model"}" (${Array.isArray(args.parts) ? args.parts.length : 0} parts)`,
      };
    case "set_properties":
      return {
        tool: "studio_set_properties",
        args: { path: args.path, properties: args.properties ?? {} },
        label: `Updating ${args.path ?? "instance"}`,
      };
    case "delete_instance":
      return {
        tool: "studio_delete",
        args: { parent: args.parent, name: args.name },
        label: `Deleting ${args.name ?? "instance"}`,
      };
    case "get_logs":
      return { tool: "studio_get_logs", args: {}, label: "Reading runtime logs" };
    default:
      return null;
  }
}

const SYSTEM_PROMPT = `You are Apple Juice AI — an autonomous, expert Roblox game developer operating live inside the user's Roblox Studio through a tool bridge.

You do NOT hand the user code to paste. You build the game yourself by calling tools that execute directly in Studio, and you VERIFY your work by running real playtests and fixing whatever breaks.

## Your operating loop (follow it every time)
1. EXPLORE — call get_tree (or search_game_tree with filters for large places), use script_search (find a script by name) and script_grep (find where something is used/defined) to locate relevant code, then read_script the files you'll touch and inspect_instance any object you'll modify. Never guess paths or invent instances that don't exist.
2. PLAN — briefly state what you'll build and how it fits the existing architecture/conventions.
3. BUILD — create instances (RemoteEvents, Folders) BEFORE the scripts that use them. For a NEW script, write_script the COMPLETE, production-ready Luau. For changes to an EXISTING script, prefer multi_edit with targeted search/replace edits so you preserve the rest of the file. No placeholders, no "TODO", no partial snippets.
4. VERIFY — call run_playtest. Read the returned errors.
5. FIX — if the playtest reports errors, diagnose the ROOT CAUSE, read_script the offending file, fix it with multi_edit (or write_script for a full rewrite), and run_playtest again. Repeat until it passes. For behavior you must watch over time, use start_playtest + console_output + stop_playtest instead of the fixed run_playtest.
6. FINISH — only call finish() once the playtest passes (or you've made a genuine, well-reasoned effort to fix remaining issues). Summarize what you built and the verified result.

## Hard rules
- ALWAYS run a playtest after writing or changing code. Code is not "done" until a playtest has run.
- When a playtest fails, actually FIX it — read the error, find the cause, correct the real file. Do not declare success on failing code.
- Server logic → ServerScriptService. LocalScripts → StarterPlayer.StarterPlayerScripts or StarterGui. Never put scripts loose in Workspace.
- Validate RemoteEvent args on the server. Never trust the client.
- Use task.spawn/task.wait (never legacy spawn/wait). Use :WaitForChild with a timeout on the client.

## UI (read carefully — this is where builds usually fail)
- A component library ModuleScript named "AppleJuiceUI" is provided at ReplicatedStorage.AppleJuiceUI. For ANY UI, REQUIRE it and use its API — never hand-roll buttons/frames with raw Instance.new:
  local UI = require(game:GetService("ReplicatedStorage"):WaitForChild("AppleJuiceUI", 10))
  UI.setTheme("Juice")
  Use UI.ShopTemplate / UI.InventoryTemplate / UI.HUDTemplate for common screens, and UI.createScreenGui / UI.Card / UI.Button / UI.TitleBar / UI.ScrollList / UI.Toast for custom ones (the Additional context lists the full API).
- NEVER recreate the AppleJuiceUI module yourself — it already exists; just require it.
- VISIBILITY IS MANDATORY: UI lives in a LocalScript (StarterPlayer.StarterPlayerScripts or StarterGui). The ScreenGui must be parented to the player's PlayerGui and Enabled=true (UI.createScreenGui handles this). If a screen starts hidden behind a keybind, ALSO create a visible on-screen open button — never ship a UI the player can't open.
- After building UI, run_playtest and confirm there are no "Infinite yield on AppleJuiceUI" or nil-index errors; if the screen wouldn't appear, fix it.
- Every script should start with: print("[AppleJuice] Running <ScriptName>...") so playtest logs are traceable.
- Do not spawn 3D Parts into Workspace unless the user explicitly asks for physical objects.
- Match the project's existing frameworks, folder layout, and naming. Don't introduce a new framework unless asked.

## Style
- Write idiomatic, complete, robust Luau. Full implementations only.
- Keep your natural-language turns short — the user sees them as live progress. Let the tools do the talking.

Begin by exploring the project, then build and verify.`;

/**
 * Build-mode addendum. When the user is in Build Mode, the agent's job is
 * primarily to construct 3D models/scenes in the workspace using the building
 * tools, with deep Roblox spatial/geometry knowledge.
 */
const BUILD_MODE_PROMPT = `

## ⛏️ BUILD MODE ACTIVE — you are a master Roblox 3D builder
Your priority is constructing high-quality 3D models and scenes in the workspace, not writing scripts. Use build_model (preferred), create_instance, and set_properties.

### Geometry & coordinates (critical — get this right)
- Roblox is Y-up. Position is the part's CENTER. A part of Size [4,1,2] sitting on the ground at y=0 has Position y = 0.5 (half its height).
- Stack parts by accounting for half-heights: a box of height H on top of a base whose top is at Y sits at Position.y = Y + H/2.
- Use Orientation [x,y,z] in DEGREES for rotation. Use WedgePart for roofs/ramps, CylinderPart/Shape="Cylinder" for poles/trunks, Shape="Ball" for spheres.
- Keep parts intersecting slightly (overlap ~0.05) where they should connect so welds hold and there are no gaps.

### Quality bar
- Build the COMPLETE object with believable proportions and real materials/colors — not a single grey box. A "tree" = a trunk (brown, Wood) + layered leaf canopy (green, Grass/LeafyGrass). A "house" = floor, 4 walls with a door gap, a roof (wedges), maybe windows.
- Set Anchored = true on structural/static parts so they don't fall.
- Choose sensible Material (Wood, Brick, Metal, Slate, Grass, Neon, Glass) and Color [r,g,b] for every part.
- Prefer ONE build_model call containing all parts (welded into a rigid Model) over many create_instance calls.

### Verify (you can SEE your work)
- After building something physical, call look_at_build to render an image of it and LOOK at it. Use direction "iso" for an overall 3/4 view; use "front"/"side"/"top" to check a specific axis. Inspect the image for wrong proportions, gaps, floating or sunken parts, and bad placement, then fix with set_properties or by rebuilding.
- For scripted/interactive builds, also run_playtest. Purely static decor just needs a look_at_build to confirm it looks right.
- If a part ends up in the wrong place, use set_properties to nudge it rather than rebuilding everything.`;

/**
 * Build a system-prompt addendum describing what the active transport can do
 * this session (R2.1). Conditioning the prompt — not just guarding call sites —
 * stops the model from PLANNING around a tool it can't use and dead-ending a
 * turn. Kept short and only mentions constraints worth steering on.
 */
function buildCapabilityNote(caps: StudioCapabilities): string {
  const lines: string[] = [
    "\n\n## Environment capabilities (this session)",
    caps.local
      ? "- You are connected to a LOCAL Studio session (native speed, full tool surface)."
      : "- You are connected via the cloud bridge to the user's Studio.",
  ];
  if (!caps.executeLuau) {
    lines.push(
      "- `execute_luau` (arbitrary Luau) is NOT available here. Do not plan around it — build with the script/instance tools and verify via playtest instead.",
    );
  }
  if (!caps.inputSimulation) {
    lines.push(
      "- Player input simulation (keyboard/mouse/navigation) is NOT available. To test interactions, instrument with prints and read playtest logs, or ask the user to act.",
    );
  }
  if (!caps.screenCapture) {
    lines.push(
      "- True viewport screen capture is NOT available; use `look_at_build` (rendered geometry view) to inspect physical builds.",
    );
  }
  return lines.join("\n");
}

/**
 * Bound a tool result before feeding it back to the model. Crucially, when the
 * data is truncated we APPEND AN EXPLICIT NOTICE — otherwise the model may read
 * a long script, believe it saw all of it, and "rewrite the complete file",
 * silently dropping the unseen tail. The notice tells it the content is partial.
 */
export function boundToolResult(data: string, limit = 24_000): string {
  if (data.length <= limit) return data;
  return (
    data.slice(0, limit) +
    `\n\n[⚠️ OUTPUT TRUNCATED at ${limit} chars — ${data.length} total. This is NOT the full content. ` +
    `If you need the rest (e.g. before overwriting a script), read it in ranges; do NOT assume the omitted portion is empty.]`
  );
}

export type RunAgentOptions = {
  sessionKey: string;
  modelId: string;
  /** Current user request. */
  prompt: string;
  /** Prior conversation turns for memory. */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Extra guidance appended to the system prompt (e.g. UI library docs). */
  extraContext?: string;
  /** Build Mode: prioritize 3D model construction with the building toolset. */
  buildMode?: boolean;
  /** Max model turns before we force a wrap-up. */
  maxIterations?: number;
  /** Max consecutive playtest-fix attempts. */
  maxFixAttempts?: number;
  /** Wall-clock budget (ms). The loop stops starting new turns past this so
   *  the caller always gets a final message before the serverless function
   *  hits its hard `maxDuration` limit. Default 240s (under the 300s route cap). */
  timeBudgetMs?: number;
  onProgress?: (p: AgentProgress) => void;
  signal?: AbortSignal;
};

/**
 * Run the full agentic loop. Drives the model + Studio until the task is
 * verified done, the iteration budget is hit, or an unrecoverable error occurs.
 */
export async function runAgentLoop(
  opts: RunAgentOptions,
): Promise<AgentResult> {
  const {
    sessionKey,
    modelId,
    prompt,
    history = [],
    extraContext = "",
    buildMode = false,
    maxIterations = 16,
    maxFixAttempts = 4,
    timeBudgetMs = 240_000,
    onProgress = () => {},
    signal,
  } = opts;

  const writtenScripts = new Map<
    string,
    { action: string; type: string; parent: string; name: string; code: string }
  >();
  // Inverse patch keyed by "parent.name": the state to restore on revert. The
  // FIRST time the agent touches a script we record what was there before (its
  // prior source, or a delete if it didn't exist) so a later revert is correct
  // even across multiple edits to the same file within one run.
  const revertPatch = new Map<
    string,
    { action: string; type: string; parent: string; name: string; code: string }
  >();

  const usage = { inputTokens: 0, outputTokens: 0 };
  let playtestPassed: boolean | null = null;
  let fixAttempts = 0;
  let timedOut = false;
  const deadline = Date.now() + timeBudgetMs;

  // ── Transport + capability negotiation (R1.2 / R2.1) ──────────────────────
  // The agent talks to Studio through a single transport seam. Capabilities are
  // negotiated ONCE here and used to (a) condition the system prompt below so
  // the model never plans around a tool it can't use, and (b) guard call sites.
  const transport: StudioTransport = getStudioTransport(sessionKey);
  let capabilities: StudioCapabilities;
  try {
    capabilities = await transport.capabilities();
  } catch {
    // Conservative fallback: assume the restricted remote surface.
    capabilities = {
      tools: [],
      executeLuau: false,
      screenCapture: false,
      inputSimulation: false,
      local: false,
    };
  }

  const capabilityNote = buildCapabilityNote(capabilities);

  // A runner bound to the active transport, so playtest/inspect helpers follow
  // the same path as every other tool call (remote bridge today, local later).
  const toolRunner = (tool: StudioTool, toolArgs: Record<string, unknown> = {}) =>
    transport.callTool(tool, toolArgs);

  // Capability-gated tool list (R2.1 / R4.2): only expose tools the active
  // transport can actually execute. execute_luau is local-only, so it never
  // appears to the model on the remote/web path — no special-casing needed.
  const activeTools = AGENT_TOOLS.filter((t) => {
    if (t.name === "execute_luau") return capabilities.executeLuau === true;
    return true;
  });

  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        SYSTEM_PROMPT,
        buildMode ? BUILD_MODE_PROMPT : "",
        capabilityNote,
        extraContext ? `\n\n## Additional context\n${extraContext}` : "",
      ]
        .filter(Boolean)
        .join(""),
    },
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: prompt },
  ];

  let finalMessage = "";
  let iterations = 0;

  // ── UI library guarantee ─────────────────────────────────────────────────
  // The #1 cause of "the UI just doesn't work": the model writes
  // require(ReplicatedStorage:WaitForChild("AppleJuiceUI")) but the library
  // ModuleScript was never actually deployed to the place — so the require
  // yields forever and nothing appears. The legacy path deployed it; the native
  // agent loop did not. Fix: for any UI-related request, deploy/refresh the
  // AppleJuiceUI ModuleScript into ReplicatedStorage BEFORE the model runs, and
  // record it so the result/checkpoint reflects it.
  if (isUIRelatedPrompt(prompt)) {
    try {
      const tree = await transport.callTool("studio_get_tree", {});
      const hasLib =
        tree.ok && typeof tree.data === "string" && tree.data.includes("AppleJuiceUI");
      if (!hasLib) {
        onProgress({ kind: "phase", phase: "Deploying AppleJuiceUI component library" });
        onProgress({
          kind: "tool_start",
          tool: "deploy_ui_library",
          label: "Installing AppleJuiceUI into ReplicatedStorage",
        });
        const libSource = getAppleJuiceUISource();
        const dep = await transport.callTool("studio_write_script", {
          parent: "ReplicatedStorage",
          name: "AppleJuiceUI",
          type: "ModuleScript",
          code: libSource,
        });
        onProgress({
          kind: "tool_end",
          tool: "deploy_ui_library",
          ok: dep.ok,
          label: dep.ok
            ? "AppleJuiceUI ready"
            : "AppleJuiceUI deploy failed",
        });
        if (dep.ok) {
          writtenScripts.set("ReplicatedStorage.AppleJuiceUI", {
            action: "create",
            type: "ModuleScript",
            parent: "ReplicatedStorage",
            name: "AppleJuiceUI",
            code: libSource,
          });
          // Tell the model it's guaranteed present so it requires (not recreates) it.
          messages.push({
            role: "user",
            content:
              "[System] The AppleJuiceUI component library ModuleScript is now deployed at ReplicatedStorage.AppleJuiceUI. REQUIRE it — do NOT recreate it — and build the UI with its API (UI.createScreenGui, UI.ShopTemplate, UI.Button, UI.Card, etc.). Make sure any ScreenGui you create is Enabled and parented to the player's PlayerGui (via StarterGui or PlayerGui) so it is actually visible.",
          });
        }
      }
    } catch {
      /* best-effort — if the bridge is flaky the model still has the docs */
    }
  }

  for (; iterations < maxIterations; iterations++) {
    if (signal?.aborted) {
      return wrap("Generation cancelled.");
    }

    // Wall-clock budget: stop starting new turns once we're close to the
    // function's hard limit. Inject a system note so the model's NEXT (already
    // in-flight allowance) wraps up cleanly with a finish().
    if (Date.now() > deadline) {
      timedOut = true;
      if (!finalMessage) {
        finalMessage =
          playtestPassed === true
            ? "Built and verified, but I hit the time limit before fully finishing. The passing work is applied in Studio."
            : "I ran out of time before fully finishing. The changes so far are applied in Studio — send another message to continue.";
      }
      break;
    }

    const turn = await runLlmTurn({
      modelId,
      messages,
      tools: activeTools,
      signal,
    });
    usage.inputTokens += turn.usage.inputTokens;
    usage.outputTokens += turn.usage.outputTokens;

    if (turn.error) {
      return wrap(`The model call failed: ${turn.error}`, turn.error);
    }

    if (turn.content && turn.content.trim()) {
      onProgress({ kind: "thinking", text: turn.content.trim() });
    }

    // No tool calls → the model is done talking. Treat content as the final
    // answer (models sometimes finish without calling finish()).
    if (turn.toolCalls.length === 0) {
      finalMessage = turn.content.trim() || finalMessage;
      break;
    }

    // Record the assistant turn (with its tool calls) before appending results.
    messages.push({
      role: "assistant",
      content: turn.content || "",
      tool_calls: turn.toolCalls,
    });

    let finished = false;

    for (const call of turn.toolCalls) {
      if (signal?.aborted) return wrap("Generation cancelled.");

      const args = parseToolArgs(call.arguments);

      // ── finish ──────────────────────────────────────────────────────────
      if (call.name === "finish") {
        finalMessage = String(args.summary ?? turn.content ?? "Done.").trim();
        finished = true;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: "Acknowledged. Task closed.",
        });
        break;
      }

      // ── run_playtest ────────────────────────────────────────────────────
      if (call.name === "run_playtest") {
        onProgress({ kind: "phase", phase: "Running playtest" });
        onProgress({
          kind: "tool_start",
          tool: "run_playtest",
          label: "Running playtest in Studio",
        });
        const outcome = await runPlaytest(sessionKey, toolRunner);
        playtestPassed = outcome.passed;
        onProgress({
          kind: "tool_end",
          tool: "run_playtest",
          ok: outcome.passed,
          label: outcome.passed ? "Playtest passed" : "Playtest failed",
        });
        onProgress({
          kind: "playtest",
          passed: outcome.passed,
          summary: outcome.summary,
        });

        if (!outcome.passed) fixAttempts += 1;

        const budgetNote =
          !outcome.passed && fixAttempts >= maxFixAttempts
            ? `\n\nNOTE: You have reached the fix-attempt limit (${maxFixAttempts}). Make a final correction if you are confident, otherwise call finish() and clearly tell the user what remains.`
            : "";

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content:
            (outcome.passed
              ? `PLAYTEST PASSED. ${outcome.summary}`
              : `PLAYTEST FAILED.\n${outcome.summary}\n\nDiagnose the root cause, read the offending script, rewrite the complete corrected source, then run the playtest again.`) +
            budgetNote,
        });
        continue;
      }

      // ── look_at_build (vision) ──────────────────────────────────────────
      if (call.name === "look_at_build") {
        const path = typeof args.path === "string" ? args.path : "Workspace";
        const direction = (typeof args.direction === "string"
          ? args.direction
          : "iso") as ViewDirection;
        onProgress({
          kind: "tool_start",
          tool: "look_at_build",
          label: `Looking at ${path} (${direction})`,
        });
        const inspection = await inspectBuild(sessionKey, path, toolRunner);
        const image =
          inspection.ok && inspection.parts.length > 0
            ? renderBuild(
                inspection.parts.map((p) => ({
                  name: p.name,
                  position: p.position,
                  size: p.size,
                  orientation: p.orientation,
                  color: p.color,
                  transparency: p.transparency,
                })),
                direction,
              )
            : null;
        onProgress({
          kind: "tool_end",
          tool: "look_at_build",
          ok: inspection.ok,
          label: `Looked at ${path}`,
        });

        // Tool result carries the spatial summary (text channel).
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: inspection.ok
            ? `Rendered ${path} from the ${direction} view. ${inspection.summary}` +
              (image
                ? " An image is attached in the next message — inspect it and fix any issues you see."
                : " (No renderable parts found.)")
            : `Could not inspect ${path}: ${inspection.summary}`,
        });

        // If we got an image, attach it in a user message so the vision model
        // can actually look at the build.
        if (image) {
          onProgress({
            kind: "vision",
            image,
            direction,
            summary: inspection.summary,
          });
          messages.push({
            role: "user",
            content: `Here is the ${direction} view of ${path}. Visually inspect it: are the proportions right, parts placed correctly, nothing floating/sunken/clipping? If it looks wrong, fix it; if it looks good, continue.`,
            images: [image],
          });
        }
        continue;
      }

      // ── studio passthrough tools ─────────────────────────────────────────
      const mapped = toStudioCall(call.name, args);
      if (!mapped) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: `Unknown tool "${call.name}".`,
        });
        continue;
      }

      onProgress({ kind: "tool_start", tool: call.name, label: mapped.label });

      // ── Revert capture ──────────────────────────────────────────────────
      // Before the FIRST mutation of a given script, snapshot its prior state
      // so we can build an accurate inverse patch for the dashboard's per-prompt
      // revert. (create → prior source restore, or delete if it didn't exist.)
      if (
        (call.name === "write_script" || call.name === "delete_instance") &&
        args.parent &&
        args.name
      ) {
        const keyName = `${args.parent}.${args.name}`;
        if (!revertPatch.has(keyName)) {
          const prior = await transport.callTool("studio_read_script", {
            path: keyName,
          });
          const existed =
            prior.ok &&
            typeof prior.data === "string" &&
            prior.data.length > 0 &&
            !prior.data.includes("APPLE_JUICE_ERROR_FILE_NOT_FOUND");
          revertPatch.set(
            keyName,
            existed
              ? {
                  action: "create",
                  type: String(args.type ?? "Script"),
                  parent: String(args.parent),
                  name: String(args.name),
                  code: prior.data as string,
                }
              : {
                  action: "delete",
                  type: String(args.type ?? "Script"),
                  parent: String(args.parent),
                  name: String(args.name),
                  code: "",
                },
          );
        }
      }

      // multi_edit identifies its target by dotted `path`; capture revert state
      // the same way, splitting the path into parent + name for the patch.
      if (call.name === "multi_edit" && typeof args.path === "string") {
        const dotted = args.path;
        const lastDot = dotted.lastIndexOf(".");
        const parent = lastDot > 0 ? dotted.slice(0, lastDot) : "ServerScriptService";
        const name = lastDot > 0 ? dotted.slice(lastDot + 1) : dotted;
        if (!revertPatch.has(dotted)) {
          const prior = await transport.callTool("studio_read_script", { path: dotted });
          const existed =
            prior.ok &&
            typeof prior.data === "string" &&
            prior.data.length > 0 &&
            !prior.data.includes("APPLE_JUICE_ERROR_FILE_NOT_FOUND");
          revertPatch.set(
            dotted,
            existed
              ? {
                  action: "create",
                  type: String(args.type ?? "Script"),
                  parent,
                  name,
                  code: prior.data as string,
                }
              : { action: "delete", type: String(args.type ?? "Script"), parent, name, code: "" },
          );
        }
      }

      const res = await transport.callTool(mapped.tool, mapped.args);
      onProgress({
        kind: "tool_end",
        tool: call.name,
        ok: res.ok,
        label: mapped.label,
      });

      // Track written scripts for the dashboard's diff/checkpoint surface.
      if (call.name === "write_script" && res.ok) {
        const keyName = `${args.parent}.${args.name}`;
        writtenScripts.set(keyName, {
          action: "create",
          type: String(args.type ?? "Script"),
          parent: String(args.parent ?? "ServerScriptService"),
          name: String(args.name ?? "Script"),
          code: String(args.code ?? ""),
        });
      }

      // multi_edit changes a script in place; read back the final source so the
      // checkpoint/diff surface reflects the post-edit content.
      if (call.name === "multi_edit" && res.ok && typeof args.path === "string") {
        const dotted = args.path;
        const lastDot = dotted.lastIndexOf(".");
        const parent = lastDot > 0 ? dotted.slice(0, lastDot) : "ServerScriptService";
        const name = lastDot > 0 ? dotted.slice(lastDot + 1) : dotted;
        const after = await transport.callTool("studio_read_script", { path: dotted });
        if (after.ok && typeof after.data === "string") {
          writtenScripts.set(dotted, {
            action: "create",
            type: String(args.type ?? "Script"),
            parent,
            name,
            code: after.data,
          });
        }
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.name,
        content: res.ok
          ? res.data && res.data.length > 0
            ? boundToolResult(res.data)
            : "OK."
          : `ERROR: ${res.error ?? "tool failed"}`,
      });
    }

    if (finished) break;
  }

  if (!finalMessage) {
    finalMessage =
      playtestPassed === true
        ? "Done — built and verified with a passing playtest."
        : playtestPassed === false
          ? "I built the feature but the playtest still reports issues. See the log above."
          : "Done.";
  }

  return wrap(finalMessage);

  function wrap(message: string, error?: string): AgentResult {
    return {
      message,
      scripts: Array.from(writtenScripts.values()),
      revert: Array.from(revertPatch.values()),
      playtestPassed,
      iterations,
      usage,
      timedOut,
      error,
    };
  }
}
