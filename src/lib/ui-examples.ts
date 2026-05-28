/**
 * UI Examples Library — Few-shot prompting for AppleJuiceUI-based generation.
 * These examples teach the AI how to compose UIs using the AppleJuiceUI library
 * instead of raw Instance.new() calls.
 *
 * Also integrates competitor UI patterns (from styles/stud.txt, dracula.txt, zap.txt)
 * to teach the AI production-grade GUI architecture: responsive scaling,
 * click-outside-to-close, keyboard toggles, and proper ScreenGui placement.
 */

import { buildCompetitorContextBlock } from "./competitor-ui-database";

export interface UIExample {
  name: string;
  description: string;
  keywords: string[];
  code: string;
}

const UI_EXAMPLES: UIExample[] = [
  {
    name: "Game Shop with Tabs & Product Grid",    description:
      "Complete shop UI using AppleJuiceUI's one-call ShopTemplate: tabbed navigation, responsive grid, animated icons, and close button.",
    keywords: ["shop", "store", "buy", "purchase", "currency", "gamepass", "product", "item"],
    code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local screen, panel = UI.ShopTemplate({
  Title = "Server Shop",
  Tabs = {
    {Id = "Currency", Label = "BUY COINS", Items = {
      {Text = "Coin Pouch", Price = 49, Icon = UI.Icons.Coin},
      {Text = "Cash Stack", Price = 99, Icon = UI.Icons.Cash},
      {Text = "Crystals", Price = 299, Icon = UI.Icons.Crystal},
      {Text = "Diamonds", Price = 499, Icon = UI.Icons.Diamond},
      {Text = "Ingot Bar", Price = 199, Icon = UI.Icons.Ingot},
    }},
    {Id = "Passes", Label = "GAMEPASSES", Items = {
      {Text = "VIP", Price = 499, Icon = UI.Icons.VIP},
      {Text = "Magnet", Price = 199, Icon = UI.Icons.Magnet},
      {Text = "Crown", Price = 399, Icon = UI.Icons.Crown},
      {Text = "Sword", Price = 449, Icon = UI.Icons.Sword},
      {Text = "Shield", Price = 299, Icon = UI.Icons.Shield},
    }},
    {Id = "Boosts", Label = "BOOSTS", Items = {
      {Text = "Rocket", Price = 79, Icon = UI.Icons.Rocket},
      {Text = "Lucky Star", Price = 39, Icon = UI.Icons.Star},
      {Text = "Potion", Price = 25, Icon = UI.Icons.Potion},
    }}
  }
})

screen.Enabled = false

UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  if input.KeyCode == Enum.KeyCode.G then
    screen.Enabled = not screen.Enabled
  end
end)\`,`,
  },
  {
    name: "HUD with Health & Currency",
    description:
      "Floating HUD showing health bar and coin count using AppleJuiceUI components.",
    keywords: ["hud", "health", "currency", "coins", "status", "bar", "display", "stats"],
    code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local player = Players.LocalPlayer
local screen = UI.createScreenGui("HudGui")

-- Health bar (top left)
local healthBar = UI.ProgressBar(screen, {
  Size = UDim2.new(0, 250, 0, 28),
  Position = UDim2.new(0, 20, 0, 20),
  Value = 1,
  Label = "100/100 HP",
  FillColor = Color3.fromRGB(220, 50, 50),
})

-- Currency display (top right)
local coinCard = UI.Card(screen, {
  Size = UDim2.new(0, 180, 0, 44),
  Position = UDim2.new(1, -200, 0, 20),
  Padding = 8,
})

local coinIcon = Instance.new("ImageLabel")
coinIcon.Size = UDim2.new(0, 28, 0, 28)
coinIcon.Position = UDim2.new(0, 6, 0.5, -14)
coinIcon.BackgroundTransparency = 1
coinIcon.Image = "rbxassetid://77506246542645"
coinIcon.ScaleType = Enum.ScaleType.Fit
coinIcon.Parent = coinCard

UI.Text(coinCard, {
  Text = "12,365",
  Bold = true,
  TextSize = 18,
  Size = UDim2.new(1, -42, 1, 0),
  Position = UDim2.new(0, 40, 0, 0),
  Align = Enum.TextXAlignment.Left,
})

-- XP bar (bottom center)
local xpBar = UI.ProgressBar(screen, {
  Size = UDim2.new(0, 400, 0, 20),
  Position = UDim2.new(0.5, -200, 1, -40),
  Value = 0.45,
  Label = "Level 12 — 4,500/10,000 XP",
})

-- Update health from character
local function onCharacter(char)
  local humanoid = char:WaitForChild("Humanoid", 5)
  if humanoid then
    humanoid.HealthChanged:Connect(function(hp)
      local max = humanoid.MaxHealth
      local pct = hp / max
      healthBar:Update(pct, math.floor(hp) .. "/" .. math.floor(max) .. " HP")
    end)
  end
end
if player.Character then onCharacter(player.Character) end
player.CharacterAdded:Connect(onCharacter)`,
  },
  {
    name: "Modal Dialog with Confirm/Cancel",
    description:
      "Centered modal overlay with backdrop, title, message, and two action buttons.",
    keywords: ["modal", "dialog", "popup", "confirm", "alert", "prompt", "overlay"],
    code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local screen = UI.createScreenGui("ConfirmDialog")

local card, modalScreen = UI.Modal(screen, {
  Title = "Confirm Purchase",
  Size = UDim2.new(0, 380, 0, 220),
  OnClose = function() screen.Enabled = false end,
})

UI.Text(card, {
  Text = "Are you sure you want to buy the VIP Gamepass for 499 Robux?",
  Size = UDim2.new(1, -20, 0, 50),
  Position = UDim2.new(0, 10, 0, 60),
  Wrapped = true,
  Align = Enum.TextXAlignment.Center,
})

UI.Button(card, {
  Text = "Confirm",
  Style = "Primary",
  Size = UDim2.new(0.5, -15, 0, 40),
  Position = UDim2.new(0, 10, 1, -55),
  OnClick = function()
    print("Confirmed purchase!")
    UI.Toast(screen, {Text = "Purchase successful!", Type = "success"})
    screen.Enabled = false
  end,
})

UI.Button(card, {
  Text = "Cancel",
  Style = "Danger",
  Size = UDim2.new(0.5, -15, 0, 40),
  Position = UDim2.new(0.5, 5, 1, -55),
  OnClick = function() screen.Enabled = false end,
})`,
  },
  {
    name: "RPG Inventory with Grid Layout",
    description:
      "Complete inventory UI using AppleJuiceUI's one-call InventoryTemplate: rarity badges, counts, scaling grid, and animations.",
    keywords: ["inventory", "items", "bag", "backpack", "grid", "weapons", "armor"],
    code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Ember")

local screen, panel = UI.InventoryTemplate({
  Title = "Backpack",
  Items = {
    {Name = "Iron Sword", Icon = UI.Icons.Sword, Count = 1, Rarity = "Common"},
    {Name = "Gold Shield", Icon = UI.Icons.Shield, Count = 1, Rarity = "Rare"},
    {Name = "Fire Potion", Icon = UI.Icons.Potion, Count = 5, Rarity = "Common"},
    {Name = "Diamond Crown", Icon = UI.Icons.Crown, Count = 1, Rarity = "Legendary"},
    {Name = "Lucky Magnet", Icon = UI.Icons.Magnet, Count = 1, Rarity = "Epic"},
    {Name = "Speed Coil", Icon = UI.Icons.Coil, Count = 1, Rarity = "Rare"},
  }
})

screen.Enabled = false

UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  if input.KeyCode == Enum.KeyCode.I or input.KeyCode == Enum.KeyCode.B then
    screen.Enabled = not screen.Enabled
  end
end)`,
  },
  {
    name: "Settings Panel with Toggles and Slider",
    description:
      "Settings panel with toggle switches for SFX/Music and section dividers.",
    keywords: ["settings", "options", "config", "toggle", "switch", "menu", "preferences"],
    code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Ember")

local screen = UI.createScreenGui("SettingsGui")
screen.Enabled = false

local panel = UI.Card(screen, {
  Size = UDim2.new(0, 380, 0, 400),
  Position = UDim2.new(0.5, 0, 0.5, 0),
  AnchorPoint = Vector2.new(0.5, 0.5),
  Padding = 16,
})

UI.TitleBar(panel, {Title = "Settings", OnClose = function() screen.Enabled = false end})

-- Audio section
UI.Text(panel, {
  Text = "AUDIO",
  Bold = true,
  TextSize = 11,
  Position = UDim2.new(0, 16, 0, 60),
  Size = UDim2.new(1, -32, 0, 16),
})

UI.Divider(panel, {Position = UDim2.new(0, 10, 0, 80)})

-- SFX Toggle row
UI.Text(panel, {Text = "Sound Effects", Position = UDim2.new(0, 16, 0, 95), Size = UDim2.new(0.6, 0, 0, 24)})
local sfxOn = true
local sfxBtn = UI.Button(panel, {
  Text = "ON",
  Style = "Primary",
  Size = UDim2.new(0, 60, 0, 28),
  Position = UDim2.new(1, -76, 0, 93),
  OnClick = function()
    sfxOn = not sfxOn
    -- Toggle visual handled via the button
  end,
})

-- Music Toggle row
UI.Text(panel, {Text = "Music", Position = UDim2.new(0, 16, 0, 130), Size = UDim2.new(0.6, 0, 0, 24)})
local musicOn = true
local musicBtn = UI.Button(panel, {
  Text = "ON",
  Style = "Primary",
  Size = UDim2.new(0, 60, 0, 28),
  Position = UDim2.new(1, -76, 0, 128),
  OnClick = function()
    musicOn = not musicOn
  end,
})

-- Graphics section
UI.Text(panel, {
  Text = "GRAPHICS",
  Bold = true,
  TextSize = 11,
  Position = UDim2.new(0, 16, 0, 175),
  Size = UDim2.new(1, -32, 0, 16),
})

UI.Divider(panel, {Position = UDim2.new(0, 10, 0, 195)})

UI.Text(panel, {Text = "Quality", Position = UDim2.new(0, 16, 0, 210), Size = UDim2.new(0.5, 0, 0, 24)})

local qualityBar = UI.ProgressBar(panel, {
  Size = UDim2.new(0.45, 0, 0, 24),
  Position = UDim2.new(0.52, 0, 0, 210),
  Value = 0.7,
  Label = "High",
})

-- Reset button
UI.Button(panel, {
  Text = "Reset to Default",
  Style = "Danger",
  Size = UDim2.new(1, -32, 0, 38),
  Position = UDim2.new(0, 16, 1, -55),
  OnClick = function()
    UI.Toast(screen, {Text = "Settings reset!", Type = "info"})
  end,
})`,
  },
];

/**
 * Icon catalog from the competitor's asset library.
 * The AI can use these real Roblox asset IDs when generating UI.
 */
export const ICON_CATALOG = {
  // Currency
  Coin: "rbxassetid://77506246542645",
  Cash: "rbxassetid://112756857142835",
  Crystal: "rbxassetid://81253425188370",
  Diamond: "rbxassetid://130403869659285",
  Ingot: "rbxassetid://85443008089013",
  Premium: "rbxassetid://76876761443329",
  Robux: "rbxassetid://94800204617476",
  Ticket: "rbxassetid://103084066403087",
  // Gamepasses
  VIP: "rbxassetid://128733366506652",
  Aura: "rbxassetid://101723728988705",
  Trail: "rbxassetid://83396923860162",
  Teleport: "rbxassetid://113569253808900",
  AngelHeart: "rbxassetid://76541625491879",
  // Items
  Magnet: "rbxassetid://89108897289913",
  Crown: "rbxassetid://91097101374561",
  LuckyBlock: "rbxassetid://107481007887279",
  Coil: "rbxassetid://82003481235567",
  Trophy: "rbxassetid://106910511015219",
  Shield: "rbxassetid://140004244450894",
  Sword: "rbxassetid://113879674175484",
  Gift: "rbxassetid://91545952440347",
  Potion: "rbxassetid://116120788528815",
  Rocket: "rbxassetid://132739132155261",
  // Boosts
  Fire: "rbxassetid://104160053917971",
  Heart: "rbxassetid://88867748830914",
  Hoverboard: "rbxassetid://108488124800166",
  Lightning: "rbxassetid://80384669807985",
  Rebirth: "rbxassetid://111505774233400",
  Star: "rbxassetid://111803940069577",
  Upgrade: "rbxassetid://138342186651984",
  Wheel: "rbxassetid://78756458162291",
};

/** Keywords that indicate a UI-related prompt */
const UI_SIGNAL_WORDS = [
  "gui", "ui", "interface", "button", "menu", "hud", "screen",
  "shop", "store", "inventory", "dialog", "modal", "popup",
  "notification", "toast", "bar", "health", "scoreboard",
  "leaderboard", "settings", "lobby", "frame", "scroll",
  "card", "panel", "dashboard", "overlay", "widget", "tab",
  "currency", "coins", "gamepass", "purchase",
];

export function isUIRelatedPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return UI_SIGNAL_WORDS.some((w) => lower.includes(w));
}

export function getRelevantUIExamples(prompt: string): UIExample[] {
  if (!isUIRelatedPrompt(prompt)) return [];

  const lower = prompt.toLowerCase();
  const scored = UI_EXAMPLES.map((ex) => {
    const score = ex.keywords.reduce(
      (acc, kw) => acc + (lower.includes(kw) ? 1 : 0),
      0,
    );
    return { ex, score };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);

  // Return max 2: best match + one from a different category for diversity
  const results: UIExample[] = [];
  if (scored.length > 0) {
    results.push(scored[0].ex);
    // Find a different-named example to provide variety
    const different = scored.find(
      (s) => s.ex.name !== scored[0].ex.name && s.score > 0,
    );
    if (different) {
      results.push(different.ex);
    }
  }

  // If no specific matches, include the Modal (most generic/useful pattern)
  if (results.length === 0) {
    const modal = UI_EXAMPLES.find((e) => e.name.includes("Modal"));
    if (modal) results.push(modal);
  }

  return results.slice(0, 2);
}

export function buildUIExamplesBlock(prompt: string): string {
  const examples = getRelevantUIExamples(prompt);

  // Build competitor architecture context (responsive scaling, click-outside-to-close, etc.)
  const competitorBlock = buildCompetitorContextBlock(prompt);

  if (examples.length === 0 && !competitorBlock) return "";

  // Build icon catalog string for injection
  const iconList = Object.entries(ICON_CATALOG)
    .map(([name, id]) => `  ${name} = "${id}"`)
    .join("\n");

  let block = `\n\n## UI REFERENCE EXAMPLES (USE AppleJuiceUI LIBRARY)
When generating UI, follow these patterns exactly using the AppleJuiceUI library:
- Always require AppleJuiceUI from ReplicatedStorage
- Use UI.setTheme("Juice") or "Midnight" or "Ember" or "Claude"
- Use UI.createScreenGui(), UI.Card(), UI.Button(), UI.TitleBar(), etc.
- Use UI.ScrollList() with Grid=true for product grids
- Use UI.ProductCard() for shop items
- Use UI.Toast() for notifications
- Use the icon catalog below for real asset IDs
- ALWAYS put LocalScripts in StarterGui so they work in Studio mode AND playtest
- ALWAYS create ScreenGuis with ResetOnSpawn = false
- ALWAYS add responsive DynamicScale based on viewport size
- ALWAYS add click-outside-to-close (transparent TextButton behind panel)
- ALWAYS add a keyboard shortcut toggle for opening/closing the GUI

### ICON CATALOG (use these real asset IDs):
\`\`\`luau
local ICON = {
${iconList}
}
\`\`\`
\n`;

  for (const ex of examples) {
    block += `\n### REFERENCE: ${ex.name}\n${ex.description}\n\`\`\`luau\n${ex.code}\n\`\`\`\n`;
  }

  block += `\nYou MUST use the AppleJuiceUI library components. NEVER use raw Instance.new() for buttons, cards, or layout — always use UI.Button(), UI.Card(), UI.ScrollList(), etc.\n`;

  // Append competitor architecture patterns (responsive scaling, themes, assets, etc.)
  block += competitorBlock;

  return block;
}
