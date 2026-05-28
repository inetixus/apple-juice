/**
 * Competitor UI Database — Extracted from Lemonade's stud.txt, dracula.txt, and zap.txt.
 *
 * This module provides the AI with a structured reference of real competitor
 * scripts, patterns, themes, and asset IDs so it can generate production-grade
 * Roblox GUIs that work in both Studio edit-mode AND playtest.
 *
 * KEY INSIGHT: The competitor NEVER uses StarterGui for script placement.
 * All UI LocalScripts go to StarterPlayer.StarterPlayerScripts, and ScreenGuis
 * are created imperatively via Instance.new("ScreenGui") parented to
 * Players.LocalPlayer.PlayerGui with ResetOnSpawn = false.
 * This ensures GUIs render in Studio mode without requiring a playtest.
 */

// ─── THEME COLOR PALETTES ───────────────────────────────────────────────────

export interface ThemeColorPalette {
  Primary: { Main: string; Dark: string };
  Secondary: { Main: string; Dark: string };
  Accent: { Main: string };
  Neutral: { Main: string; Dark: string };
  NeutralContent: { Main: string };
  Base: { Main: string; Dark?: string };
  BaseContent: { Main: string };
  Success: { Main: string; Dark?: string };
  Error: { Main: string; Dark?: string };
  Warning: { Main: string; Dark?: string };
  Info: { Main: string; Dark?: string };
}

export interface ThemeFont {
  Body: string;
  Heading: string;
  Monospace: string;
}

export interface ButtonStyleSet {
  Default: { Image: string; TextColor: string; TextSize: number };
  Active: { Image: string; TextColor: string; TextSize: number };
  Secondary: { Image: string; TextColor: string; TextSize: number };
  Enabled: { Image: string; TextColor: string; TextSize: number };
  Destructive: { Image: string; TextColor: string; TextSize: number };
  Ghost: { Image: string; TextColor: string; TextSize: number };
}

export interface CompetitorTheme {
  name: string;
  colors: ThemeColorPalette;
  font: ThemeFont;
  fontWeight: { Body: string; Bold: string; Heading: string };
  cornerRadius: number;
  strokeThickness: number;
  buttons: ButtonStyleSet;
  backgroundImage: string;
  closeButtonImage: string;
  scrollbarColor: string;
  bannerImage?: string;
  hudIconImage: string;
}

export const COMPETITOR_THEMES: Record<string, CompetitorTheme> = {
  Lemonade: {
    name: "Lemonade",
    colors: {
      Primary: { Main: "#00F7FF", Dark: "#0066FF" },
      Secondary: { Main: "#FFF600", Dark: "#00A700" },
      Accent: { Main: "#FFFFFF" },
      Neutral: { Main: "#BABABA", Dark: "#525252" },
      NeutralContent: { Main: "#A8A29E" },
      Base: { Main: "#0F1519" },
      BaseContent: { Main: "#FFFFFF" },
      Success: { Main: "#22C55E" },
      Error: { Main: "#EF4444" },
      Warning: { Main: "#F59E0B" },
      Info: { Main: "#22D3EE" },
    },
    font: {
      Body: "rbxasset://fonts/families/Montserrat.json",
      Heading: "rbxasset://fonts/families/Montserrat.json",
      Monospace: "rbxasset://fonts/families/Montserrat.json",
    },
    fontWeight: { Body: "Bold", Bold: "Bold", Heading: "ExtraBold" },
    cornerRadius: 8,
    strokeThickness: 4,
    buttons: {
      Default: { Image: "rbxassetid://102355872404947", TextColor: "#3A2A10", TextSize: 28 },
      Active: { Image: "rbxassetid://127652267430903", TextColor: "#3B2600", TextSize: 28 },
      Secondary: { Image: "rbxassetid://108147913930831", TextColor: "#3B2A0A", TextSize: 28 },
      Enabled: { Image: "rbxassetid://121545617864772", TextColor: "#1F3A05", TextSize: 28 },
      Destructive: { Image: "rbxassetid://125092722896041", TextColor: "#FFFFFF", TextSize: 28 },
      Ghost: { Image: "rbxassetid://92375383899635", TextColor: "#2B2B2B", TextSize: 28 },
    },
    backgroundImage: "rbxassetid://135275431100741",
    closeButtonImage: "rbxassetid://76910057910474",
    scrollbarColor: "#FFFFFF",
    hudIconImage: "rbxassetid://123251413929848",
  },

  Dracula: {
    name: "Dracula",
    colors: {
      Primary: { Main: "#7C3AED", Dark: "#3B14A7" },
      Secondary: { Main: "#FBC72D", Dark: "#FF8A1E" },
      Accent: { Main: "#E06BF9" },
      Neutral: { Main: "#B8A8D9", Dark: "#070515" },
      NeutralContent: { Main: "#B8A8D9" },
      Base: { Main: "#070515", Dark: "#000000" },
      BaseContent: { Main: "#FFFFFF" },
      Success: { Main: "#4ADE80", Dark: "#16A34A" },
      Error: { Main: "#EF4444", Dark: "#B91C1C" },
      Warning: { Main: "#FBC72D", Dark: "#FF8A1E" },
      Info: { Main: "#67E8F9" },
    },
    font: {
      Body: "rbxasset://fonts/families/Fondamento.json",
      Heading: "rbxasset://fonts/families/Fondamento.json",
      Monospace: "rbxasset://fonts/families/Fondamento.json",
    },
    fontWeight: { Body: "Medium", Bold: "Bold", Heading: "ExtraBold" },
    cornerRadius: 0,
    strokeThickness: 3,
    buttons: {
      Default: { Image: "rbxassetid://94242502437540", TextColor: "#F8F8F2", TextSize: 28 },
      Active: { Image: "rbxassetid://99132505905865", TextColor: "#2B1500", TextSize: 28 },
      Secondary: { Image: "rbxassetid://79743679349001", TextColor: "#2B1500", TextSize: 28 },
      Enabled: { Image: "rbxassetid://99127971476980", TextColor: "#062A12", TextSize: 28 },
      Destructive: { Image: "rbxassetid://96626039026169", TextColor: "#FFFFFF", TextSize: 28 },
      Ghost: { Image: "rbxassetid://80888453820957", TextColor: "#F8F8F2", TextSize: 28 },
    },
    backgroundImage: "rbxassetid://126001157837467",
    closeButtonImage: "rbxassetid://75595317912305",
    scrollbarColor: "#E06BF9",
    bannerImage: "rbxassetid://99132505905865",
    hudIconImage: "rbxassetid://123251413929848",
  },

  Zap: {
    name: "Zap",
    colors: {
      Primary: { Main: "#F5362D", Dark: "#B82218" },
      Secondary: { Main: "#15C95A", Dark: "#0E8E40" },
      Accent: { Main: "#D6DB24" },
      Neutral: { Main: "#3B3B3B", Dark: "#232323" },
      NeutralContent: { Main: "#E6E6E6" },
      Base: { Main: "#3B3B3B", Dark: "#232323" },
      BaseContent: { Main: "#FFFFFF" },
      Success: { Main: "#35C84C", Dark: "#1F8E32" },
      Error: { Main: "#F5362D", Dark: "#B82218" },
      Warning: { Main: "#E3A516", Dark: "#A07308" },
      Info: { Main: "#259EF6", Dark: "#1568AD" },
    },
    font: {
      Body: "rbxasset://fonts/families/FredokaOne.json",
      Heading: "rbxasset://fonts/families/FredokaOne.json",
      Monospace: "rbxasset://fonts/families/RobotoMono.json",
    },
    fontWeight: { Body: "Regular", Bold: "Bold", Heading: "ExtraBold" },
    cornerRadius: 12,
    strokeThickness: 4,
    buttons: {
      Default: { Image: "rbxassetid://131843670564796", TextColor: "#F8F8F2", TextSize: 28 },
      Active: { Image: "rbxassetid://133268834191422", TextColor: "#2B1500", TextSize: 28 },
      Secondary: { Image: "rbxassetid://116734983896964", TextColor: "#2B1500", TextSize: 28 },
      Enabled: { Image: "rbxassetid://94094449272932", TextColor: "#062A12", TextSize: 28 },
      Destructive: { Image: "rbxassetid://77182445055170", TextColor: "#FFFFFF", TextSize: 28 },
      Ghost: { Image: "rbxassetid://100288907531640", TextColor: "#F8F8F2", TextSize: 28 },
    },
    backgroundImage: "rbxassetid://106555095919932",
    closeButtonImage: "rbxassetid://90857209355154",
    scrollbarColor: "#F5362D",
    bannerImage: "rbxassetid://102262056010998",
    hudIconImage: "rbxassetid://77506246542645",
  },

  Claude: {
    name: "Claude",
    colors: {
      Primary: { Main: "#D77757", Dark: "#B45F3D" },
      Secondary: { Main: "#AF87FF", Dark: "#885EE5" },
      Accent: { Main: "#B1B9F9" },
      Neutral: { Main: "#888888", Dark: "#333333" },
      NeutralContent: { Main: "#CCCCCC" },
      Base: { Main: "#0F0F14", Dark: "#08080A" },
      BaseContent: { Main: "#FFFFFF" },
      Success: { Main: "#4EBA65", Dark: "#3A8F4D" },
      Error: { Main: "#FF6B80", Dark: "#D34E62" },
      Warning: { Main: "#FFC107", Dark: "#C79500" },
      Info: { Main: "#5769F7" },
    },
    font: {
      Body: "rbxasset://fonts/families/RobotoMono.json",
      Heading: "rbxasset://fonts/families/RobotoMono.json",
      Monospace: "rbxasset://fonts/families/RobotoMono.json",
    },
    fontWeight: { Body: "Regular", Bold: "Bold", Heading: "Bold" },
    cornerRadius: 8,
    strokeThickness: 2,
    buttons: {
      Default: { Image: "rbxassetid://131843670564796", TextColor: "#FFFFFF", TextSize: 24 },
      Active: { Image: "rbxassetid://133268834191422", TextColor: "#FFFFFF", TextSize: 24 },
      Secondary: { Image: "rbxassetid://116734983896964", TextColor: "#FFFFFF", TextSize: 24 },
      Enabled: { Image: "rbxassetid://94094449272932", TextColor: "#FFFFFF", TextSize: 24 },
      Destructive: { Image: "rbxassetid://77182445055170", TextColor: "#FFFFFF", TextSize: 24 },
      Ghost: { Image: "rbxassetid://100288907531640", TextColor: "#FFFFFF", TextSize: 24 },
    },
    backgroundImage: "rbxassetid://106555095919932",
    closeButtonImage: "rbxassetid://90857209355154",
    scrollbarColor: "#D77757",
    hudIconImage: "rbxassetid://123251413929848",
  },
};

// ─── COMPETITOR ASSET CATALOGS ──────────────────────────────────────────────

/** All unique rbxassetid references found across competitor themes */
export const COMPETITOR_ASSETS = {
  // Toast/notification icons
  toastInfo: "rbxassetid://140291432435133",
  toastSuccess: "rbxassetid://103438334837778",
  toastWarning: "rbxassetid://110209612171213",
  toastError: "rbxassetid://120469969313346",
  // Zap-specific toast icons
  zapToastInfo: "rbxassetid://108800013691143",
  zapToastSuccess: "rbxassetid://140312201644821",
  zapToastWarning: "rbxassetid://73955615617298",
  zapToastError: "rbxassetid://90857209355154",
  zapToastAnnouncement: "rbxassetid://127217150000578",
  // Loading screen backgrounds
  lemonadeLoadingBg: "rbxassetid://72499194346940",
  draculaLoadingBg: "rbxassetid://72268513362896",
  // Shop open icon
  shopIcon: "rbxassetid://93322558559088",
  // HUD currency icon
  hudCurrencyIcon: "rbxassetid://123251413929848",
};

// ─── COMPETITOR SCRIPT PATTERNS ─────────────────────────────────────────────

export interface CompetitorScript {
  path: string;
  type: "Script" | "LocalScript" | "ModuleScript";
  description: string;
  /** Key patterns this script demonstrates */
  patterns: string[];
  /** The actual Luau code (trimmed to essential logic) */
  code: string;
}

/**
 * Essential competitor scripts that demonstrate production GUI patterns.
 * These are extracted and deduplicated from stud.txt/dracula.txt/zap.txt.
 */
export const COMPETITOR_SCRIPTS: CompetitorScript[] = [
  {
    path: "StarterPlayer.StarterPlayerScripts.GameShop_UIBuilder",
    type: "LocalScript",
    description:
      "Main GUI bootstrap script. Creates ScreenGui imperatively, adds responsive scaling, " +
      "click-outside-to-close, keyboard toggle (G key), and a launcher IconButton. " +
      "Uses Fusion/OnyxUI/UILibrary with theme wrapping.",
    patterns: [
      "ScreenGui created via Instance.new, NOT via StarterGui hierarchy",
      "Parented to Players.LocalPlayer.PlayerGui",
      "ResetOnSpawn = false for persistence across respawns",
      "DisplayOrder layering (200 for panel, 100 for launcher)",
      "Viewport-based DynamicScale for responsive UI",
      "Click-outside-to-close via full-screen transparent TextButton",
      "Keyboard shortcut toggle (Enum.KeyCode.G)",
      "Separate ScreenGui for the launcher button vs the panel",
      "Theme wrapping via Themer.Theme:is(theme):during(callback)",
    ],
    code: `-- Auto-generated by Lemonade UI Builder
-- Template: GameShop

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local OnyxUI = ReplicatedStorage.Packages.OnyxUI.Packages.OnyxUI
local Fusion = require(OnyxUI.Parent.Fusion)
local Util = require(OnyxUI.Util)
local Components = require(OnyxUI.Components)
local UILib = require(ReplicatedStorage.UIs.UILibrary)
local Themer = UILib.Themer
local GameShop = require(ReplicatedStorage.UIs.GameShop)

local Scope = Fusion.scoped(Fusion, Util, Components)

-- Compute DynamicScale based on viewport size for responsive UI
local Camera = workspace.CurrentCamera
local BaseResolution = Vector2.new(1920, 1080)
local ScreenSize = Scope:Value(Camera.ViewportSize)
Camera:GetPropertyChangedSignal("ViewportSize"):Connect(function()
  ScreenSize:set(Camera.ViewportSize)
end)
local DynamicScale = Scope:Computed(function(Use)
  local Size = Use(ScreenSize)
  local Ratio = 1 / math.max(BaseResolution.X / Size.X, BaseResolution.Y / Size.Y)
  return math.clamp(Ratio, 0.5, 2)
end)

-- Create ScreenGui imperatively (works in Studio mode!)
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "GameShop_Themed"
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.DisplayOrder = 200
screenGui.Parent = Players.LocalPlayer.PlayerGui
screenGui.Enabled = false

-- Click outside to close
local clickOutside = Instance.new("TextButton")
clickOutside.Name = "ClickOutsideClose"
clickOutside.Text = ""
clickOutside.Size = UDim2.new(1, 0, 1, 0)
clickOutside.BackgroundTransparency = 1
clickOutside.Parent = screenGui
clickOutside.Activated:Connect(function()
  screenGui.Enabled = false
end)

-- Open button (separate ScreenGui, lower DisplayOrder)
local openGui = Instance.new("ScreenGui")
openGui.Name = "GameShop_OpenButton"
openGui.Parent = Players.LocalPlayer.PlayerGui
openGui.ResetOnSpawn = false
openGui.DisplayOrder = 100
openGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

-- Keyboard toggle (press G)
UserInputService.InputBegan:Connect(function(input, gameProcessed)
  if gameProcessed then return end
  if input.KeyCode == Enum.KeyCode.G then
    screenGui.Enabled = not screenGui.Enabled
  end
end)

-- Build the GUI panel
local gui = GameShop(Scope, {
  AnchorPoint = Vector2.new(0.5, 0.5),
  Position = UDim2.new(0.5, 0, 0.5, 0),
  DynamicScale = DynamicScale,
  OnClose = function()
    screenGui.Enabled = false
  end,
})
gui.Active = true -- absorb clicks
gui.Parent = screenGui
gui.AnchorPoint = Vector2.new(0.5, 0.5)
gui.Position = UDim2.new(0.5, 0, 0.5, 0)`,
  },

  {
    path: "Workspace.ShopPodium.ShopInteractionHandler",
    type: "Script",
    description:
      "Server-side touch trigger that opens the shop GUI for the touching player. " +
      "Uses debounce/cooldown and cleanup on player leave.",
    patterns: [
      "Touch-based proximity interaction",
      "Per-player cooldown with os.clock()",
      "RemoteEvent FireClient to open client GUI",
      "Cleanup on Players.PlayerRemoving",
    ],
    code: `local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local trigger = script.Parent:WaitForChild("TouchTrigger")
local openShopEvent = ReplicatedStorage.Shop.Remotes.OpenShop

local cooldowns = {}

trigger.Touched:Connect(function(hit: BasePart)
  local character = hit.Parent
  if not character then return end
  local humanoid = character:FindFirstChildOfClass("Humanoid")
  if not humanoid then return end
  local player = Players:GetPlayerFromCharacter(character)
  if not player then return end

  local now = os.clock()
  local last = cooldowns[player]
  if last and (now - last) < 1.0 then return end
  cooldowns[player] = now

  openShopEvent:FireClient(player)
end)

Players.PlayerRemoving:Connect(function(player: Player)
  cooldowns[player] = nil
end)

print("ShopInteractionHandler: Ready.")`,
  },
];

// ─── COMPETITOR COMPONENT LIST ──────────────────────────────────────────────

/** All components exported by the competitor's UILibrary */
export const COMPETITOR_COMPONENTS = [
  { name: "Pane", description: "Base themed container with optional background image/watermark" },
  { name: "ElevatedPane", description: "Pane with vertical elevation offset and gradient color sequence" },
  { name: "CloseButton", description: "Themed X button with configurable color role and image" },
  { name: "HeadingBanner", description: "Top banner of a Widget — image-backed, gradient, or transparent" },
  { name: "Widget", description: "Full template shell — Pane + HeadingBanner + Body content frame" },
  { name: "Divider", description: "Horizontal separator line" },
  { name: "TextInput", description: "Themed text input field" },
  { name: "Button", description: "9-slice image button with 6 styles: Default, Active, Secondary, Enabled, Destructive, Ghost" },
  { name: "IconButton", description: "Compact icon + label launcher button with hover spin animation" },
  { name: "Badge", description: "Small rounded pill showing text/icon with theme color" },
  { name: "Card", description: "Themed card container" },
  { name: "ProgressBar", description: "Horizontal progress bar with fill color and label" },
  { name: "Switch", description: "Toggle switch component" },
  { name: "Checkbox", description: "Themed checkbox" },
  { name: "Slider", description: "Draggable slider" },
  { name: "TextArea", description: "Multi-line text input" },
  { name: "TextSwap", description: "Animated text swapper" },
  { name: "Tabs", description: "Tab strip navigation" },
  { name: "TitleBar", description: "Header bar with title and close button" },
  { name: "Scroller", description: "Themed scrolling frame with custom scrollbar color" },
  { name: "Avatar", description: "Round headshot/portrait with optional ring + indicator dot" },
  { name: "Icon", description: "Image primitive sized to theme's TextSize" },
  { name: "IconText", description: "Inline icon + text row" },
  { name: "IconSwap", description: "Animated icon swapper" },
  { name: "HUD", description: "Currency/stat display with icon and background" },
  { name: "LoadingScreen", description: "Full-screen loading with progress bar, background image, icon, title" },
  { name: "XPBar", description: "Experience/level progress bar" },
  { name: "Toast", description: "Notification toast with severity (Info, Success, Warning, Error, Announcement)" },
  { name: "HoverSpinIcon", description: "Spring-driven hover spin animation for item icons" },
];

// ─── ARCHITECTURE PATTERNS ──────────────────────────────────────────────────

/**
 * Key architectural patterns extracted from competitor code that
 * should be adopted by Apple Juice AI for GUI generation.
 */
export const ARCHITECTURE_PATTERNS = {
  /** GUI placement — CRITICAL for Studio mode visibility */
  guiPlacement: `
## GUI PLACEMENT (CRITICAL — works in Studio mode)
The competitor NEVER uses StarterGui for placing UI scripts.
Instead, LocalScripts go to StarterPlayer.StarterPlayerScripts,
and ScreenGuis are created IMPERATIVELY via Instance.new("ScreenGui")
parented to Players.LocalPlayer.PlayerGui.

This pattern ensures:
1. GUIs appear in Studio edit mode (not just playtest)
2. ResetOnSpawn = false prevents GUI from disappearing on respawn
3. DisplayOrder controls layering between panels and launcher buttons
4. Multiple themed GUIs can coexist (each with unique Name suffix)

### Recommended Pattern:
\`\`\`luau
local Players = game:GetService("Players")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "MyFeature_GUI"
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.DisplayOrder = 200
screenGui.Parent = Players.LocalPlayer.PlayerGui
screenGui.Enabled = false  -- start hidden, toggle on user action
\`\`\`
`,

  /** Responsive scaling pattern */
  responsiveScaling: `
## RESPONSIVE SCALING
The competitor uses viewport-based dynamic scaling so UIs look correct
on all screen sizes (mobile, tablet, desktop, ultrawide).

### Pattern:
\`\`\`luau
local Camera = workspace.CurrentCamera
local BaseResolution = Vector2.new(1920, 1080)

local function getDynamicScale()
  local viewport = Camera.ViewportSize
  local ratio = 1 / math.max(
    BaseResolution.X / viewport.X,
    BaseResolution.Y / viewport.Y
  )
  return math.clamp(ratio, 0.5, 2)
end

-- Apply to a UIScale instance on your root frame
local uiScale = Instance.new("UIScale")
uiScale.Scale = getDynamicScale()
uiScale.Parent = rootFrame

-- Update on viewport change
Camera:GetPropertyChangedSignal("ViewportSize"):Connect(function()
  uiScale.Scale = getDynamicScale()
end)
\`\`\`
`,

  /** Click-outside-to-close pattern */
  clickOutsideClose: `
## CLICK-OUTSIDE-TO-CLOSE
The competitor places a full-screen transparent TextButton BEHIND the
GUI panel (as first child of ScreenGui). Clicking anywhere outside the
panel hits this button and closes the GUI.

### Pattern:
\`\`\`luau
local clickOutside = Instance.new("TextButton")
clickOutside.Name = "ClickOutsideClose"
clickOutside.Text = ""
clickOutside.Size = UDim2.new(1, 0, 1, 0)
clickOutside.BackgroundTransparency = 1
clickOutside.Parent = screenGui  -- first child = renders behind panel
clickOutside.Activated:Connect(function()
  screenGui.Enabled = false
end)

-- The actual panel must have Active = true to absorb clicks
panel.Active = true
\`\`\`
`,

  /** Keyboard toggle pattern */
  keyboardToggle: `
## KEYBOARD SHORTCUT TOGGLE
The competitor binds a keyboard key to toggle GUI visibility.

### Pattern:
\`\`\`luau
local UserInputService = game:GetService("UserInputService")

UserInputService.InputBegan:Connect(function(input, gameProcessed)
  if gameProcessed then return end
  if input.KeyCode == Enum.KeyCode.G then -- or any key
    screenGui.Enabled = not screenGui.Enabled
  end
end)
\`\`\`
`,

  /** Widget structure pattern */
  widgetStructure: `
## WIDGET STRUCTURE (Panel Template)
The competitor's "Widget" is the standard panel structure:
1. Pane (outer container with themed background)
2. HeadingBanner (top bar with title + close button)
3. Body (scrollable content area below the banner)

The banner height is theme-configurable (70-110px).
Body gets per-edge padding from the theme.
Background can be an image, solid color, or gradient.
`,
};

// ─── BUILD COMPETITOR CONTEXT BLOCK ─────────────────────────────────────────

/**
 * Builds a context block from the competitor database for injection
 * into the AI system prompt when generating UI-related code.
 */
export function buildCompetitorContextBlock(prompt: string): string {
  const lower = prompt.toLowerCase();

  // Only inject for UI-related prompts
  const uiKeywords = [
    "gui", "ui", "interface", "button", "menu", "hud", "screen",
    "shop", "store", "inventory", "dialog", "modal", "popup",
    "notification", "toast", "bar", "health", "scoreboard",
    "leaderboard", "settings", "lobby", "frame", "scroll",
    "card", "panel", "dashboard", "overlay", "widget", "tab",
    "currency", "coins", "gamepass", "purchase", "loading",
  ];

  if (!uiKeywords.some((w) => lower.includes(w))) return "";

  let block = `\n\n## COMPETITOR UI ARCHITECTURE REFERENCE
The following patterns are extracted from production Roblox UI systems.
Apply these patterns when generating GUIs:

${ARCHITECTURE_PATTERNS.guiPlacement}
${ARCHITECTURE_PATTERNS.responsiveScaling}
${ARCHITECTURE_PATTERNS.clickOutsideClose}
${ARCHITECTURE_PATTERNS.keyboardToggle}

### AVAILABLE THEME PALETTES (for color reference):
`;

  // Add condensed theme info
  for (const [name, theme] of Object.entries(COMPETITOR_THEMES)) {
    block += `\n**${name}**: Primary=${theme.colors.Primary.Main}, `;
    block += `Secondary=${theme.colors.Secondary.Main}, `;
    block += `Base=${theme.colors.Base.Main}, `;
    block += `Font=${theme.font.Body}, `;
    block += `CornerRadius=${theme.cornerRadius}`;
  }

  // Add button 9-slice assets
  block += `\n\n### 9-SLICE BUTTON ASSETS (real rbxassetid):`;
  for (const [name, theme] of Object.entries(COMPETITOR_THEMES)) {
    block += `\n**${name}**: Default=${theme.buttons.Default.Image}, Active=${theme.buttons.Active.Image}`;
  }

  // Add toast/notification icons
  block += `\n\n### TOAST/NOTIFICATION ICONS:
- Info: ${COMPETITOR_ASSETS.toastInfo}
- Success: ${COMPETITOR_ASSETS.toastSuccess}
- Warning: ${COMPETITOR_ASSETS.toastWarning}
- Error: ${COMPETITOR_ASSETS.toastError}
`;

  // Add relevant script patterns
  if (lower.includes("shop") || lower.includes("store") || lower.includes("purchase")) {
    const shopScript = COMPETITOR_SCRIPTS.find((s) => s.path.includes("GameShop"));
    if (shopScript) {
      block += `\n### REFERENCE: Shop UI Builder Pattern\n${shopScript.description}\nKey patterns: ${shopScript.patterns.join(", ")}\n`;
    }

    const touchScript = COMPETITOR_SCRIPTS.find((s) => s.path.includes("ShopInteraction"));
    if (touchScript) {
      block += `\n### REFERENCE: Touch-to-Open Shop Pattern\n${touchScript.description}\n\`\`\`luau\n${touchScript.code}\n\`\`\`\n`;
    }
  }

  return block;
}
