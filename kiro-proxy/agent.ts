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

/** Map a snapshot script entry to its relative file path. */
export function entryToRelPath(entry: SnapshotEntry): string | null {
  if (!isScriptClass(entry.className)) return null;
  const { dir, base } = splitDotted(entry.path);
  const file = base + SCRIPT_SUFFIX[entry.className];
  return dir ? path.join(dir, file) : file;
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

  const treeLines: string[] = [];
  for (const entry of snapshot) {
    treeLines.push(`${entry.path} [${entry.className}]`);
    const rel = entryToRelPath(entry);
    if (!rel) continue;
    const abs = path.join(sessionDir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, entry.source ?? '', 'utf8');
  }

  await fs.writeFile(
    path.join(sessionDir, 'project_tree.txt'),
    treeLines.join('\n'),
    'utf8',
  );
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
  opts: { libPath: string; apiKey: string; model?: string; timeoutMs?: number },
): Promise<RunResult> {
  const instructions =
    `You are working inside a Roblox project located in the current directory.\n` +
    `File naming (Rojo convention):\n` +
    `  *.server.lua  = a Script (server)\n` +
    `  *.client.lua  = a LocalScript (client)\n` +
    `  *.lua         = a ModuleScript\n` +
    `Folders are Roblox containers. project_tree.txt lists the FULL instance ` +
    `hierarchy, including non-script instances (RemoteEvents, GUIs, Parts).\n` +
    `Read the existing files to understand the project, then make the requested ` +
    `change by creating or editing .lua files in the correct folders using your ` +
    `file tools. Place server logic in ServerScriptService, shared modules in ` +
    `ReplicatedStorage, and client/UI scripts in StarterPlayer or StarterGui.\n` +
    `Write complete, production-ready Luau. Do not ask questions.\n\n` +
    `USER REQUEST:\n${userPrompt}`;

  return new Promise((resolve) => {
    const child = spawn(
      'kiro-cli',
      ['chat', '--no-interactive', '--trust-all-tools', instructions],
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

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, stdout, stderr, code });
    });
  });
}
