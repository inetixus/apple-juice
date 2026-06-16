/**
 * Local MCP agent runner (BloxBot-style).
 *
 * Runs an agent ON THE USER'S MACHINE connected to the OFFICIAL Roblox Studio
 * MCP server over stdio. This is the local equivalent of the VPS
 * `runMcpAgent` in kiro-proxy/agent.ts, except:
 *   - it launches Roblox's first-party Studio MCP server (studioMcpCommand())
 *     instead of our remote stdio bridge, and
 *   - it runs locally, so tool round-trips are pure localhost (BloxBot speed).
 *
 * The agent driver is `kiro-cli`, which must be installed and on PATH (the same
 * agent the VPS uses). We register the official server in a per-run kiro-cli
 * agent config (~/.kiro/agents/<name>.json) — mirroring the proven pattern in
 * kiro-proxy — then spawn `kiro-cli chat` against it. The model calls Roblox's
 * own tools (search_game_tree, script_read, multi_edit, script_grep,
 * inspect_instance, execute_luau, start_stop_play, console_output, input
 * simulation, …) directly in the live Studio session.
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { studioMcpCommand, officialStudioMcpInstalled } from './roblox-mcp.ts';

export interface LocalMcpResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface LocalMcpOptions {
  /** Kiro API key (shared-credit) OR omit when using a BYOK provider key. */
  apiKey?: string;
  /** Optional explicit model id. */
  model?: string;
  /** UI library docs / extra guidance to append to the system prompt. */
  uiContext?: string;
  /** Prior conversation turns for memory. */
  history?: { role: string; content: string }[];
  /** Wall-clock budget; defaults to 5 minutes. */
  timeoutMs?: number;
  /** Live progress callback (cleaned stdout chunks). */
  onProgress?: (text: string) => void;
}

/** Whether a local `kiro-cli` agent driver is available on PATH. */
export function kiroCliAvailable(): boolean {
  try {
    const probe = spawnSync(
      process.platform === 'win32' ? 'kiro-cli.exe' : 'kiro-cli',
      ['--version'],
      { stdio: 'ignore', timeout: 5000 },
    );
    return probe.status === 0;
  } catch {
    return false;
  }
}

/** True only when BOTH the official Studio MCP server and kiro-cli are present. */
export function localMcpReady(): boolean {
  return officialStudioMcpInstalled() && kiroCliAvailable();
}

/**
 * Extract the agent's closing natural-language summary from raw kiro-cli output,
 * dropping ANSI codes, tool chrome, and the trailing credits footer. Mirrors the
 * heuristic used server-side so the CLI shows a clean reply.
 */
export function extractMcpSummary(raw: string): string {
  if (!raw) return '';
  let s = raw
    .replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '')
    .replace(/[\r\n]+[^\r\n]*Credits:[^\r\n]*Time:[^\r\n]*\s*$/u, '');

  // kiro-cli prints "> " before its final summary; prefer text from the last one.
  const lastPrompt = s.lastIndexOf('\n> ');
  if (lastPrompt !== -1) {
    s = s.slice(lastPrompt + 3);
  } else if (s.startsWith('> ')) {
    s = s.slice(2);
  } else {
    const lines = s.split('\n').filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (/^(↱|⋮|✓|✗|-|\+)\s/.test(t)) return false;
      if (/(using tool:|Reading (file|directory)|Creating:|Replacing:|Updating:|Completed in|operations? processed)/i.test(t)) return false;
      if (/^\d+\s+:/.test(t) || /^\+?\s*\d+:/.test(t)) return false;
      return true;
    });
    s = lines.join('\n');
  }
  return s.trim();
}

/**
 * BloxBot-style system prompt referencing the OFFICIAL Roblox Studio MCP tool
 * names. The agent builds the game live via tools and verifies with playtests.
 */
function buildInstructions(opts: LocalMcpOptions, userPrompt: string): string {
  const historyBlock =
    opts.history && opts.history.length > 0
      ? `## CONVERSATION SO FAR\n` +
        `Earlier turns (context — do not redo finished work):\n` +
        opts.history
          .filter((m) => m && typeof m.content === 'string' && m.content.trim())
          .map(
            (m) =>
              `${m.role === 'assistant' ? 'You' : 'User'}: ${m.content
                .trim()
                .slice(0, 2000)}`,
          )
          .join('\n') +
        `\n\n`
      : '';

  const uiBlock =
    opts.uiContext && opts.uiContext.trim()
      ? `## UI LIBRARY\n${opts.uiContext.trim()}\n\n`
      : '';

  return (
    `You are Apple Juice AI — an expert Roblox game developer working directly ` +
    `inside the user's LIVE Roblox Studio session through the official built-in ` +
    `Studio MCP server. You build games by calling MCP tools that execute in ` +
    `Studio — never by showing code for the user to paste.\n\n` +
    `## Operating loop (every time)\n` +
    `1. EXPLORE — use search_game_tree (depth 5-10), inspect_instance, ` +
    `script_search, and script_grep to understand the project before changing ` +
    `anything. Never guess paths or names.\n` +
    `2. PLAN — briefly state what you'll build and how it fits existing ` +
    `architecture, frameworks, folders, and naming conventions.\n` +
    `3. BUILD — use multi_edit for script changes and execute_luau for instance ` +
    `creation, property changes, and batch operations. Create RemoteEvents/` +
    `Folders before the scripts that reference them.\n` +
    `4. VERIFY — re-read with script_read and confirm DataModel changes with ` +
    `inspect_instance / search_game_tree.\n` +
    `5. DEBUG — instrument code, start_stop_play("start"), read console_output(), ` +
    `probe live state with execute_luau, fix the root cause, repeat, then ` +
    `start_stop_play("stop").\n\n` +
    `## Rules\n` +
    `- Server logic → ServerScriptService. Client/UI → StarterPlayer.` +
    `StarterPlayerScripts or StarterGui. Never put scripts loose in Workspace.\n` +
    `- Idiomatic Luau: types, string interpolation, task.* (never legacy ` +
    `spawn/wait/delay), timed :WaitForChild on the client.\n` +
    `- Server is authoritative; validate all RemoteEvent inputs. Never trust ` +
    `the client.\n` +
    `- Prefer targeted multi_edit over full rewrites. Verify before claiming a ` +
    `fix works.\n` +
    `- If a tool call fails or times out, tell the user Studio must be open with ` +
    `MCP enabled (see https://create.roblox.com/docs/studio/mcp) and stop — do ` +
    `not retry repeatedly.\n\n` +
    uiBlock +
    historyBlock +
    `USER REQUEST (respond to this):\n${userPrompt}`
  );
}

/**
 * Run one local MCP agent turn against the official Studio MCP server.
 * Resolves with the captured result; never throws (errors come back as ok:false).
 */
export function runLocalMcpAgent(
  userPrompt: string,
  opts: LocalMcpOptions = {},
): Promise<LocalMcpResult> {
  const agentName = `aj-local-${Date.now().toString(36)}`;
  const agentsDir = path.join(os.homedir(), '.kiro', 'agents');
  const agentFile = path.join(agentsDir, `${agentName}.json`);
  const studio = studioMcpCommand();

  const agentConfig = {
    name: agentName,
    description: '',
    prompt: null,
    mcpServers: {
      Roblox_Studio: {
        command: studio.command,
        args: studio.args,
        env: {},
        timeout: 30000,
      },
    },
    tools: ['*'],
    toolAliases: {},
    allowedTools: ['*'],
    resources: [],
    hooks: {},
    toolsSettings: {},
    includeMcpJson: false,
    model: opts.model ?? null,
  };

  return new Promise<LocalMcpResult>((resolve) => {
    try {
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(agentFile, JSON.stringify(agentConfig, null, 2), 'utf8');
    } catch (e: any) {
      resolve({
        ok: false,
        stdout: '',
        stderr: `Failed to write agent config: ${e?.message || e}`,
        code: null,
      });
      return;
    }

    const instructions = buildInstructions(opts, userPrompt);
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    if (opts.apiKey) env.KIRO_API_KEY = opts.apiKey;

    const child = spawn(
      process.platform === 'win32' ? 'kiro-cli.exe' : 'kiro-cli',
      [
        'chat',
        '--no-interactive',
        '--agent',
        agentName,
        '--require-mcp-startup',
        '--trust-all-tools',
        instructions,
      ],
      { cwd: process.cwd(), env },
    );

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(
      () => child.kill('SIGKILL'),
      opts.timeoutMs ?? 300000,
    );

    child.stdout.on('data', (d) => {
      const chunk = d.toString();
      stdout += chunk;
      if (opts.onProgress) {
        const cleaned = chunk
          .replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '')
          .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '');
        if (cleaned.trim()) opts.onProgress(cleaned);
      }
    });
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      clearTimeout(timeout);
      try {
        fs.unlinkSync(agentFile);
      } catch {
        /* ignore */
      }
      resolve({ ok: false, stdout, stderr: stderr || String(err), code: null });
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      try {
        fs.unlinkSync(agentFile);
      } catch {
        /* ignore */
      }
      resolve({ ok: code === 0, stdout, stderr, code });
    });
  });
}
