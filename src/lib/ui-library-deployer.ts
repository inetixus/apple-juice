import { readFileSync } from "fs";
import { join } from "path";

export interface DeploymentScript {
  action: "create" | "create_instance";
  type?: string;
  className?: string;
  instanceName?: string;
  parent: string;
  name: string;
  code?: string;
}

let _cachedDeploymentScripts: DeploymentScript[] | null = null;

function parseCompetitorFile(filePath: string): Map<string, string> {
  const scripts = new Map<string, string>();
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return scripts;
  }
  const pathRegex = /^--+\s*\n-- PATH:\s*(.+?)\s*\n--+\s*$/gm;
  const matches = [...content.matchAll(pathRegex)];
  for (let i = 0; i < matches.length; i++) {
    const path = matches[i][1].trim();
    const startIdx = matches[i].index! + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    const code = content.substring(startIdx, endIdx).trim();
    if (code.length > 0) scripts.set(path, code);
  }
  return scripts;
}

/**
 * Builds the full multi-file library deployment for AppleJuiceUI.
 * This includes core components, themes, and dependencies (Fusion, OnyxUI).
 */
function buildDeploymentScripts(scripts: Map<string, string>): DeploymentScript[] {
  const deployments: DeploymentScript[] = [];

  // 1. Create Base Folder structure (Renamed from UIs.UILibrary to AppleJuiceUI)
  deployments.push({
    action: "create_instance",
    className: "Folder",
    instanceName: "AppleJuiceUI",
    parent: "ReplicatedStorage",
    name: "AppleJuiceUI",
  });

  deployments.push({
    action: "create_instance",
    className: "Folder",
    instanceName: "Components",
    parent: "ReplicatedStorage.AppleJuiceUI",
    name: "Components",
  });

  deployments.push({
    action: "create_instance",
    className: "Folder",
    instanceName: "Themes",
    parent: "ReplicatedStorage.AppleJuiceUI",
    name: "Themes",
  });

  // 2. Deploy Dependencies (Packages)
  // We need Fusion and OnyxUI for the advanced library to work.
  for (const [path, code] of scripts) {
    if (path.startsWith("ReplicatedStorage.Packages")) {
      const parts = path.split(".");
      const name = parts[parts.length - 1];
      const parent = parts.slice(0, -1).join(".");
      
      // Create folders along the way if they don't exist
      // In a real plugin, 'create_instance' would handle this, but here we just list them.
      deployments.push({
        action: "create",
        type: "ModuleScript",
        parent,
        name,
        code,
      });
    }
  }

  // 3. Deploy Library Components (Mapped from UIs.UILibrary to AppleJuiceUI)
  for (const [path, code] of scripts) {
    if (path.startsWith("ReplicatedStorage.UIs.UILibrary")) {
      const parts = path.split(".");
      // Replace UIs.UILibrary with AppleJuiceUI
      const newParts = ["ReplicatedStorage", "AppleJuiceUI", ...parts.slice(3)];
      const name = newParts[newParts.length - 1];
      const parent = newParts.slice(0, -1).join(".");
      
      // Fix requires in the code! Replace 'ReplicatedStorage.UIs.UILibrary' with 'ReplicatedStorage.AppleJuiceUI'
      let fixedCode = code
        .replace(/ReplicatedStorage\.UIs\.UILibrary/g, "ReplicatedStorage.AppleJuiceUI")
        .replace(/require\(ReplicatedStorage\.UIs\.UILibrary\)/g, 'require(ReplicatedStorage:WaitForChild("AppleJuiceUI"))');

      deployments.push({
        action: "create",
        type: "ModuleScript",
        parent,
        name,
        code: fixedCode,
      });
    }
  }

  return deployments;
}

export function getUILibraryDeploymentScripts(): DeploymentScript[] {
  if (_cachedDeploymentScripts) return _cachedDeploymentScripts;
  const stylePaths = [
    join(process.cwd(), "styles", "zap.txt"),
    join(process.cwd(), "styles", "stud.txt"),
    join(process.cwd(), "styles", "dracula.txt"),
  ];
  let scripts = new Map<string, string>();
  for (const stylePath of stylePaths) {
    scripts = parseCompetitorFile(stylePath);
    if (scripts.size > 0) break;
  }
  if (scripts.size === 0) return [];
  _cachedDeploymentScripts = buildDeploymentScripts(scripts);
  return _cachedDeploymentScripts;
}

export function getDeployedComponentNames(): string[] {
  // Return the main components from the advanced library
  return [
    "Button", "IconButton", "Card", "Badge", "ProgressBar", "Switch",
    "Checkbox", "Slider", "TextArea", "Tabs", "TitleBar", "Scroller",
    "Widget", "Pane", "ElevatedPane", "HeadingBanner", "CloseButton",
    "HUD", "XPBar", "LoadingScreen", "Toast"
  ];
}

export function buildLibraryDeploymentPrompt(): string {
  const components = getDeployedComponentNames();
  return `
## PRO MULTI-FILE UI LIBRARY (AUTO-DEPLOYED)
A modular, high-performance UI library (Fusion-based) has been deployed to:
  ReplicatedStorage.AppleJuiceUI

### Usage:
\`\`\`luau
local AppleJuiceUI = require(game:GetService("ReplicatedStorage"):WaitForChild("AppleJuiceUI"))
local Fusion = AppleJuiceUI.Fusion
local Scope = Fusion.scoped(AppleJuiceUI, AppleJuiceUI.Util, AppleJuiceUI.Components)

-- The library is organized into individual components for maximum flexibility.
-- Example creating a themed window:
local screen = Instance.new("ScreenGui", player.PlayerGui)
local window = AppleJuiceUI.Widget(Scope, {
    Title = "Game Settings",
    Size = UDim2.fromOffset(500, 400),
    OnClose = function() screen:Destroy() end,
    [Fusion.Children] = {
        AppleJuiceUI.Button(Scope, {
            Text = "Save Changes",
            OnClick = function() print("Saved!") end
        })
    }
})
window.Parent = screen
\`\`\`

### Available Components:
${components.map(c => `- **${c}**: \`AppleJuiceUI.${c}(Scope, Props)\``).join("\n")}

### RULES:
1. ALWAYS use the 'Scope' pattern (Fusion-based).
2. REQUIRE the library from ReplicatedStorage:WaitForChild("AppleJuiceUI").
3. Wrap UI creation in a theme if needed: AppleJuiceUI.Themer.Theme:is(AppleJuiceUI.Themes.Zap):during(function() ... end)
4. Use AppleJuiceUI.Children instead of [Fusion.Children] for readability.
`;
}
