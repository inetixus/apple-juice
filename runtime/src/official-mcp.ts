/**
 * Official Roblox Studio MCP launch resolution (Runtime copy).
 * Mirrors cli/utils/roblox-mcp.ts so the Runtime has no cross-package import.
 *   Windows : cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat
 *   macOS   : /Applications/RobloxStudio.app/Contents/MacOS/StudioMCP
 * Docs: https://create.roblox.com/docs/studio/mcp
 */

import fs from "fs";
import os from "os";
import path from "path";
import type { McpLaunch } from "./mcp-stdio.ts";

export function studioMcpPath(): string {
  switch (process.platform) {
    case "win32": {
      const localAppData =
        process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
      return path.join(localAppData, "Roblox", "mcp.bat");
    }
    case "darwin":
      return "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP";
    default:
      return "studio-mcp";
  }
}

export function studioMcpLaunch(): McpLaunch {
  const target = studioMcpPath();
  if (process.platform === "win32") {
    return { command: "cmd.exe", args: ["/c", target] };
  }
  return { command: target, args: [] };
}

export function officialStudioMcpInstalled(): boolean {
  if (process.platform !== "win32" && process.platform !== "darwin") return false;
  try {
    return fs.existsSync(studioMcpPath());
  } catch {
    return false;
  }
}
