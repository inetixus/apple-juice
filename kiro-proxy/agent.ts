// Stage 2 agentic engine for the Kiro proxy.
//
// Materializes a Roblox project snapshot into real files, runs kiro-cli
// agentically in that directory so it can read/edit with its native tools,
// then diffs the directory to produce the {name,type,parent,code} script
// actions the Studio plugin already knows how to apply.
//
// Naming follows the Rojo convention so paths round-trip cleanly:
//   Script        ->  Name.server.lua
//   LocalScript   ->  Name.client.lua
//   ModuleScript  ->  Name.lua
// Folders / services become directories.

import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface SnapshotEntry {
  /** Dotted Roblox path, e.g. "ServerScriptService.Systems.Combat". */
  path: string;
  className: string;
  /** Source for LuaSourceContainers; omitted/empty for other instances. */
  source?: string;
}

export interface ScriptAction {
  action: 'create' | 'delete';
  type: 'Script' | 'LocalScript' | 'ModuleScript';
  parent: string;
  name: string;
  code: string;
}

/**
 * Non-script instance action (Folder, RemoteEvent, ScreenGui, Part, etc.),
 * mirroring the plugin's create_instance / delete handlers.
 */
export interface InstanceAction {
  action: 'create_instance' | 'delete';
  className: string;
  instanceName: string;
  /** Mirror of instanceName for delete (validator + plugin expect `name`). */
  name: string;
  parent: string;
}

export type AnyAction = ScriptAction | InstanceAction;

/** A single non-script instance entry in the data-model manifest. */
interface ManifestEntry {
  path: string;       // dotted Roblox path
  className: string;
}

const MANIFEST_FILE = 'data_model.json';

/** Roblox service container classes that are never user-created instances. */
const SERVICE_CLASSES = new Set([
  'Workspace', 'ReplicatedFirst', 'ReplicatedStorage', 'ServerScriptService',
  'ServerStorage', 'StarterGui', 'StarterPack', 'StarterPlayer',
  'StarterPlayerScripts', 'StarterCharacterScripts', 'Players', 'Lighting',
  'SoundService', 'Teams', 'TextChatService', 'MaterialService',
]);

const SCRIPT_SUFFIX: Record<string, string> = {
  Script: '.server.lua',
  LocalScript: '.client.lua',
  ModuleScript: '.lua',
};

function isScriptClass(c: string): c is keyof typeof SCRIPT_SUFFIX {
  return c === 'Script' || c === 'LocalScript' || c === 'ModuleScript';
}

/** "ServerScriptService.A.B" -> { dir: "ServerScriptService/A", base: "B" } */
function splitDotted(dotted: string): { dir: string; base: string } {
  const parts = dotted.split('.');
  const base = parts.pop() || 'Unknown';
  return { dir: parts.join(path.sep), base };
}

/**
 * Sanitize a single Roblox path segment so it can't escape the session dir or
 * inject path separators. Strips anything that isn't a safe filename char.
 */
function safeSegment(seg: string): string {
  return seg
    .replace(/[/\\]/g, '')      // no path separators
    .replace(/\.\.+/g, '.')     // collapse .. traversal
    .replace(/[^a-zA-Z0-9 _.\-]/g, '') // conservative filename charset
    .trim()
    .slice(0, 100) || 'Unnamed';
}

/** Whether a resolved path stays inside the session dir (traversal guard). */
function isInside(sessionDir: string, candidate: string): boolean {
  const rel = path.relative(sessionDir, candidate);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Map a snapshot script entry to its relative file path. */
export function entryToRelPath(entry: SnapshotEntry): string | null {
  if (!isScriptClass(entry.className)) return null;
  const { dir, base } = splitDotted(entry.path);
  const safeBase = safeSegment(base);
  const safeDir = dir
    .split(path.sep)
    .filter(Boolean)
    .map(safeSegment)
    .join(path.sep);
  const file = safeBase + SCRIPT_SUFFIX[entry.className];
  return safeDir ? path.join(safeDir, file) : file;
}

/** Reverse: a relative file path -> {name,type,parent}. */
export function relPathToMeta(
  rel: string,
): { name: string; type: ScriptAction['type']; parent: string } | null {
  const norm = rel.split(path.sep).join('.');
  let type: ScriptAction['type'];
  let stem: string;
  if (rel.endsWith('.server.lua')) {
    type = 'Script';
    stem = norm.slice(0, -'.server.lua'.length);
  } else if (rel.endsWith('.client.lua')) {
    type = 'LocalScript';
    stem = norm.slice(0, -'.client.lua'.length);
  } else if (rel.endsWith('.lua')) {
    type = 'ModuleScript';
    stem = norm.slice(0, -'.lua'.length);
  } else {
    return null; // not a script file
  }
  const segs = stem.split('.');
  const name = segs.pop() || 'Unknown';
  const parent = segs.join('.') || 'ServerScriptService';
  return { name, type, parent };
}

/** Recursively wipe and recreate a directory. */
export async function resetDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Write the snapshot to disk as real files, plus a project_tree.txt manifest
 * so the agent has context on non-script instances (RemoteEvents, GUIs, Parts).
 */
export async function materialize(
  sessionDir: string,
  snapshot: SnapshotEntry[],
): Promise<void> {
  await resetDir(sessionDir);

  // Pre-create the standard Roblox service directories so the agent can write
  // into them with fs_write alone (no shell mkdir needed — shell is disabled).
  const STANDARD_SERVICES = [
    'Workspace',
    'ReplicatedFirst',
    'ReplicatedStorage',
    'ServerScriptService',
    'ServerStorage',
    'StarterGui',
    'StarterPack',
    'StarterPlayer',
    'StarterPlayer/StarterPlayerScripts',
    'StarterPlayer/StarterCharacterScripts',
  ];
  for (const svc of STANDARD_SERVICES) {
    await fs.mkdir(path.join(sessionDir, svc), { recursive: true });
  }

  const treeLines: string[] = [];
  let totalBytes = 0;
  const MAX_TOTAL_BYTES = 8 * 1024 * 1024;   // 8 MB of source across the project
  const MAX_FILE_BYTES = 400 * 1024;          // 400 KB per single script
  let written = 0;
  const MAX_FILES = 2000;

  for (const entry of snapshot) {
    if (!entry || typeof entry.path !== 'string') continue;
    treeLines.push(`${entry.path} [${entry.className}]`);
    const rel = entryToRelPath(entry);
    if (!rel) continue;
    if (written >= MAX_FILES) continue;

    const abs = path.join(sessionDir, rel);
    // Traversal guard: never write outside the session dir.
    if (!isInside(sessionDir, abs)) {
      console.warn(`[materialize] skipped out-of-bounds path: ${rel}`);
      continue;
    }

    let source = entry.source ?? '';
    if (source.length > MAX_FILE_BYTES) source = source.slice(0, MAX_FILE_BYTES);
    if (totalBytes + source.length > MAX_TOTAL_BYTES) {
      // Stop materializing source once the budget is exhausted; still record
      // the path in the tree manifest so the agent knows the file exists.
      source = '';
    } else {
      totalBytes += source.length;
    }

    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, source, 'utf8');
    written++;
  }

  await fs.writeFile(
    path.join(sessionDir, 'project_tree.txt'),
    treeLines.join('\n'),
    'utf8',
  );

  // Write the editable data-model manifest of NON-script instances so the
  // agent can add/remove instances (RemoteEvents, GUIs, Folders, Parts) by
  // editing JSON. Script instances are represented as files, not here.
  const manifest: ManifestEntry[] = [];
  for (const entry of snapshot) {
    if (!entry || typeof entry.path !== 'string') continue;
    if (isScriptClass(entry.className)) continue;       // scripts are files
    if (SERVICE_CLASSES.has(entry.className)) continue;  // services aren't instances
    manifest.push({ path: entry.path, className: entry.className });
  }
  await fs.writeFile(
    path.join(sessionDir, MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
}

/** Read and parse the data-model manifest; tolerant of malformed JSON. */
export async function readManifest(sessionDir: string): Promise<ManifestEntry[]> {
  try {
    const raw = await fs.readFile(path.join(sessionDir, MANIFEST_FILE), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.path === 'string' && typeof e.className === 'string')
      .map((e) => ({ path: String(e.path), className: String(e.className) }));
  } catch {
    return [];
  }
}

/** "Workspace.Folder.Coin" -> { parent: "Workspace.Folder", name: "Coin" } */
function splitInstancePath(dotted: string): { parent: string; name: string } {
  const parts = dotted.split('.');
  const name = parts.pop() || 'Instance';
  return { parent: parts.join('.') || 'Workspace', name };
}

/**
 * Diff the instance manifest before vs after to produce plugin instance
 * actions. Added entries -> create_instance; removed -> delete.
 */
export function diffManifest(
  before: ManifestEntry[],
  after: ManifestEntry[],
): InstanceAction[] {
  const key = (e: ManifestEntry) => `${e.path}|${e.className}`;
  const beforeSet = new Set(before.map(key));
  const afterByPath = new Map(after.map((e) => [e.path, e]));
  const actions: InstanceAction[] = [];

  // Created (present after, not before).
  for (const e of after) {
    if (beforeSet.has(key(e))) continue;
    if (SERVICE_CLASSES.has(e.className)) continue;
    const { parent, name } = splitInstancePath(e.path);
    actions.push({ action: 'create_instance', className: e.className, instanceName: name, name, parent });
  }

  // Removed (present before, not after at that path).
  for (const e of before) {
    if (afterByPath.has(e.path)) continue;
    if (SERVICE_CLASSES.has(e.className)) continue;
    const { parent, name } = splitInstancePath(e.path);
    actions.push({ action: 'delete', className: e.className, instanceName: name, name, parent });
  }

  return actions;
}

/** Walk a dir and return a map of relativePath -> file contents (scripts only). */
export async function readScriptFiles(
  sessionDir: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  async function walk(abs: string) {
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(abs, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.name.endsWith('.lua')) {
        const rel = path.relative(sessionDir, full);
        out.set(rel, await fs.readFile(full, 'utf8'));
      }
    }
  }
  await walk(sessionDir);
  return out;
}

/**
 * Diff the project's script files before vs after the agent run and translate
 * the changes into plugin actions. Created/modified files -> "create" (the
 * plugin's create overwrites); removed files -> "delete".
 */
export function diffToScripts(
  before: Map<string, string>,
  after: Map<string, string>,
): ScriptAction[] {
  const actions: ScriptAction[] = [];

  for (const [rel, code] of after) {
    const prev = before.get(rel);
    if (prev === code) continue; // unchanged
    const meta = relPathToMeta(rel);
    if (!meta) continue;
    actions.push({ action: 'create', ...meta, code });
  }

  for (const [rel] of before) {
    if (after.has(rel)) continue;
    const meta = relPathToMeta(rel);
    if (!meta) continue;
    actions.push({ action: 'delete', ...meta, code: '' });
  }

  return actions;
}

/**
 * Build the INVERSE patch — the actions that undo this run. Pushed through the
 * normal sync flow, this restores the project to its pre-prompt state.
 *   - file the agent CREATED  -> delete it
 *   - file the agent MODIFIED -> recreate with the OLD source
 *   - file the agent DELETED  -> recreate with the OLD source
 */
export function diffToRevert(
  before: Map<string, string>,
  after: Map<string, string>,
): ScriptAction[] {
  const actions: ScriptAction[] = [];

  for (const [rel, code] of after) {
    const prev = before.get(rel);
    if (prev === code) continue; // unchanged — nothing to undo
    const meta = relPathToMeta(rel);
    if (!meta) continue;
    if (prev === undefined) {
      // Was created by the agent -> undo = delete
      actions.push({ action: 'delete', ...meta, code: '' });
    } else {
      // Was modified -> undo = restore old source
      actions.push({ action: 'create', ...meta, code: prev });
    }
  }

  for (const [rel, prev] of before) {
    if (after.has(rel)) continue;
    // Was deleted by the agent -> undo = recreate with old source
    const meta = relPathToMeta(rel);
    if (!meta) continue;
    actions.push({ action: 'create', ...meta, code: prev });
  }

  return actions;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Run kiro-cli agentically inside sessionDir. The agent is told the Rojo naming
 * convention and pointed at project_tree.txt for non-script context.
 */
export function runAgent(
  sessionDir: string,
  userPrompt: string,
  opts: {
    libPath: string;
    apiKey: string;
    model?: string;
    timeoutMs?: number;
    onProgress?: (text: string) => void;
  },
): Promise<RunResult> {
  const instructions =
    `You are Apple Juice AI, an expert Roblox game developer working inside a ` +
    `Roblox project that has been materialized as real files in the current directory.\n\n` +
    `## FILE NAMING (Rojo convention)\n` +
    `  *.server.lua  = a Script (server)\n` +
    `  *.client.lua  = a LocalScript (client)\n` +
    `  *.lua         = a ModuleScript\n` +
    `Folders map to Roblox containers/services. project_tree.txt lists the FULL ` +
    `instance hierarchy including non-script instances (RemoteEvents, GUIs, Parts).\n\n` +
    `## NON-SCRIPT INSTANCES (${MANIFEST_FILE})\n` +
    `Non-script instances live in ${MANIFEST_FILE} — a JSON array of {"path","className"}.\n` +
    `To CREATE a RemoteEvent, ScreenGui, Folder, Part, etc., ADD an entry, e.g.\n` +
    `  {"path":"ReplicatedStorage.PurchaseEvent","className":"RemoteEvent"}\n` +
    `To DELETE one, remove its entry. Edit this file with your file tools.\n` +
    `Create RemoteEvents/Folders here, then reference them from your scripts with WaitForChild.\n\n` +
    `## WORKFLOW\n` +
    `1. Explore first: read project_tree.txt and the existing .lua files to understand ` +
    `the project's frameworks, folder conventions, module patterns, and naming style.\n` +
    `2. Match existing patterns — do not introduce new frameworks unless asked.\n` +
    `3. Make the change by creating/editing .lua files in the correct service folders ` +
    `using your file tools. Write the COMPLETE file each time (no partial snippets).\n\n` +
    `## PLACEMENT\n` +
    `- Server logic -> ServerScriptService/  (*.server.lua)\n` +
    `- Shared modules / RemoteEvents consumers -> ReplicatedStorage/  (*.lua)\n` +
    `- Client & UI scripts -> StarterPlayer/StarterPlayerScripts/ or StarterGui/  (*.client.lua)\n` +
    `- Never place scripts directly in Workspace.\n\n` +
    `## LUAU STYLE & SAFETY\n` +
    `- Idiomatic Luau: type annotations, string interpolation, task.* (never legacy spawn/wait/delay).\n` +
    `- :GetService() for services; :WaitForChild("Name", timeout) on the client — NEVER an untimed WaitForChild.\n` +
    `- Server is authoritative; validate all RemoteEvent inputs server-side. Never trust the client.\n` +
    `- Clean up: disconnect connections, destroy clones, cancel threads.\n` +
    `- Every executable Script/LocalScript MUST start with: print("[AppleJuice] Running <Name>...")\n` +
    `- ModuleScripts do not need the print header.\n\n` +
    `## COMPLETENESS (CRITICAL)\n` +
    `- Write FULL, production-ready features. ZERO placeholders, TODOs, or "rest of implementation".\n` +
    `- A UI script must create, style, and wire every element. A purchase flow must check balance, ` +
    `deduct, handle data, and fire remotes. Implement the actual logic yourself.\n` +
    `- Do not ask questions or wait for confirmation — generate the complete solution now.\n\n` +
    `USER REQUEST:\n${userPrompt}`;

  return new Promise((resolve) => {
    const child = spawn(
      'kiro-cli',
      [
        'chat',
        '--no-interactive',
        // Restrict to filesystem tools only — no arbitrary shell execution on
        // the VPS. The agent reads/writes project files and nothing else.
        '--trust-tools=fs_read,fs_write',
        instructions,
      ],
      {
        cwd: sessionDir,
        env: {
          ...process.env,
          KIRO_API_KEY: opts.apiKey,
          LD_LIBRARY_PATH:
            opts.libPath +
            (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''),
        },
      },
    );

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
    }, opts.timeoutMs ?? 240000);

    child.stdout.on('data', (d) => {
      const chunk = d.toString();
      stdout += chunk;
      if (opts.onProgress) {
        // Emit cleaned, human-readable progress lines as they arrive.
        const cleaned = chunk
          .replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '')
          .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '');
        if (cleaned.trim()) opts.onProgress(cleaned);
      }
    });
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, stdout, stderr, code });
    });
  });
}
