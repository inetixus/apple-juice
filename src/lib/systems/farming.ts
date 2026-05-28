import type { SystemTemplate } from "./index";

export const FARMING_SYSTEM: SystemTemplate = {
  name: "Agricultural Growing System",
  category: "Farming",
  description: "Stardew Valley-style farming: plot states, growth cycles, fertilizers, harvest, and crop selling.",
  keywords: ["farm", "grow", "plant", "harvest", "crop", "seed", "water", "garden", "agriculture"],
  serverCode: `--[[
  Farming System — Server ModuleScript
  Place in: ServerScriptService.Systems.FarmingSystem
  README: Config.Crops defines growth stages and timings. Config.Fertilizers multiply speed.
          Plots track state: Empty → Seeded → Growing → Grown → Harvested.
          Growth uses server tick-based calculation, not loops.
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local FarmingSystem = {}
FarmingSystem.__index = FarmingSystem

local Config = {
  Crops = {
    Wheat  = { GrowTime = 60,  Stages = 4, SellPrice = 10, SeedPrice = 5,  Yield = {1, 3} },
    Tomato = { GrowTime = 120, Stages = 5, SellPrice = 25, SeedPrice = 15, Yield = {2, 5} },
    Corn   = { GrowTime = 180, Stages = 4, SellPrice = 40, SeedPrice = 25, Yield = {1, 4} },
    Melon  = { GrowTime = 300, Stages = 6, SellPrice = 80, SeedPrice = 50, Yield = {1, 2} },
    GoldenApple = { GrowTime = 600, Stages = 8, SellPrice = 500, SeedPrice = 200, Yield = {1, 1} },
  },
  Fertilizers = {
    None = { SpeedMult = 1.0, QualityBonus = 0 },
    Basic = { SpeedMult = 1.5, QualityBonus = 0.1 },
    Premium = { SpeedMult = 2.0, QualityBonus = 0.25 },
    Miracle = { SpeedMult = 3.0, QualityBonus = 0.5 },
  },
  MaxPlotsPerPlayer = 20,
}

local playerPlots = {}

function FarmingSystem.new()
  return setmetatable({}, FarmingSystem)
end

function FarmingSystem:CreatePlot(player, position)
  local data = playerPlots[player]
  if not data then return nil end
  if #data >= Config.MaxPlotsPerPlayer then return nil end
  local plot = {
    id = #data + 1,
    position = position,
    state = "Empty",
    crop = nil,
    fertilizer = "None",
    plantedAt = 0,
    stage = 0,
  }
  table.insert(data, plot)
  return plot
end

function FarmingSystem:PlantSeed(player, plotId, cropName)
  local data = playerPlots[player]
  if not data then return false end
  local plot = data[plotId]
  if not plot or plot.state ~= "Empty" then return false end
  local crop = Config.Crops[cropName]
  if not crop then return false end
  plot.state = "Growing"
  plot.crop = cropName
  plot.plantedAt = os.clock()
  plot.stage = 1
  return true
end

function FarmingSystem:GetGrowthProgress(plot)
  if plot.state ~= "Growing" then return plot.state == "Grown" and 1 or 0 end
  local crop = Config.Crops[plot.crop]
  if not crop then return 0 end
  local fert = Config.Fertilizers[plot.fertilizer] or Config.Fertilizers.None
  local elapsed = os.clock() - plot.plantedAt
  local adjustedTime = crop.GrowTime / fert.SpeedMult
  local progress = math.clamp(elapsed / adjustedTime, 0, 1)
  local newStage = math.floor(progress * crop.Stages)
  if newStage ~= plot.stage then plot.stage = newStage end
  if progress >= 1 then plot.state = "Grown" end
  return progress
end

function FarmingSystem:Harvest(player, plotId)
  local data = playerPlots[player]
  if not data then return nil end
  local plot = data[plotId]
  if not plot then return nil end
  self:GetGrowthProgress(plot)
  if plot.state ~= "Grown" then return nil end
  local crop = Config.Crops[plot.crop]
  local fert = Config.Fertilizers[plot.fertilizer]
  local baseYield = math.random(crop.Yield[1], crop.Yield[2])
  local qualityRoll = math.random() < fert.QualityBonus
  local result = { crop = plot.crop, amount = baseYield, quality = qualityRoll and "Premium" or "Normal" }
  plot.state = "Empty"
  plot.crop = nil
  plot.plantedAt = 0
  plot.stage = 0
  return result
end

function FarmingSystem:Init()
  Players.PlayerAdded:Connect(function(p) playerPlots[p] = {} end)
  Players.PlayerRemoving:Connect(function(p) playerPlots[p] = nil end)
  local remote = Instance.new("RemoteEvent")
  remote.Name = "FarmAction"
  remote.Parent = ReplicatedStorage
  remote.OnServerEvent:Connect(function(player, action, ...)
    if action == "plant" then self:PlantSeed(player, ...)
    elseif action == "harvest" then
      local result = self:Harvest(player, ...)
      remote:FireClient(player, "harvested", result)
    elseif action == "water" then -- apply fertilizer
    end
  end)
end

return FarmingSystem`,
  clientCode: `--[[ Farming Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local remote = ReplicatedStorage:WaitForChild("FarmAction")
local screen = UI.createScreenGui("FarmGui")

local panel = UI.Card(screen, {
  Size = UDim2.new(0, 400, 0, 350),
  Position = UDim2.new(0.5, -200, 0.5, -175),
})
panel.Visible = false

UI.Text(panel, {
  Text = "🌾 Farm", Bold = true, TextSize = 22,
  Size = UDim2.new(1, 0, 0, 40), Position = UDim2.new(0, 0, 0, 5),
  Align = Enum.TextXAlignment.Center,
})

UI.Button(panel, {
  Text = "✕", Style = "Danger",
  Size = UDim2.new(0, 30, 0, 30), Position = UDim2.new(1, -38, 0, 8),
  OnClick = function() panel.Visible = false end,
})

-- Seed selector
local crops = {"Wheat", "Tomato", "Corn", "Melon", "GoldenApple"}
local CropIcons = { Wheat = "🌾", Tomato = "🍅", Corn = "🌽", Melon = "🍈", GoldenApple = "🍎" }

for i, crop in ipairs(crops) do
  UI.Button(panel, {
    Text = (CropIcons[crop] or "") .. " Plant " .. crop,
    Style = "Secondary",
    Size = UDim2.new(0.44, 0, 0, 34),
    Position = UDim2.new(((i - 1) % 2) * 0.48 + 0.03, 0, 0, 50 + math.floor((i - 1) / 2) * 40),
    OnClick = function()
      remote:FireServer("plant", 1, crop)
    end,
  })
end

-- Harvest button
UI.Button(panel, {
  Text = "🧺 Harvest Plot 1", Style = "Primary",
  Size = UDim2.new(0.9, 0, 0, 40),
  Position = UDim2.new(0.05, 0, 1, -60),
  OnClick = function() remote:FireServer("harvest", 1) end,
})

-- Harvest result
remote.OnClientEvent:Connect(function(action, result)
  if action == "harvested" and result then
    local quality = result.quality == "Premium" and "⭐ " or ""
    UI.Toast(screen, {
      Text = quality .. "Harvested " .. result.amount .. "x " .. result.crop,
      Type = "success",
    })
  end
end)

UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  if input.KeyCode == Enum.KeyCode.F then panel.Visible = not panel.Visible end
end)`,
};
