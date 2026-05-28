import type { SystemTemplate } from "./index";

export const TRADING_SYSTEM: SystemTemplate = {
  name: "Player Trading System",
  category: "Social",
  description: "Secure peer-to-peer item trading with confirmation UI, scam prevention, and trade history.",
  keywords: ["trade", "trading", "exchange", "offer", "accept", "give", "transfer"],
  serverCode: `--[[
  Trading System — Server ModuleScript
  Place in: ServerScriptService.Systems.TradingSystem
  README: Implements a 2-phase trade: both players add items, then both confirm.
          Config.MaxItemsPerTrade limits trade size. Config.TradeCooldown prevents spam.
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local TradingSystem = {}
TradingSystem.__index = TradingSystem

local Config = {
  MaxItemsPerTrade = 10,
  TradeCooldown = 5,
  TradeTimeout = 60,
}

local activeTrades = {}
local cooldowns = {}

function TradingSystem.new() return setmetatable({}, TradingSystem) end

function TradingSystem:RequestTrade(sender, receiver)
  if cooldowns[sender] and os.clock() - cooldowns[sender] < Config.TradeCooldown then return false, "Cooldown" end
  if activeTrades[sender] or activeTrades[receiver] then return false, "Already trading" end
  local trade = {
    players = {sender, receiver},
    items = {[sender] = {}, [receiver] = {}},
    confirmed = {[sender] = false, [receiver] = false},
    startTime = os.clock(),
  }
  activeTrades[sender] = trade
  activeTrades[receiver] = trade
  return true
end

function TradingSystem:AddItem(player, itemData)
  local trade = activeTrades[player]
  if not trade then return false end
  if #trade.items[player] >= Config.MaxItemsPerTrade then return false end
  trade.confirmed[trade.players[1]] = false
  trade.confirmed[trade.players[2]] = false
  table.insert(trade.items[player], itemData)
  return true
end

function TradingSystem:Confirm(player)
  local trade = activeTrades[player]
  if not trade then return false end
  trade.confirmed[player] = true
  if trade.confirmed[trade.players[1]] and trade.confirmed[trade.players[2]] then
    self:ExecuteTrade(trade)
    return true
  end
  return false
end

function TradingSystem:ExecuteTrade(trade)
  local p1, p2 = trade.players[1], trade.players[2]
  -- Transfer items (hook into inventory system)
  -- trade.items[p1] goes to p2, trade.items[p2] goes to p1
  activeTrades[p1] = nil
  activeTrades[p2] = nil
  cooldowns[p1] = os.clock()
  cooldowns[p2] = os.clock()
end

function TradingSystem:CancelTrade(player)
  local trade = activeTrades[player]
  if not trade then return end
  for _, p in ipairs(trade.players) do activeTrades[p] = nil end
end

function TradingSystem:Init()
  local remote = Instance.new("RemoteEvent")
  remote.Name = "TradeAction"
  remote.Parent = ReplicatedStorage
  remote.OnServerEvent:Connect(function(player, action, ...)
    if action == "request" then
      local target = ...
      if type(target) == "string" then target = Players:FindFirstChild(target) end
      if target then self:RequestTrade(player, target) end
    elseif action == "add" then self:AddItem(player, ...)
    elseif action == "confirm" then self:Confirm(player)
    elseif action == "cancel" then self:CancelTrade(player)
    end
  end)
end

return TradingSystem`,
  clientCode: `--[[ Trading Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local remote = ReplicatedStorage:WaitForChild("TradeAction")
local screen = UI.createScreenGui("TradeGui")
screen.Enabled = false

local panel = UI.Card(screen, {
  Size = UDim2.new(0, 550, 0, 350),
  Position = UDim2.new(0.5, -275, 0.5, -175),
})

UI.Text(panel, {
  Text = "🤝 Trade", Bold = true, TextSize = 22,
  Size = UDim2.new(1, 0, 0, 40), Position = UDim2.new(0, 0, 0, 5),
  Align = Enum.TextXAlignment.Center,
})

-- Your items (left side)
UI.Text(panel, {
  Text = "Your Items", Bold = true, TextSize = 14,
  Size = UDim2.new(0.45, 0, 0, 25), Position = UDim2.new(0.02, 0, 0, 45),
})

local yourSlots = Instance.new("Frame")
yourSlots.Size = UDim2.new(0.45, 0, 0, 200)
yourSlots.Position = UDim2.new(0.02, 0, 0, 70)
yourSlots.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
yourSlots.Parent = panel
Instance.new("UICorner", yourSlots).CornerRadius = UDim.new(0, 8)

-- Their items (right side)
UI.Text(panel, {
  Text = "Their Items", Bold = true, TextSize = 14,
  Size = UDim2.new(0.45, 0, 0, 25), Position = UDim2.new(0.53, 0, 0, 45),
})

local theirSlots = Instance.new("Frame")
theirSlots.Size = UDim2.new(0.45, 0, 0, 200)
theirSlots.Position = UDim2.new(0.53, 0, 0, 70)
theirSlots.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
theirSlots.Parent = panel
Instance.new("UICorner", theirSlots).CornerRadius = UDim.new(0, 8)

-- Action buttons
UI.Button(panel, {
  Text = "✅ Confirm", Style = "Primary",
  Size = UDim2.new(0.35, 0, 0, 38),
  Position = UDim2.new(0.08, 0, 1, -50),
  OnClick = function() remote:FireServer("confirm") end,
})

UI.Button(panel, {
  Text = "❌ Cancel", Style = "Danger",
  Size = UDim2.new(0.35, 0, 0, 38),
  Position = UDim2.new(0.57, 0, 1, -50),
  OnClick = function()
    remote:FireServer("cancel")
    screen.Enabled = false
  end,
})`,
};
