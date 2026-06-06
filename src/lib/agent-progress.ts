/**
 * Parses the raw kiro-cli stdout stream (relayed to the client as `reasoning`
 * deltas) into a clean, structured timeline of the tool calls the agent is
 * actually making — "Reading RoundServer", "Writing ShopClient", "Running a
 * playtest" — instead of dumping truncated raw CLI text into a single line.
 *
 * The CLI emits markers like:
 *   Running tool studio_write_script with the param (from mcp server: studio)
 *   ⋮  {"parent":"ServerScriptService","name":"RoundServer","type":"Script",...}
 *   - Completed in 1.20s
 *
 * and for the filesystem agent:
 *   Using tool: fs_write
 *   Creating: /sessions/x/ServerScriptService/RoundServer.server.lua
 *
 * The parser is idempotent: feed it the full accumulated buffer each time and
 * it returns the complete list of steps discovered so far, with the last
 * un-completed tool marked as in-progress.
 */

import type { ActivityKind, ActivityStep } from "./activity-feed";

/** Pull `"<key>": "<value>"` out of a JSON-ish text segment. */
function field(segment: string, key: string): string | undefined {
  const m = segment.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
  return m ? m[1] : undefined;
}

/** Last segment of a Roblox dot-path or a filesystem path. */
function baseName(p?: string): string | undefined {
  if (!p) return undefined;
  const bySlash = p.includes("/") ? p.split("/").filter(Boolean).pop() : undefined;
  if (bySlash) return bySlash;
  const byDot = p.split(".").filter(Boolean);
  return byDot.length > 1 ? byDot[byDot.length - 1] : p;
}

/** Parent container of a Roblox dot-path or a filesystem path. */
function parentOf(p?: string): string | undefined {
  if (!p) return undefined;
  if (p.includes("/")) {
    const parts = p.split("/").filter(Boolean);
    parts.pop();
    return parts.join("/") || undefined;
  }
  const parts = p.split(".").filter(Boolean);
  if (parts.length <= 1) return undefined;
  parts.pop();
  return parts.join(".");
}

type Mapped = { kind: ActivityKind; label: string; detail?: string };

/** Map a studio_* MCP tool + its arg segment to a friendly step. */
function mapStudioTool(tool: string, seg: string): Mapped | null {
  switch (tool) {
    case "studio_get_tree":
      return { kind: "reading", label: "Scanning project structure" };
    case "studio_read_script": {
      const path = field(seg, "path");
      return { kind: "reading", label: `Reading ${baseName(path) || "script"}`, detail: parentOf(path) };
    }
    case "studio_write_script": {
      const name = field(seg, "name");
      return { kind: "writing", label: `Writing ${name || "script"}`, detail: field(seg, "parent") };
    }
    case "studio_create_instance": {
      const cls = field(seg, "className");
      const name = field(seg, "instanceName");
      return {
        kind: "creating",
        label: `Creating ${cls || "Instance"}${name ? ` "${name}"` : ""}`,
        detail: field(seg, "parent"),
      };
    }
    case "studio_delete": {
      const name = field(seg, "name") || baseName(field(seg, "path"));
      return { kind: "deleting", label: `Deleting ${name || "instance"}`, detail: field(seg, "parent") };
    }
    case "studio_rename":
      return { kind: "moving", label: `Renaming to ${field(seg, "newName") || "…"}`, detail: field(seg, "oldPath") };
    case "studio_move": {
      const old = field(seg, "oldPath");
      return { kind: "moving", label: `Moving ${baseName(old) || "instance"}`, detail: field(seg, "newParentPath") };
    }
    case "studio_run_playtest":
      return { kind: "playtesting", label: "Running a playtest to verify" };
    case "studio_get_logs":
      return { kind: "reading", label: "Checking console logs" };
    default:
      return null;
  }
}

/** Map a filesystem-agent tool line to a friendly step. */
function mapFsTool(tool: string, seg: string): Mapped | null {
  const path =
    seg.match(/(?:Creating|Replacing|Updating|Reading file|Path):\s*(\S+)/)?.[1] ||
    field(seg, "path");
  const name = baseName(path);
  switch (tool) {
    case "fs_read":
      return { kind: "reading", label: name ? `Reading ${name}` : "Reading project files" };
    case "fs_write":
      return { kind: "writing", label: name ? `Writing ${name}` : "Writing files" };
    default:
      return null;
  }
}

const STUDIO_RE = /Running tool\s+(studio_\w+)/g;
const FS_RE = /Using tool:\s*(fs_\w+)/g;

/**
 * Parse the full accumulated CLI buffer into ordered activity steps.
 * `inProgress` = the generation is still streaming, so the final tool with no
 * "Completed in" marker is shown as active rather than done.
 */
export function parseAgentProgress(buffer: string, inProgress = true): ActivityStep[] {
  if (!buffer) return [];

  // Tool activity always precedes the model's final natural-language summary
  // (which the CLI prefixes with "> "). Trim the summary so it never leaks into
  // the feed as a fake "tool".
  let body = buffer;
  const sumIdx = body.search(/\n>\s/);
  if (sumIdx !== -1) body = body.slice(0, sumIdx);

  // Collect every tool marker with its position so we can slice the argument
  // segment that follows each one.
  type Marker = { tool: string; index: number; end: number; fs: boolean };
  const markers: Marker[] = [];
  for (const re of [STUDIO_RE, FS_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      markers.push({ tool: m[1], index: m.index, end: re.lastIndex, fs: re === FS_RE });
    }
  }
  markers.sort((a, b) => a.index - b.index);
  if (markers.length === 0) return [];

  const steps: ActivityStep[] = [];
  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i];
    const next = markers[i + 1];
    const seg = body.slice(cur.end, next ? next.index : undefined);
    const mapped = cur.fs ? mapFsTool(cur.tool, seg) : mapStudioTool(cur.tool, seg);
    if (!mapped) continue;

    // A tool is finished once its segment reports completion or another tool
    // has started after it. Only the trailing, still-open tool stays active.
    const completed = /Completed in|✓|completed|success/i.test(seg);
    const isLast = i === markers.length - 1;
    const done = completed || !isLast || !inProgress;

    // Drop consecutive duplicates (e.g. repeated get_tree polls).
    const prev = steps[steps.length - 1];
    if (prev && prev.label === mapped.label && prev.detail === mapped.detail) {
      if (done) prev.done = true;
      continue;
    }
    steps.push({ kind: mapped.kind, label: mapped.label, detail: mapped.detail, done });
  }

  // Keep the feed focused on recent activity.
  return steps.slice(-14);
}
