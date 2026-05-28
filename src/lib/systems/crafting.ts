import type { SystemTemplate } from "./index";

export const CRAFTING_SYSTEM: SystemTemplate = {
  name: "Crafting & Recipes System",
  category: "Crafting",
  description: "Recipe-based crafting with ingredient requirements, crafting stations, and timed production.",
  keywords: ["craft", "recipe", "forge", "smelt", "combine", "create", "workbench", "ingredients"],
  serverCode: `--[[
  Crafting System — Server ModuleScript
  Place in: ServerScriptService.Systems.CraftingSystem
  README: Config.Recipes defines craftable items with required ingredients.
          Config.Stations defines crafting station types. Some recipes need specific stations.
          CraftTime adds production delay for premium feel.
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local CraftingSystem = {}
CraftingSystem.__index = CraftingSystem

local Config = {
  Recipes = {
    IronSword = {
      Result = { Id = "iron_sword", Amount = 1 },
      Ingredients = { { Id = "iron_ingot", Amount = 3 }, { Id = "wood", Amount = 1 } },
      Station = "Anvil", CraftTime = 5, XPReward = 20,
    },
    HealthPotion = {
      Result = { Id = "health_potion", Amount = 3 },
      Ingredients = { { Id = "herb", Amount = 2 }, { Id = "water_flask", Amount = 1 } },
      Station = "Cauldron", CraftTime = 3, XPReward = 10,
    },
    GoldenArmor = {
      Result = { Id = "golden_armor", Amount = 1 },
      Ingredients = { { Id = "gold_ingot", Amount = 10 }, { Id = "diamond", Amount = 2 }, { Id = "leather", Amount = 5 } },
      Station = "Anvil", CraftTime = 15, XPReward = 100,
    },
    MagicStaff = {
      Result = { Id = "magic_staff", Amount = 1 },
      Ingredients = { { Id = "ancient_wood", Amount = 3 }, { Id = "crystal", Amount = 5 }, { Id = "enchant_scroll", Amount = 1 } },
      Station = "EnchantTable", CraftTime = 20, XPReward = 150,
    },
  },
  Stations = { "Anvil", "Cauldron", "EnchantTable", "Workbench" },
}

function CraftingSystem.new() return setmetatable({}, CraftingSystem) end

function CraftingSystem:CanCraft(player, recipeName, inventoryCheck)
  local recipe = Config.Recipes[recipeName]
  if not recipe then return false, "Recipe not found" end
  for _, ing in ipairs(recipe.Ingredients) do
    local has = inventoryCheck(player, ing.Id)
    if has < ing.Amount then return false, "Need " .. ing.Amount .. "x " .. ing.Id end
  end
  return true
end

function CraftingSystem:Craft(player, recipeName, inventoryRemove, inventoryAdd)
  local recipe = Config.Recipes[recipeName]
  if not recipe then return false end
  for _, ing in ipairs(recipe.Ingredients) do
    inventoryRemove(player, ing.Id, ing.Amount)
  end
  if recipe.CraftTime > 0 then
    task.wait(recipe.CraftTime)
  end
  inventoryAdd(player, recipe.Result.Id, recipe.Result.Amount)
  return true, recipe
end

function CraftingSystem:GetRecipeList()
  local list = {}
  for name, recipe in pairs(Config.Recipes) do
    table.insert(list, {
      name = name,
      result = recipe.Result,
      ingredients = recipe.Ingredients,
      station = recipe.Station,
      time = recipe.CraftTime,
    })
  end
  return list
end

function CraftingSystem:Init()
  local remote = Instance.new("RemoteEvent")
  remote.Name = "CraftAction"
  remote.Parent = ReplicatedStorage
  local listRemote = Instance.new("RemoteFunction")
  listRemote.Name = "GetRecipes"
  listRemote.Parent = ReplicatedStorage
  listRemote.OnServerInvoke = function() return self:GetRecipeList() end
end

return CraftingSystem`,
  clientCode: `--[[ Crafting Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local craftRemote = ReplicatedStorage:WaitForChild("CraftAction")
local recipesRemote = ReplicatedStorage:WaitForChild("GetRecipes")
local screen = UI.createScreenGui("CraftingGui")

local panel = UI.Card(screen, {
  Size = UDim2.new(0, 450, 0, 400),
  Position = UDim2.new(0.5, -225, 0.5, -200),
})
panel.Visible = false

UI.Text(panel, {
  Text = "⚒️ Crafting", Bold = true, TextSize = 22,
  Size = UDim2.new(1, 0, 0, 40), Position = UDim2.new(0, 0, 0, 5),
  Align = Enum.TextXAlignment.Center,
})

UI.Button(panel, {
  Text = "✕", Style = "Danger",
  Size = UDim2.new(0, 30, 0, 30), Position = UDim2.new(1, -38, 0, 8),
  OnClick = function() panel.Visible = false end,
})

local scroll = Instance.new("ScrollingFrame")
scroll.Size = UDim2.new(0.9, 0, 0, 310)
scroll.Position = UDim2.new(0.05, 0, 0, 50)
scroll.BackgroundTransparency = 1
scroll.ScrollBarThickness = 3
scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
scroll.Parent = panel

local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 6)
layout.Parent = scroll

local function loadRecipes()
  local recipes = recipesRemote:InvokeServer()
  if not recipes then return end
  for _, r in ipairs(recipes) do
    local card = Instance.new("Frame")
    card.Size = UDim2.new(1, 0, 0, 80)
    card.BackgroundColor3 = Color3.fromRGB(35, 35, 45)
    card.Parent = scroll
    Instance.new("UICorner", card).CornerRadius = UDim.new(0, 8)

    local nameLabel = Instance.new("TextLabel")
    nameLabel.Text = r.name .. " → " .. r.result.Amount .. "x " .. r.result.Id
    nameLabel.Size = UDim2.new(0.65, 0, 0, 22)
    nameLabel.Position = UDim2.new(0, 10, 0, 5)
    nameLabel.BackgroundTransparency = 1
    nameLabel.TextColor3 = Color3.fromRGB(255, 220, 100)
    nameLabel.Font = Enum.Font.GothamBold
    nameLabel.TextSize = 13
    nameLabel.TextXAlignment = Enum.TextXAlignment.Left
    nameLabel.Parent = card

    local ingText = ""
    for _, ing in ipairs(r.ingredients) do
      ingText = ingText .. ing.Amount .. "x " .. ing.Id .. "  "
    end
    local ingLabel = Instance.new("TextLabel")
    ingLabel.Text = ingText
    ingLabel.Size = UDim2.new(0.9, 0, 0, 16)
    ingLabel.Position = UDim2.new(0, 10, 0, 28)
    ingLabel.BackgroundTransparency = 1
    ingLabel.TextColor3 = Color3.fromRGB(160, 160, 170)
    ingLabel.Font = Enum.Font.Gotham
    ingLabel.TextSize = 10
    ingLabel.TextXAlignment = Enum.TextXAlignment.Left
    ingLabel.Parent = card

    local stationLabel = Instance.new("TextLabel")
    stationLabel.Text = "Station: " .. r.station .. " | " .. r.time .. "s"
    stationLabel.Size = UDim2.new(0.9, 0, 0, 14)
    stationLabel.Position = UDim2.new(0, 10, 0, 46)
    stationLabel.BackgroundTransparency = 1
    stationLabel.TextColor3 = Color3.fromRGB(120, 120, 130)
    stationLabel.Font = Enum.Font.Gotham
    stationLabel.TextSize = 10
    stationLabel.TextXAlignment = Enum.TextXAlignment.Left
    stationLabel.Parent = card

    local craftBtn = Instance.new("TextButton")
    craftBtn.Text = "Craft"
    craftBtn.Size = UDim2.new(0, 60, 0, 28)
    craftBtn.Position = UDim2.new(1, -70, 0.5, -14)
    craftBtn.BackgroundColor3 = Color3.fromRGB(80, 200, 120)
    craftBtn.TextColor3 = Color3.new(1, 1, 1)
    craftBtn.Font = Enum.Font.GothamBold
    craftBtn.TextSize = 12
    craftBtn.Parent = card
    Instance.new("UICorner", craftBtn).CornerRadius = UDim.new(0, 6)
    craftBtn.MouseButton1Click:Connect(function()
      craftRemote:FireServer("craft", r.name)
    end)
  end
end

UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  if input.KeyCode == Enum.KeyCode.C then
    panel.Visible = not panel.Visible
    if panel.Visible then loadRecipes() end
  end
end)`,
};
