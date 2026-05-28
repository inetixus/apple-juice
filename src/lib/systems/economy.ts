import type { SystemTemplate } from "./index";

export const ECONOMY_SYSTEM: SystemTemplate = {
  name: "Advanced Economy & Shop",
  category: "Economy",
  description: "Multi-currency system with DataStore persistence, discount events, and ShopTemplate integration.",
  keywords: ["shop", "store", "buy", "purchase", "currency", "gold", "gems", "coins", "gamepass", "economy", "money", "price"],
  serverCode: `--[[
  Advanced Economy System — Server ModuleScript
  Place in: ServerScriptService.Systems.EconomySystem
  README: Change Config.Currencies to add/remove currencies.
          Change Config.Items to define purchasable items.
          Call EconomySystem:StartDiscountEvent(0.25, 300) for 25% off for 5 min.
]]
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local EconomySystem = {}
EconomySystem.__index = EconomySystem

local Config = {
  Currencies = {
    Gold = { default = 100, max = 999999, icon = "rbxassetid://77506246542645" },
    Gems = { default = 5, max = 99999, icon = "rbxassetid://95281827729498" },
    XP   = { default = 0, max = 9999999, icon = "rbxassetid://111803940069577" },
  },
  Items = {
    { Id = "coin_pouch", Name = "Coin Pouch", Price = 50, Currency = "Gold", Category = "Currency" },
    { Id = "gem_pack",   Name = "Gem Pack",   Price = 10, Currency = "Gems", Category = "Currency" },
    { Id = "vip_pass",   Name = "VIP Pass",   Price = 499, Currency = "Gold", Category = "Passes" },
    { Id = "speed_boost", Name = "Speed Boost", Price = 25, Currency = "Gems", Category = "Boosts" },
  },
  DataStoreName = "PlayerEconomy_v1",
  AutoSaveInterval = 60,
  DiscountMultiplier = 1.0,
}

local playerData = {}
local dataStore = DataStoreService:GetDataStore(Config.DataStoreName)

function EconomySystem.new()
  local self = setmetatable({}, EconomySystem)
  self._connections = {}
  return self
end

function EconomySystem:LoadPlayer(player)
  local key = "player_" .. player.UserId
  local success, data = pcall(function() return dataStore:GetAsync(key) end)
  if success and data then
    playerData[player] = data
  else
    playerData[player] = {}
    for name, info in pairs(Config.Currencies) do
      playerData[player][name] = info.default
    end
  end
  self:SyncToClient(player)
end

function EconomySystem:SavePlayer(player)
  if not playerData[player] then return end
  local key = "player_" .. player.UserId
  pcall(function() dataStore:SetAsync(key, playerData[player]) end)
end

function EconomySystem:GetBalance(player, currency)
  return playerData[player] and playerData[player][currency] or 0
end

function EconomySystem:AddCurrency(player, currency, amount)
  if not playerData[player] then return false end
  local info = Config.Currencies[currency]
  if not info then return false end
  playerData[player][currency] = math.min(playerData[player][currency] + amount, info.max)
  self:SyncToClient(player)
  return true
end

function EconomySystem:SpendCurrency(player, currency, amount)
  if not playerData[player] then return false end
  if playerData[player][currency] < amount then return false end
  playerData[player][currency] -= amount
  self:SyncToClient(player)
  return true
end

function EconomySystem:PurchaseItem(player, itemId)
  local item = nil
  for _, i in ipairs(Config.Items) do
    if i.Id == itemId then item = i; break end
  end
  if not item then return false, "Item not found" end
  local price = math.floor(item.Price * Config.DiscountMultiplier)
  if not self:SpendCurrency(player, item.Currency, price) then
    return false, "Not enough " .. item.Currency
  end
  -- Grant item logic here (add to inventory, apply boost, etc.)
  return true, "Purchased " .. item.Name
end

function EconomySystem:StartDiscountEvent(percent, durationSec)
  Config.DiscountMultiplier = 1.0 - percent
  task.delay(durationSec, function()
    Config.DiscountMultiplier = 1.0
  end)
end

function EconomySystem:SyncToClient(player)
  local remote = ReplicatedStorage:FindFirstChild("EconomySync")
  if not remote then
    remote = Instance.new("RemoteEvent")
    remote.Name = "EconomySync"
    remote.Parent = ReplicatedStorage
  end
  remote:FireClient(player, playerData[player], Config.DiscountMultiplier)
end

function EconomySystem:Init()
  local purchaseRemote = Instance.new("RemoteEvent")
  purchaseRemote.Name = "PurchaseRequest"
  purchaseRemote.Parent = ReplicatedStorage

  purchaseRemote.OnServerEvent:Connect(function(player, itemId)
    if type(itemId) ~= "string" then return end
    local ok, msg = self:PurchaseItem(player, itemId)
    purchaseRemote:FireClient(player, ok, msg)
  end)

  Players.PlayerAdded:Connect(function(p) self:LoadPlayer(p) end)
  Players.PlayerRemoving:Connect(function(p) self:SavePlayer(p); playerData[p] = nil end)

  -- Auto-save loop
  task.spawn(function()
    while true do
      task.wait(Config.AutoSaveInterval)
      for _, p in ipairs(Players:GetPlayers()) do self:SavePlayer(p) end
    end
  end)
end

return EconomySystem`,
  clientCode: `--[[ Economy Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local player = Players.LocalPlayer
local balances = {}
local discount = 1.0

local syncRemote = ReplicatedStorage:WaitForChild("EconomySync")
syncRemote.OnClientEvent:Connect(function(data, disc)
  balances = data
  discount = disc or 1.0
end)

local purchaseRemote = ReplicatedStorage:WaitForChild("PurchaseRequest")

-- Build shop UI using AppleJuiceUI ShopTemplate
local screen, panel = UI.ShopTemplate({
  Title = "Game Shop",
  Tabs = {
    {Id = "Currency", Label = "CURRENCY", Items = {
      {Text = "Coin Pouch", Price = 50, Icon = UI.Icons.Coin, Id = "coin_pouch"},
    }},
    {Id = "Passes", Label = "PASSES", Items = {
      {Text = "VIP Pass", Price = 499, Icon = UI.Icons.VIP, Id = "vip_pass"},
    }},
  },
  OnBuy = function(itemId)
    purchaseRemote:FireServer(itemId)
  end,
})
screen.Enabled = false

local UserInputService = game:GetService("UserInputService")
UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  if input.KeyCode == Enum.KeyCode.M then
    screen.Enabled = not screen.Enabled
  end
end)`,
};
