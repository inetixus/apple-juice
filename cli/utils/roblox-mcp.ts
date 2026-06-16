/**
 * Official Roblox Studio MCP server resolution.
 *
 * The Roblox Studio MCP server is built into Roblox Studio and launched as a
 * local process over the stdio transport. This mirrors exactly how downloadable
 * agents (e.g. BloxBot/OpenCode) connect to it: by registering the platform
 * launch command as an MCP server and letting the agent drive Roblox's own
 * first-party tools (script_read, multi_edit, script_grep, search_game_tree,
 * inspect_instance, execute_luau, start_stop_play, console_output, input
 * simulation, etc.).
 *
 * Docs: https://create.roblox.com/docs/studio/mcp
 *   Windows : cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat
 *   macOS   : /Applications/RobloxStudio.app/Contents/MacOS/StudioMCP
 *
 * Because this runs ON the user's machine (CLI / local helper), the connection
 * is pure localhost — sub-millisecond round trips and the full official tool
 * surface, with Roblox owning the safety model for powerful tools like
 * execute_luau.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

export interface McpLaunchCommand {
  /** Executable to spawn. */
  command: string;
  /** Arguments passed to the executable. */
  args: string[];
}

/**
 * Resolve the absolute path to the official Studio MCP launcher for the current
 * platform. Returns the expanded path even if it does not exist yet (use
 * `officialStudioMcpInstalled()` to check existence).
 */
export function studioMcpPath(): string {
  switch (process.platform) {
    case 'win32': {
      // %LOCALAPPDATA%\Roblox\mcp.bat
      const localAppData =
        process.env.LOCALAPPDATA ||
        path.join(os.homedir(), 'AppData', 'Local');
      return path.join(localAppData, 'Roblox', 'mcp.bat');
    }
    case 'darwin':
      return '/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP';
    default:
      // Best-effort: assume a `studio-mcp` binary is on PATH (Linux/other).
      return 'studio-mcp';
  }
}

/**
 * Build the platform launch command for the official Studio MCP server, in the
 * { command, args } shape used by kiro-cli / MCP client agent configs.
 */
export function studioMcpCommand(): McpLaunchCommand {
  const target = studioMcpPath();
  if (process.platform === 'win32') {
    // The Windows entry point is a .bat, so it must be run through cmd.exe.
    return { command: 'cmd.exe', args: ['/c', target] };
  }
  return { command: target, args: [] };
}

/**
 * Whether the official Studio MCP launcher is present on disk. On Linux/other
 * we can't reliably stat a PATH binary here, so we report false and let the
 * caller fall back to the remote bridge.
 */
export function officialStudioMcpInstalled(): boolean {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    return false;
  }
  try {
    return fs.existsSync(studioMcpPath());
  } catch {
    return false;
  }
}

/**
 * Human-readable hint shown when the official server can't be found or a tool
 * call fails — points the user at Studio's MCP toggle and the docs.
 */
export const STUDIO_MCP_HELP =
  'Roblox Studio must be open with the MCP server enabled. In Studio: open ' +
  'Assistant → "…" → Manage MCP Servers → turn on "Enable Studio as MCP ' +
  'server". Docs: https://create.roblox.com/docs/studio/mcp';
